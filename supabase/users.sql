-- Run after admin.sql (and after support/access-keys/leaderboard when installed).
-- Owner-only user directory and moderation. No real accounts are changed during installation.
begin;
do $$ begin
 if to_regprocedure('public.site_admin_role()') is null then raise exception 'Rulează mai întâi supabase/admin.sql sau install-admin.sql.';end if;
end $$;
create table if not exists public.site_account_controls(
 user_id uuid primary key references auth.users(id) on delete cascade,
 state text not null default 'active' check(state in ('active','suspended','banned')),
 until_date timestamptz,
 reason text not null default '' check(length(reason)<=500),
 version bigint not null default 0,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 check(state<>'suspended' or until_date is not null)
);
create table if not exists public.site_user_audit(
 id bigint generated always as identity primary key,
 target_id uuid not null,
 actor uuid references auth.users(id) on delete set null,
 action text not null check(action in ('role','suspend','ban','restore','delete')),
 reason text not null check(length(reason) between 5 and 500),
 before_state jsonb not null default '{}'::jsonb,
 after_state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists site_user_audit_target_idx on public.site_user_audit(target_id,id desc);
alter table public.site_account_controls enable row level security;
alter table public.site_user_audit enable row level security;
revoke all on public.site_account_controls,public.site_user_audit from anon,authenticated;

-- Private helper: a deleted account's still-unexpired JWT must fail too.
create or replace function public.is_site_account_allowed(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user and not coalesce(u.is_anonymous,false))
 and not exists(select 1 from public.site_account_controls c where c.user_id=p_user
  and (c.state='banned' or(c.state='suspended' and c.until_date>now())))
$$;
create or replace function public.require_site_account() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();s public.site_account_controls;
begin
 if u is null or not exists(select 1 from auth.users where id=u and not coalesce(is_anonymous,false)) then raise exception 'ACCOUNT_UNAVAILABLE' using errcode='42501';end if;
 select * into s from public.site_account_controls where user_id=u;
 if s.state='banned' then raise exception 'ACCOUNT_BANNED' using errcode='42501';end if;
 if s.state='suspended' and s.until_date>now() then raise exception 'ACCOUNT_SUSPENDED' using errcode='42501';end if;
 return u;
end $$;
create or replace function public.get_my_account_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();s public.site_account_controls;state text:='active';
begin
 if u is null or not exists(select 1 from auth.users where id=u and not coalesce(is_anonymous,false)) then
  return jsonb_build_object('allowed',false,'state','unavailable','until',null,'serverNow',now());
 end if;
 select * into s from public.site_account_controls where user_id=u;
 if s.state='banned' then state:='banned';elsif s.state='suspended' and s.until_date>now() then state:='suspended';end if;
 return jsonb_build_object('allowed',state='active','state',state,'until',case when state='suspended' then s.until_date else null end,'serverNow',now());
end $$;
create or replace function public.site_admin_role() returns text
language sql stable security definer set search_path='' as $$
 select role from public.site_admins where user_id=auth.uid() and public.is_site_account_allowed(auth.uid())
$$;

-- Internal projection avoids exposing password hashes, tokens, phone numbers or arbitrary auth metadata.
create or replace function public.site_user_row(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u jsonb;c public.site_account_controls;r text;name text;state text;plan text:='free';expiry timestamptz;profile jsonb;
begin
 select to_jsonb(a) into u from auth.users a where a.id=p_user;
 if u is null then return null;end if;
 select * into c from public.site_account_controls where user_id=p_user;
 select role into r from public.site_admins where user_id=p_user;
 state:=case when c.state='banned' then 'banned' when c.state='suspended' and c.until_date>now() then 'suspended' else 'active' end;
 name:=coalesce(nullif(u->'raw_user_meta_data'->>'display_name',''),nullif(u->'raw_user_meta_data'->>'full_name',''),nullif(u->'raw_user_meta_data'->>'name',''),split_part(u->>'email','@',1),'Utilizator');
 if to_regclass('public.account_access_grants') is not null then
  select g.plan,g.ends_at into plan,expiry from public.account_access_grants g where g.user_id=p_user and g.revoked_at is null and g.starts_at<=now() and g.ends_at>now()
   order by case when g.plan='play_pass_pro' then 2 else 1 end desc,g.ends_at desc limit 1;
 end if;
 if to_regclass('public.streamer_profiles') is not null then select to_jsonb(p) into profile from public.streamer_profiles p where p.user_id=p_user;end if;
 return jsonb_build_object('id',p_user,'email',u->>'email','name',left(name,100),'avatar',coalesce(u->'raw_user_meta_data'->>'avatar_url',u->'raw_user_meta_data'->>'picture'),
  'role',coalesce(r,'user'),'state',state,'until',case when state='suspended' then c.until_date else null end,'reason',coalesce(c.reason,''),'version',coalesce(c.version,0),
  'confirmed',u->>'email_confirmed_at' is not null,'anonymous',coalesce((u->>'is_anonymous')::boolean,false),'createdAt',u->>'created_at','lastSignInAt',u->>'last_sign_in_at',
  'provider',coalesce(u->'raw_app_meta_data'->>'provider','email'),'plan',coalesce(plan,'free'),'planUntil',expiry,
  'tiktok',profile->>'tiktok_username','coins',profile->'total_coins','liveSeconds',profile->'total_live_seconds');
end $$;
create or replace function public.list_site_users(p_search text default '',p_role text default 'all',p_state text default 'all',p_limit integer default 30,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tiktok_matches uuid[];
begin
 if public.site_admin_role() is distinct from 'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 if p_search is null or length(p_search)>120 or p_role is null or p_role not in ('all','owner','admin','editor','user') or p_state is null or p_state not in ('all','active','suspended','banned','unconfirmed') or p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 or p_offset>1000000 then raise exception 'USERS_INVALID_FILTER';end if;
 if p_search<>'' and to_regclass('public.streamer_profiles') is not null then
  select array_agg(user_id) into tiktok_matches from public.streamer_profiles where strpos(lower(tiktok_username),lower(p_search))>0;
 end if;
 -- Filter simple identity rows first; load profile/plan details only for the visible page.
 return(with records as(
  select u.id,u.email,u.email_confirmed_at is not null confirmed,coalesce(a.role,'user') role,
   case when c.state='banned' then 'banned' when c.state='suspended' and c.until_date>now() then 'suspended' else 'active' end state,
   to_jsonb(u)->>'created_at' created,
   coalesce(to_jsonb(u)->'raw_user_meta_data'->>'display_name','')||' '||coalesce(to_jsonb(u)->'raw_user_meta_data'->>'full_name','')||' '||coalesce(to_jsonb(u)->'raw_user_meta_data'->>'name','') name
  from auth.users u left join public.site_admins a on a.user_id=u.id left join public.site_account_controls c on c.user_id=u.id
 ),filtered as(
  select * from records r where(p_role='all' or r.role=p_role) and(p_state='all' or r.state=p_state or(p_state='unconfirmed' and not confirmed))
   and(p_search='' or strpos(lower(coalesce(r.email,'')||' '||r.name||' '||r.id::text),lower(p_search))>0 or r.id=any(coalesce(tiktok_matches,'{}'::uuid[])))
 ),page as(select id,created from filtered order by created desc nulls last,id limit p_limit offset p_offset)
 select jsonb_build_object('total',(select count(*) from filtered),'stats',jsonb_build_object('total',(select count(*) from records),'confirmed',(select count(*) from records where confirmed),
  'staff',(select count(*) from records where role<>'user'),'suspended',(select count(*) from records where state='suspended'),'banned',(select count(*) from records where state='banned')),
 'items',coalesce((select jsonb_agg(public.site_user_row(id) order by created desc nulls last,id) from page),'[]'::jsonb)));
end $$;
create or replace function public.get_site_user(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;counts jsonb:='{}'::jsonb;name text;column_name text;n bigint;storage_count bigint:=0;
begin
 if public.site_admin_role() is distinct from 'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 result:=public.site_user_row(p_user);if result is null then raise exception 'USER_NOT_FOUND';end if;
 foreach name in array array['streamer_profiles','streamer_live_sessions','streamer_gift_events','streamer_gift_collection_events','support_tickets','account_access_grants'] loop
  n:=null;
  if to_regclass('public.'||name) is not null then
   column_name:=case when name='support_tickets' then 'owner_id' else 'user_id' end;
   execute format('select count(*) from public.%I where %I=$1',name,column_name) into n using p_user;
  end if;
  counts:=counts||jsonb_build_object(name,n);
 end loop;
 if to_regclass('public.access_keys') is not null then
  select count(*) into n from public.access_keys k where k.redeemed_by=p_user or lower(k.bound_email)=lower(result->>'email');
  counts:=counts||jsonb_build_object('access_keys',n);
 end if;
 if to_regclass('storage.objects') is not null then
  select count(*) into storage_count from storage.objects o where coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner')=p_user::text;
 end if;
 return jsonb_build_object('user',result,'linked',counts,'storageObjects',storage_count,'audit',coalesce((select jsonb_agg(x order by x.id desc) from(
  select e.id,e.action,e.reason,e.before_state,e.after_state,e.created_at,a.email actor from public.site_user_audit e left join auth.users a on a.id=e.actor where e.target_id=p_user order by e.id desc limit 30)x),'[]'::jsonb));
end $$;

create or replace function public.set_site_user_role(p_user uuid,p_role text,p_reason text,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();target auth.users;old_role text;v bigint;
begin
 perform pg_advisory_xact_lock(74038102);
 if public.site_admin_role() is distinct from 'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 if p_role is null or p_role not in ('user','editor','admin','owner') or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'USERS_INVALID_ACTION';end if;
 select * into target from auth.users where id=p_user for update;
 if target.id is null then raise exception 'USER_NOT_FOUND';end if;
 select coalesce(version,0) into v from public.site_account_controls where user_id=p_user;v:=coalesce(v,0);
 if p_version is distinct from v then raise exception 'USER_CONFLICT';end if;
 if p_role<>'user' and (target.email_confirmed_at is null or coalesce(target.is_anonymous,false) or not public.is_site_account_allowed(p_user)) then raise exception 'USER_ROLE_INELIGIBLE';end if;
 select role into old_role from public.site_admins where user_id=p_user;
 if old_role='owner' and p_role<>'owner' and(select count(*) from public.site_admins where role='owner')<=1 then raise exception 'OWNER_PROTECTED';end if;
 if p_role='user' then delete from public.site_admins where user_id=p_user;
 else insert into public.site_admins(user_id,role) values(p_user,p_role) on conflict(user_id) do update set role=excluded.role;end if;
 insert into public.site_account_controls(user_id,version,updated_by) values(p_user,v+1,actor) on conflict(user_id) do update set version=excluded.version,updated_by=actor,updated_at=now();
 insert into public.site_user_audit(target_id,actor,action,reason,before_state,after_state) values(p_user,actor,'role',trim(p_reason),jsonb_build_object('role',coalesce(old_role,'user')),jsonb_build_object('role',p_role));
 return jsonb_build_object('ok',true,'selfChanged',p_user=actor,'role',p_role);
end $$;
-- Compatibility for existing integrations; still owner-only and fully audited.
create or replace function public.manage_site_admin(p_email text,p_role text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid;v bigint;
begin
 if public.site_admin_role() is distinct from 'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 select id into target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null and not coalesce(is_anonymous,false);
 if target is null then raise exception 'Contul trebuie să existe și să aibă e-mailul confirmat.';end if;
 select coalesce(version,0) into v from public.site_account_controls where user_id=target;
 perform public.set_site_user_role(target,coalesce(p_role,'user'),'Modificare prin integrarea de administrare',coalesce(v,0));
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'email',u.email,'role',a.role) order by a.created_at) from public.site_admins a join auth.users u on u.id=a.user_id),'[]'::jsonb);
end $$;
create or replace function public.moderate_site_user(p_user uuid,p_action text,p_hours integer,p_reason text,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();old jsonb;v bigint;until_date timestamptz;state text;
begin
 perform pg_advisory_xact_lock(74038102);
 if public.site_admin_role() is distinct from 'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 if p_action is null or p_action not in ('suspend','ban','restore') or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'USERS_INVALID_ACTION';end if;
 if p_user=actor then raise exception 'SELF_PROTECTED';end if;
 perform 1 from auth.users where id=p_user for update;if not found then raise exception 'USER_NOT_FOUND';end if;
 if exists(select 1 from public.site_admins where user_id=p_user and role='owner') then raise exception 'OWNER_PROTECTED';end if;
 old:=public.site_user_row(p_user);v:=(old->>'version')::bigint;if p_version is distinct from v then raise exception 'USER_CONFLICT';end if;
 if p_action='suspend' then
  if p_hours is null or p_hours not in (1,24,168,720) then raise exception 'USERS_INVALID_ACTION';end if;
  state:='suspended';until_date:=now()+make_interval(hours=>p_hours);
 elsif p_action='ban' then state:='banned';else state:='active';end if;
 insert into public.site_account_controls(user_id,state,until_date,reason,version,updated_by) values(p_user,state,until_date,trim(p_reason),v+1,actor)
 on conflict(user_id) do update set state=excluded.state,until_date=excluded.until_date,reason=excluded.reason,version=excluded.version,updated_by=actor,updated_at=now();
 insert into public.site_user_audit(target_id,actor,action,reason,before_state,after_state) values(p_user,actor,p_action,trim(p_reason),jsonb_build_object('state',old->'state','until',old->'until'),jsonb_build_object('state',state,'until',until_date));
 return jsonb_build_object('ok',true,'state',state,'until',until_date);
end $$;
create or replace function public.delete_site_user(p_user uuid,p_confirmation text,p_reason text,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();u auth.users;v bigint;owned bigint;
begin
 perform pg_advisory_xact_lock(74038102);
 if public.site_admin_role() is distinct from 'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 if p_user=actor then raise exception 'SELF_PROTECTED';end if;
 select * into u from auth.users where id=p_user for update;if u.id is null then raise exception 'USER_NOT_FOUND';end if;
 if exists(select 1 from public.site_admins where user_id=p_user and role='owner') then raise exception 'OWNER_PROTECTED';end if;
 if lower(trim(coalesce(p_confirmation,'')))<>lower(coalesce(u.email,u.id::text)) or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'USER_DELETE_CONFIRMATION';end if;
 select coalesce(version,0) into v from public.site_account_controls where user_id=p_user;
 if p_version is distinct from coalesce(v,0) then raise exception 'USER_CONFLICT';end if;
 if to_regclass('storage.objects') is not null then
  select count(*) into owned from storage.objects o where coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner')=p_user::text;
  if owned>0 then raise exception 'USER_HAS_STORAGE';end if;
 end if;
 if to_regclass('public.access_keys') is not null then
  with revoked as(
   update public.access_keys set revoked_at=now(),revoked_by=actor
    where revoked_at is null and(redeemed_by=p_user or lower(bound_email)=lower(u.email)) returning id
  ) insert into public.access_key_events(key_id,actor,action) select id,actor,'revoke' from revoked;
  update public.access_keys set bound_email=null where redeemed_by=p_user or lower(bound_email)=lower(u.email);
 end if;
 insert into public.site_user_audit(target_id,actor,action,reason,before_state,after_state) values(p_user,actor,'delete',trim(p_reason),jsonb_build_object('role',coalesce((select role from public.site_admins where user_id=p_user),'user')),jsonb_build_object('deleted',true));
 delete from auth.users where id=p_user;
 return jsonb_build_object('ok',true,'deleted',true);
end $$;

create or replace function public.list_site_user_audit(p_limit integer default 30,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.site_admin_role() is distinct from 'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 or p_offset>1000000 then raise exception 'USERS_INVALID_FILTER';end if;
 return jsonb_build_object('total',(select count(*) from public.site_user_audit),'items',coalesce((select jsonb_agg(x order by x.id desc) from(
  select e.id,e.target_id,u.email target_email,a.email actor,e.action,e.reason,e.before_state,e.after_state,e.created_at from public.site_user_audit e left join auth.users u on u.id=e.target_id left join auth.users a on a.id=e.actor order by e.id desc limit p_limit offset p_offset)x),'[]'::jsonb));
end $$;

revoke all on function public.is_site_account_allowed(uuid),public.require_site_account(),public.site_user_row(uuid),public.get_my_account_status(),public.list_site_users(text,text,text,integer,integer),public.get_site_user(uuid),public.set_site_user_role(uuid,text,text,bigint),public.moderate_site_user(uuid,text,integer,text,bigint),public.delete_site_user(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.get_my_account_status(),public.list_site_users(text,text,text,integer,integer),public.get_site_user(uuid),public.set_site_user_role(uuid,text,text,bigint),public.moderate_site_user(uuid,text,integer,text,bigint),public.delete_site_user(uuid,text,text,bigint) to authenticated;
revoke all on function public.list_site_user_audit(integer,integer) from public,anon;
grant execute on function public.list_site_user_audit(integer,integer) to authenticated;

-- Apply checks inside every installed private write gateway, including existing issued JWTs.
-- Original signatures and grants stay intact; rerunning adds no duplicate checks.
do $$
declare fn record;definition text;
begin
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
  'support_require_account','access_require_user','save_my_streamer_profile','start_my_live_session','finish_my_live_session','record_my_live_gift','record_my_live_gift_details') loop
  definition:=pg_get_functiondef(fn.oid);
  if strpos(definition,'perform public.require_site_account();')=0 then
   definition:=regexp_replace(definition,'\mbegin\M',E'begin\n perform public.require_site_account();','i');execute definition;
  end if;
 end loop;
end $$;
-- Direct profile writes are already revoked. Keep public read behavior for the catalog/leaderboard.
notify pgrst,'reload schema';
commit;
