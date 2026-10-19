-- TIKINTERACT: administrare + suport. Copiază TOT fișierul în Supabase SQL Editor și apasă Run.
-- Contul mironsergiuflorin@gmail.com trebuie să existe și să aibă e-mailul confirmat.
-- Rerularea păstrează configurația, echipa și conversațiile existente.
-- Generat din admin.sql + support.sql; instalare într-o singură tranzacție.
begin;

-- 1. ADMINISTRARE
-- Run once in Supabase SQL Editor. Rerunnable; never overwrites existing settings.

create table if not exists public.site_admins(
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','editor')),
 created_at timestamptz not null default now()
);
create table if not exists public.site_settings(
 singleton boolean primary key default true check(singleton),
 draft jsonb not null,published jsonb not null,
 revision bigint not null default 0,published_revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
create table if not exists public.site_config_history(
 id bigint generated always as identity primary key,
 revision bigint not null,action text not null,
 payload jsonb not null,actor uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;
alter table public.site_settings enable row level security;
alter table public.site_config_history enable row level security;
revoke all on public.site_admins,public.site_settings,public.site_config_history from anon,authenticated;

create or replace function public.site_admin_role() returns text
language sql stable security definer set search_path='' as $$
 select role from public.site_admins where user_id=auth.uid()
$$;
revoke all on function public.site_admin_role() from public,anon;
grant execute on function public.site_admin_role() to authenticated;

create or replace function public.validate_site_config(c jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare p jsonb;g jsonb;f jsonb;k text;seen text[]:='{}';n numeric;panels text[];
begin
 if c is null or pg_catalog.pg_column_size(c)>200000 or c->'schemaVersion' is distinct from '1'::jsonb then raise exception 'Invalid configuration';end if;
 if jsonb_typeof(c->'plans') is distinct from 'array' or jsonb_array_length(c->'plans')<>3 then raise exception 'Three plans required';end if;
 for p in select * from jsonb_array_elements(c->'plans') loop
  if coalesce(p->>'id','') not in ('free','play_pass','play_pass_pro') or p->>'id'=any(seen) then raise exception 'Invalid plan ID';end if;
  seen:=array_append(seen,p->>'id');
  if jsonb_typeof(p->'name') is distinct from 'string' or length(trim(p->>'name')) not between 1 and 60 or jsonb_typeof(p->'priceCents') is distinct from 'number' then raise exception 'Invalid plan';end if;
  n:=(p->>'priceCents')::numeric;
  if n<>floor(n) or n not between 0 and 10000000 or(p->>'id'='free' and n<>0) or coalesce(p->>'currency','') not in ('RON','EUR','USD') or jsonb_typeof(p->'enabled') is distinct from 'boolean' then raise exception 'Invalid price';end if;
  if jsonb_typeof(p->'features') is distinct from 'array' or jsonb_array_length(p->'features')>12 then raise exception 'Invalid features';end if;
  for f in select * from jsonb_array_elements(p->'features') loop
   if jsonb_typeof(f)<>'string' or length(trim(f#>>'{}')) not between 1 and 160 then raise exception 'Invalid feature';end if;
  end loop;
 end loop;
 if jsonb_typeof(c->'games') is distinct from 'array' or jsonb_array_length(c->'games')>200 then raise exception 'Invalid games';end if;
 seen:='{}';
 for g in select * from jsonb_array_elements(c->'games') loop
  if coalesce(g->>'id','') !~ '^[a-z0-9][a-z0-9-]{1,59}$' or g->>'id'=any(seen) then raise exception 'Invalid game ID';end if;
  seen:=array_append(seen,g->>'id');
  if jsonb_typeof(g->'name') is distinct from 'string' or length(trim(g->>'name')) not between 1 and 80 or jsonb_typeof(g->'description') is distinct from 'string' or length(trim(g->>'description')) not between 1 and 500 then raise exception 'Invalid game text';end if;
  if coalesce(g->>'entryPath','') !~ '^GAME/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+\.html$' or position('..' in g->>'entryPath')>0 then raise exception 'Invalid game path';end if;
  if coalesce(g->>'presentationPath','')<>'' and ((g->>'presentationPath') !~ '^GAME/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+\.html$' or position('..' in g->>'presentationPath')>0) then raise exception 'Invalid presentation path';end if;
  if length(coalesce(g->>'cover','')) not between 1 and 2048 or position('..' in g->>'cover')>0 or (g->>'cover' !~ '^assets/[A-Za-z0-9_./-]+\.(webp|png|jpe?g)(\?v=[0-9]+)?$' and g->>'cover' !~ '^https://[^[:space:]<>"'']+$') then raise exception 'Invalid cover';end if;
  if coalesce(g->>'status','') not in ('published','draft','disabled') or coalesce(g->>'plan','') not in ('free','play_pass','play_pass_pro') then raise exception 'Invalid game status';end if;
 end loop;
 foreach k in array array['heading','accent','intro'] loop
  if jsonb_typeof(c->'home'->k) is distinct from 'string' or length(trim(c->'home'->>k)) not between 1 and (case when k='intro' then 300 else 100 end) then raise exception 'Invalid home text';end if;
 end loop;
 if jsonb_typeof(c->'studio'->'left') is distinct from 'array' or jsonb_typeof(c->'studio'->'right') is distinct from 'array' then raise exception 'Invalid studio columns';end if;
 select array_agg(value order by value) into panels from jsonb_array_elements_text((c->'studio'->'left')||(c->'studio'->'right'));
 if panels is distinct from array['audio','controls','feed','games','stats','streamer'] or coalesce(c->'studio'->>'density','') not in ('normal','compact') or coalesce(c->'studio'->>'side','') not in ('standard','reversed') then raise exception 'Each Studio panel is required exactly once';end if;
end $$;
revoke all on function public.validate_site_config(jsonb) from public,anon,authenticated;

create or replace function public.get_site_public_config() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('config',jsonb_set(published,'{games}',coalesce((select jsonb_agg(g order by position) from jsonb_array_elements(published->'games') with ordinality as entries(g,position) where g->>'status'='published'),'[]'::jsonb)),'revision',published_revision) from public.site_settings where singleton
$$;
revoke all on function public.get_site_public_config() from public;
grant execute on function public.get_site_public_config() to anon,authenticated;

create or replace function public.get_site_admin_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r text:=public.site_admin_role();result jsonb;
begin
 if r is null then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
 select jsonb_build_object('role',r,'draft',s.draft,'published',s.published,'revision',s.revision,'publishedRevision',s.published_revision,
 'history',coalesce((select jsonb_agg(x order by id desc) from(select id,revision,action,created_at from public.site_config_history order by id desc limit 25)x),'[]'::jsonb)) into result from public.site_settings s where singleton;
 return result;
end $$;
revoke all on function public.get_site_admin_state() from public,anon;
grant execute on function public.get_site_admin_state() to authenticated;

create or replace function public.save_site_config(p_config jsonb,p_revision bigint,p_publish boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r text:=public.site_admin_role();current_revision bigint;
begin
 if r is null or(p_publish and r not in('owner','admin')) then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
 perform public.validate_site_config(p_config);
 perform pg_advisory_xact_lock(74038101);
 select revision into current_revision from public.site_settings where singleton for update;
 if current_revision is distinct from p_revision then raise exception 'CONFIG_CONFLICT';end if;
 update public.site_settings set draft=p_config,revision=revision+1,updated_at=now(),published=case when p_publish then p_config else published end,published_revision=case when p_publish then revision+1 else published_revision end where singleton;
 insert into public.site_config_history(revision,action,payload,actor) values(current_revision+1,case when p_publish then 'publish' else 'draft' end,p_config,auth.uid());
 return public.get_site_admin_state();
end $$;
revoke all on function public.save_site_config(jsonb,bigint,boolean) from public,anon;
grant execute on function public.save_site_config(jsonb,bigint,boolean) to authenticated;

create or replace function public.restore_site_config(p_version bigint,p_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
 if public.site_admin_role() is null then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
 select h.payload into payload from public.site_config_history h where id=p_version;
 if payload is null then raise exception 'Unknown version';end if;
 return public.save_site_config(payload,p_revision,false);
end $$;
revoke all on function public.restore_site_config(bigint,bigint) from public,anon;
grant execute on function public.restore_site_config(bigint,bigint) to authenticated;

create or replace function public.list_site_admins() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if public.site_admin_role() is distinct from 'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'email',u.email,'role',a.role) order by a.created_at) from public.site_admins a join auth.users u on u.id=a.user_id),'[]'::jsonb);
end $$;
revoke all on function public.list_site_admins() from public,anon;
grant execute on function public.list_site_admins() to authenticated;

create or replace function public.manage_site_admin(p_email text,p_role text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid;old_role text;
begin
 perform pg_advisory_xact_lock(74038102);
 if public.site_admin_role() is distinct from 'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 if p_role is not null and p_role not in('owner','admin','editor') then raise exception 'Invalid role';end if;
 select id into target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null and not is_anonymous;
 if target is null then raise exception 'Contul trebuie să existe și să aibă e-mailul confirmat.';end if;
 select role into old_role from public.site_admins where user_id=target;
 if old_role='owner' and p_role is distinct from 'owner' and(select count(*) from public.site_admins where role='owner')<=1 then raise exception 'Ultimul proprietar nu poate fi eliminat sau retrogradat.';end if;
 if p_role is null then delete from public.site_admins where user_id=target;
 else insert into public.site_admins(user_id,role) values(target,p_role) on conflict(user_id) do update set role=excluded.role;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'email',u.email,'role',a.role) order by a.created_at) from public.site_admins a join auth.users u on u.id=a.user_id),'[]'::jsonb);
end $$;
revoke all on function public.manage_site_admin(text,text) from public,anon;
grant execute on function public.manage_site_admin(text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('site-media','site-media',true,5242880,array['image/webp','image/png','image/jpeg']) on conflict(id) do nothing;
drop policy if exists "Staff uploads site covers" on storage.objects;
create policy "Staff uploads site covers" on storage.objects for insert to authenticated
with check(bucket_id='site-media' and public.site_admin_role() is not null and(storage.foldername(name))[1]=auth.uid()::text);

with seed as(select '{"schemaVersion":1,"plans":[{"id":"free","name":"FREE","priceCents":0,"currency":"RON","enabled":true,"features":["Acces la funcțiile de bază","Conectare TikTok LIVE","Profil și clasament public"]},{"id":"play_pass","name":"Play Pass","priceCents":2900,"currency":"RON","enabled":true,"features":["Jocuri LIVE extinse","Evenimente interactive","Statistici de bază"]},{"id":"play_pass_pro","name":"Play Pass PRO","priceCents":7900,"currency":"RON","enabled":true,"features":["Jocuri și opțiuni avansate","Instrumente pentru moderatori","Automatizări pentru chat"]}],"games":[{"id":"neon-race-2","name":"NEON INTERACT","cover":"assets/game-gallery/neon-interact-cover.webp?v=2","entryPath":"GAME/NEON-INTERACT/Neon-Interact.html","presentationPath":"GAME/NEON-INTERACT/index.html","status":"published","plan":"free","description":"Alege RED sau BLUE și intră în cursa de noapte."},{"id":"moto-interact","name":"MOTO INTERACT","cover":"assets/game-gallery/moto-interact-cover.webp?v=2","entryPath":"GAME/MOTO-INTERACT/Moto-Interact.html","presentationPath":"GAME/MOTO-INTERACT/index.html","status":"published","plan":"free","description":"Două echipe, motoare și o cursă decisă de public."},{"id":"nova-vex","name":"NOVA & VEX","cover":"assets/game-gallery/nova-vex-cover.webp?v=2","entryPath":"GAME/NOVA-VEX/Neon-Ascent.html","presentationPath":"GAME/NOVA-VEX/index.html","status":"published","plan":"free","description":"Ajut-o pe Nova să urce și ai grijă la Vex."},{"id":"neon-race","name":"NEON RACE","cover":"assets/game-gallery/neon-race-2-night.webp","entryPath":"GAME/NEON-RACE/Neon-Race.html","presentationPath":"GAME/NEON-RACE/index.html","status":"disabled","plan":"free","description":"Joc păstrat în arhivă."},{"id":"neon-riders","name":"NEON RIDERS","cover":"assets/game-gallery/moto-interact-day.webp","entryPath":"GAME/NEON-RIDERS/NEON-RIDERS.html","presentationPath":"GAME/NEON-RIDERS/index.html","status":"disabled","plan":"free","description":"Joc păstrat în arhivă."},{"id":"country-derby","name":"COUNTRY DERBY","cover":"assets/game-gallery/neon-race-2-night.webp","entryPath":"GAME/COUNTRY-DERBY/COUNTRY-DERBY.html","presentationPath":"GAME/COUNTRY-DERBY/index.html","status":"disabled","plan":"free","description":"Joc păstrat în arhivă."}],"home":{"heading":"Fă din LIVE-ul tău","accent":"un joc de echipă.","intro":"Alege jocul, conectează LIVE-ul și lasă chatul să intre în acțiune."},"studio":{"left":["games","controls"],"right":["streamer","audio","stats","feed"],"density":"normal","side":"standard"}}'::jsonb as payload) insert into public.site_settings(singleton,draft,published) select true,payload,payload from seed on conflict(singleton) do nothing;
insert into public.site_config_history(revision,action,payload) select 0,'initial',published from public.site_settings where singleton and not exists(select 1 from public.site_config_history);
-- Owner grants happen here, never in the browser or user-editable metadata.
do $$
declare owner_id uuid;
begin
 if exists(select 1 from public.site_admins where role='owner') then return;end if;
 select id into owner_id from auth.users where lower(email)='mironsergiuflorin@gmail.com' and email_confirmed_at is not null and not is_anonymous;
 if owner_id is null then raise exception 'Înregistrează și confirmă contul mironsergiuflorin@gmail.com înainte de activare.';end if;
 insert into public.site_admins(user_id,role) values(owner_id,'owner') on conflict(user_id) do nothing;
end $$;
notify pgrst,'reload schema';

-- 2. SUPORT ȘI MESAJE
-- Run AFTER admin.sql. Rerunnable. Private, account-based support; no e-mails are sent.

do $$
begin
 if to_regprocedure('public.site_admin_role()') is null or to_regclass('public.site_admins') is null then
  raise exception 'Administrarea nu este activată. Rulează supabase/install-admin.sql pentru instalarea completă.'
   using hint='Alternativ, rulează mai întâi supabase/admin.sql, apoi acest fișier support.sql.';
 end if;
end $$;
create table if not exists public.support_tickets(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid not null,
 topic text not null check(topic in ('game','bug','idea','question')),
 subject text not null check(length(subject) between 5 and 120),
 area text not null default '' check(length(area)<=80),
 state text not null default 'open' check(state in ('open','pending','resolved')),
 priority text not null default 'normal' check(priority in ('normal','high','urgent')),
 assigned_to uuid references auth.users(id) on delete set null,
 version bigint not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 public_updated_at timestamptz not null default now(),
 unique(owner_id,client_id)
);
create table if not exists public.support_messages(
 id bigint generated always as identity primary key,
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid references auth.users(id) on delete set null,
 author_kind text not null check(author_kind in ('customer','staff')),
 body text not null check(length(body) between 1 and 4000),
 internal boolean not null default false,
 client_id uuid not null,
 created_at timestamptz not null default now(),
 unique(ticket_id,author_id,client_id)
);
create table if not exists public.support_reads(
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_seen_id bigint not null default 0,
 primary key(ticket_id,user_id)
);
create index if not exists support_queue_idx on public.support_tickets(state,updated_at desc);
create index if not exists support_owner_idx on public.support_tickets(owner_id,public_updated_at desc);
create index if not exists support_thread_idx on public.support_messages(ticket_id,id desc);
create index if not exists support_author_idx on public.support_messages(author_id,created_at desc);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_reads enable row level security;
revoke all on public.support_tickets,public.support_messages,public.support_reads from anon,authenticated;

create or replace function public.support_is_staff() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(public.site_admin_role() in ('owner','admin'),false)
$$;
create or replace function public.support_require_account() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null and not is_anonymous) then
  raise exception 'SUPPORT_ACCOUNT_REQUIRED' using errcode='42501';
 end if;
 return u;
end $$;
-- Private helper. Never callable directly through the API.
create or replace function public.support_summary(p_ticket uuid,p_user uuid,p_staff boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',t.id,'subject',t.subject,'topic',t.topic,'area',t.area,'state',t.state,
  'priority',case when p_staff then t.priority else null end,'assignedTo',case when p_staff then t.assigned_to else null end,
  'ownerEmail',u.email,'assignedEmail',case when p_staff then a.email else null end,'version',t.version,
  'createdAt',t.created_at,'updatedAt',case when p_staff then t.updated_at else t.public_updated_at end,
  'preview',(select left(m.body,180) from public.support_messages m where m.ticket_id=t.id and (p_staff or not m.internal) order by m.id desc limit 1),
  'unread',(select count(*) from public.support_messages m where m.ticket_id=t.id and not m.internal
   and m.author_id is distinct from p_user and (p_staff or m.author_kind='staff')
   and m.id>coalesce((select r.last_seen_id from public.support_reads r where r.ticket_id=t.id and r.user_id=p_user),0)))
 from public.support_tickets t join auth.users u on u.id=t.owner_id left join auth.users a on a.id=t.assigned_to where t.id=p_ticket
$$;

create or replace function public.list_support_team() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.support_is_staff() then raise exception 'SUPPORT_STAFF_REQUIRED' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'email',u.email,'role',a.role) order by u.email)
  from public.site_admins a join auth.users u on u.id=a.user_id where a.role in ('owner','admin')),'[]'::jsonb);
