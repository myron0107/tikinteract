-- Run once in Supabase SQL Editor. Rerunnable; never overwrites existing settings.
begin;
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
commit;