end $$;

create or replace function public.list_support_tickets(p_filter text default 'all',p_search text default '',p_limit integer default 30,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=public.support_require_account();staff boolean:=public.support_is_staff();result jsonb;
begin
 if p_filter is null or p_filter not in ('all','open','pending','resolved','unread','mine') or p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 or p_offset>100000 or p_search is null or length(p_search)>120 then raise exception 'SUPPORT_INVALID_FILTER';end if;
 with accessible as (
  select t.*,public.support_summary(t.id,u,staff) summary from public.support_tickets t where staff or t.owner_id=u
 ), filtered as (
  select * from accessible t where
   (p_filter='all' or t.state=p_filter or (p_filter='unread' and (summary->>'unread')::bigint>0) or (p_filter='mine' and t.assigned_to=u))
   and (p_search='' or strpos(lower(t.subject),lower(p_search))>0 or (staff and strpos(lower(summary->>'ownerEmail'),lower(p_search))>0)
    or exists(select 1 from public.support_messages m where m.ticket_id=t.id and (staff or not m.internal) and strpos(lower(m.body),lower(p_search))>0))
 ), page as (select * from filtered order by case when staff then updated_at else public_updated_at end desc,id limit p_limit offset p_offset)
 select jsonb_build_object('items',coalesce((select jsonb_agg(summary order by case when staff then updated_at else public_updated_at end desc,id) from page),'[]'::jsonb),
  'total',(select count(*) from filtered),'stats',jsonb_build_object('total',(select count(*) from accessible),'open',(select count(*) from accessible where state='open'),
  'pending',(select count(*) from accessible where state='pending'),'resolved',(select count(*) from accessible where state='resolved'),
  'unread',(select count(*) from accessible where (summary->>'unread')::bigint>0))) into result;
 return result;
end $$;

create or replace function public.get_support_thread(p_ticket uuid,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=public.support_require_account();staff boolean:=public.support_is_staff();result jsonb;
begin
 if not exists(select 1 from public.support_tickets where id=p_ticket and (owner_id=u or staff)) then raise exception 'SUPPORT_NOT_FOUND' using errcode='42501';end if;
 with page as(select * from public.support_messages where ticket_id=p_ticket and (staff or not internal) and (p_before is null or id<p_before) order by id desc limit 50)
 select jsonb_build_object('ticket',public.support_summary(p_ticket,u,staff),'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'authorKind',m.author_kind,'internal',m.internal,'mine',m.author_id=u,'createdAt',m.created_at,
 'author',case when m.internal or staff then coalesce(a.email,'Cont eliminat') when m.author_kind='staff' then 'Echipa TIKINTERACT' else 'Tu' end) order by m.id) from page m left join auth.users a on a.id=m.author_id),'[]'::jsonb),
 'hasMore',exists(select 1 from public.support_messages where ticket_id=p_ticket and (staff or not internal) and id<(select min(id) from page))) into result;
 return result;
end $$;

create or replace function public.mark_support_read(p_ticket uuid,p_seen bigint) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.support_require_account();staff boolean:=public.support_is_staff();last_id bigint;
begin
 if not exists(select 1 from public.support_tickets where id=p_ticket and (owner_id=u or staff)) then raise exception 'SUPPORT_NOT_FOUND' using errcode='42501';end if;
 select coalesce(max(id),0) into last_id from public.support_messages where ticket_id=p_ticket and (staff or not internal);
 insert into public.support_reads(ticket_id,user_id,last_seen_id) values(p_ticket,u,greatest(0,least(coalesce(p_seen,0),last_id)))
 on conflict(ticket_id,user_id) do update set last_seen_id=greatest(public.support_reads.last_seen_id,excluded.last_seen_id);
end $$;

create or replace function public.create_support_ticket(p_topic text,p_subject text,p_body text,p_area text default '',p_request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.support_require_account();tid uuid;
begin
 if p_request_id is null or p_topic is null or p_topic not in ('game','bug','idea','question') or p_subject is null or length(trim(p_subject)) not between 5 and 120 or p_body is null or length(trim(p_body)) not between 20 and 4000 or p_area is null or length(p_area)>80 then raise exception 'SUPPORT_INVALID_MESSAGE';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,723));
 select id into tid from public.support_tickets where owner_id=u and client_id=p_request_id;
 if tid is not null then return public.get_support_thread(tid);end if;
 if (select count(*) from public.support_tickets where owner_id=u and created_at>now()-interval '1 hour')>=10 then raise exception 'SUPPORT_RATE_LIMIT';end if;
 insert into public.support_tickets(owner_id,client_id,topic,subject,area) values(u,p_request_id,p_topic,trim(p_subject),trim(p_area)) returning id into tid;
 insert into public.support_messages(ticket_id,author_id,author_kind,body,client_id) values(tid,u,'customer',trim(p_body),p_request_id);
 return public.get_support_thread(tid);
end $$;

create or replace function public.send_support_message(p_ticket uuid,p_body text,p_internal boolean default false,p_request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.support_require_account();staff boolean:=public.support_is_staff();t public.support_tickets;
begin
 if p_request_id is null or p_body is null or length(trim(p_body)) not between 1 and 4000 or p_internal is null then raise exception 'SUPPORT_INVALID_MESSAGE';end if;
 if p_internal and not staff then raise exception 'SUPPORT_STAFF_REQUIRED' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,723));
 select * into t from public.support_tickets where id=p_ticket and (owner_id=u or staff) for update;
 if t.id is null then raise exception 'SUPPORT_NOT_FOUND' using errcode='42501';end if;
 if exists(select 1 from public.support_messages where ticket_id=p_ticket and author_id=u and client_id=p_request_id) then return public.get_support_thread(p_ticket);end if;
 if (select count(*) from public.support_messages where author_id=u and created_at>now()-interval '1 hour')>=(case when staff then 300 else 60 end) then raise exception 'SUPPORT_RATE_LIMIT';end if;
 insert into public.support_messages(ticket_id,author_id,author_kind,body,internal,client_id) values(p_ticket,u,case when staff then 'staff' else 'customer' end,trim(p_body),p_internal,p_request_id);
 update public.support_tickets set updated_at=clock_timestamp(),public_updated_at=case when p_internal then public_updated_at else clock_timestamp() end,
  state=case when p_internal then state when staff then 'pending' else 'open' end,version=version+1 where id=p_ticket;
 return public.get_support_thread(p_ticket);
end $$;

create or replace function public.update_support_ticket(p_ticket uuid,p_state text,p_priority text,p_assigned uuid,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.support_tickets;
begin
 perform public.support_require_account();
 if not public.support_is_staff() then raise exception 'SUPPORT_STAFF_REQUIRED' using errcode='42501';end if;
 if p_state is null or p_state not in ('open','pending','resolved') or p_priority is null or p_priority not in ('normal','high','urgent') then raise exception 'SUPPORT_INVALID_STATE';end if;
 if p_assigned is not null and not exists(select 1 from public.site_admins where user_id=p_assigned and role in ('owner','admin')) then raise exception 'SUPPORT_INVALID_ASSIGNEE';end if;
 select * into t from public.support_tickets where id=p_ticket for update;
 if t.id is null then raise exception 'SUPPORT_NOT_FOUND';end if;
 if p_version is null or t.version<>p_version then raise exception 'SUPPORT_CONFLICT';end if;
 update public.support_tickets set state=p_state,priority=p_priority,assigned_to=p_assigned,version=version+1,
  updated_at=clock_timestamp(),public_updated_at=case when t.state<>p_state then clock_timestamp() else public_updated_at end where id=p_ticket;
 return public.get_support_thread(p_ticket);
end $$;

revoke all on function public.support_is_staff(),public.support_require_account(),public.support_summary(uuid,uuid,boolean),public.list_support_team(),public.list_support_tickets(text,text,integer,integer),public.get_support_thread(uuid,bigint),public.mark_support_read(uuid,bigint),public.create_support_ticket(text,text,text,text,uuid),public.send_support_message(uuid,text,boolean,uuid),public.update_support_ticket(uuid,text,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.list_support_team(),public.list_support_tickets(text,text,integer,integer),public.get_support_thread(uuid,bigint),public.mark_support_read(uuid,bigint),public.create_support_ticket(text,text,text,text,uuid),public.send_support_message(uuid,text,boolean,uuid),public.update_support_ticket(uuid,text,text,uuid,bigint) to authenticated;
notify pgrst,'reload schema';

commit;
