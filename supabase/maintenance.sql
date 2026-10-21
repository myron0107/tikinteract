-- Run AFTER install-admin.sql (or admin.sql, access-keys.sql and users.sql).
-- Additive, rerunnable. Existing accounts, prices and subscriptions are preserved.
begin;
do $$ begin
 if to_regprocedure('public.require_site_account()') is null or to_regclass('public.account_access_grants') is null then
  raise exception 'Run supabase/install-admin.sql first (admin, access keys and users).';
 end if;
end $$;

create table if not exists public.site_maintenance_settings(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
insert into public.site_maintenance_settings(singleton) values(true) on conflict do nothing;
create table if not exists public.site_preview_invites(
 id uuid primary key default gen_random_uuid(), code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
 label text not null check(length(label) between 1 and 100),
 hours integer not null check(hours between 1 and 168),
 plan text not null check(plan in ('free','play_pass','play_pass_pro')),
 redeem_before timestamptz not null, created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 claim_hash text, claimed_at timestamptz, used_at timestamptz, revoked_at timestamptz
);
create table if not exists public.site_preview_guests(
 user_id uuid primary key references auth.users(id) on delete cascade,
 invite_id uuid not null unique references public.site_preview_invites(id),
 expires_at timestamptz not null,
 access_key_id uuid references public.access_keys(id)
);
create table if not exists public.site_preview_sessions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('owner','guest')),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.site_preview_limits(
 client_hash text primary key, started_at timestamptz not null, attempts integer not null
);
alter table public.site_maintenance_settings enable row level security;
alter table public.site_preview_invites enable row level security;
alter table public.site_preview_guests enable row level security;
alter table public.site_preview_sessions enable row level security;
alter table public.site_preview_limits enable row level security;
revoke all on public.site_maintenance_settings,public.site_preview_invites,public.site_preview_guests,public.site_preview_sessions,public.site_preview_limits from public,anon,authenticated;

-- Server-owned app_metadata identifies temporary identities; users cannot set it.
create or replace function public.is_site_preview_active(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user and (
  coalesce(u.raw_app_meta_data->>'site_preview','false')<>'true'
  or exists(select 1 from public.site_preview_guests g join public.site_preview_invites i on i.id=g.invite_id
   where g.user_id=u.id and g.expires_at>now() and i.used_at is not null and i.revoked_at is null)))
$$;
create or replace function public.is_site_account_allowed(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user and not coalesce(u.is_anonymous,false))
 and public.is_site_preview_active(p_user)
 and not exists(select 1 from public.site_account_controls c where c.user_id=p_user
  and(c.state='banned' or(c.state='suspended' and c.until_date>now())))
$$;
create or replace function public.require_site_account() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();s public.site_account_controls;
begin
 if u is null or not exists(select 1 from auth.users where id=u and not coalesce(is_anonymous,false))
  or not public.is_site_preview_active(u) then raise exception 'ACCOUNT_UNAVAILABLE' using errcode='42501';end if;
 select * into s from public.site_account_controls where user_id=u;
 if s.state='banned' then raise exception 'ACCOUNT_BANNED' using errcode='42501';end if;
 if s.state='suspended' and s.until_date>now() then raise exception 'ACCOUNT_SUSPENDED' using errcode='42501';end if;
 return u;
end $$;
create or replace function public.get_my_account_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();s public.site_account_controls;state text:='active';preview_until timestamptz;
begin
 if u is null or not exists(select 1 from auth.users where id=u and not coalesce(is_anonymous,false))
  or not public.is_site_preview_active(u) then
  return jsonb_build_object('allowed',false,'state','unavailable','until',null,'serverNow',now());
 end if;
 select * into s from public.site_account_controls where user_id=u;
 if s.state='banned' then state:='banned';elsif s.state='suspended' and s.until_date>now() then state:='suspended';end if;
 select expires_at into preview_until from public.site_preview_guests where user_id=u;
 return jsonb_build_object('allowed',state='active','state',state,'until',case when state='suspended' then s.until_date else null end,'previewUntil',preview_until,'serverNow',now());
end $$;

create or replace function public.maintenance_require_owner() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=public.require_site_account();
begin
 if not exists(select 1 from public.site_admins where user_id=u and role='owner') then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 return u;
end $$;
create or replace function public.get_site_maintenance_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.maintenance_require_owner();
 return jsonb_build_object('enabled',(select enabled from public.site_maintenance_settings where singleton),
 'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'label',i.label,'hours',i.hours,'plan',i.plan,'createdAt',i.created_at,
 'redeemBefore',i.redeem_before,'usedAt',i.used_at,'revokedAt',i.revoked_at,'expiresAt',g.expires_at) order by i.created_at desc)
 from (select * from public.site_preview_invites order by created_at desc limit 100) i left join public.site_preview_guests g on g.invite_id=i.id),'[]'::jsonb));
end $$;
create or replace function public.set_site_maintenance(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.maintenance_require_owner();
begin
 if p_enabled is null then raise exception 'INVALID_OPTIONS';end if;
 update public.site_maintenance_settings set enabled=p_enabled,updated_at=now(),updated_by=actor where singleton;
 return public.get_site_maintenance_state();
end $$;
create or replace function public.create_site_preview_invite(p_code_hash text,p_label text,p_hours integer,p_plan text,p_redeem_days integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.maintenance_require_owner();result uuid;
begin
 if p_code_hash is null or p_code_hash!~'^[a-f0-9]{64}$' or length(trim(coalesce(p_label,''))) not between 1 and 100
  or p_hours is null or p_hours not between 1 and 168 or p_plan is null or p_plan not in ('free','play_pass','play_pass_pro')
  or p_redeem_days is null or p_redeem_days not between 1 and 30 then raise exception 'INVALID_OPTIONS';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,902));
 if(select count(*) from public.site_preview_invites where created_by=actor and created_at>now()-interval '1 hour')>=30 then raise exception 'GENERATION_LIMIT';end if;
 insert into public.site_preview_invites(code_hash,label,hours,plan,redeem_before,created_by)
 values(p_code_hash,trim(p_label),p_hours,p_plan,now()+make_interval(days=>p_redeem_days),actor) returning id into result;
 return result;
end $$;
create or replace function public.revoke_site_preview_invite(p_invite uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.maintenance_require_owner();
 update public.site_preview_invites set revoked_at=coalesce(revoked_at,now()) where id=p_invite;
 update public.site_preview_sessions set revoked_at=coalesce(revoked_at,now()) where user_id in(select user_id from public.site_preview_guests where invite_id=p_invite);
 update public.account_access_grants set revoked_at=coalesce(revoked_at,now()) where source_key in(select access_key_id from public.site_preview_guests where invite_id=p_invite);
end $$;
create or replace function public.create_site_owner_session(p_token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.maintenance_require_owner();deadline timestamptz:=now()+interval '24 hours';
begin
 if p_token_hash is null or p_token_hash!~'^[a-f0-9]{64}$' then raise exception 'INVALID_OPTIONS';end if;
 insert into public.site_preview_sessions(user_id,kind,token_hash,expires_at) values(actor,'owner',p_token_hash,deadline);
 return jsonb_build_object('expiresAt',deadline,'kind','owner');
end $$;

-- Only server functions may reserve/consume an invite or look up an opaque cookie.
create or replace function public.reserve_site_preview(p_code_hash text,p_claim_hash text,p_client_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.site_preview_invites;l public.site_preview_limits;
begin
 if p_code_hash is null or p_code_hash!~'^[a-f0-9]{64}$' or p_claim_hash is null or p_claim_hash!~'^[a-f0-9]{64}$'
  or p_client_hash is null or p_client_hash!~'^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'code','INVALID_INVITE');end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_hash,903));
 insert into public.site_preview_limits(client_hash,started_at,attempts) values(p_client_hash,now(),1)
 on conflict(client_hash) do update set started_at=case when site_preview_limits.started_at<now()-interval '1 minute' then now() else site_preview_limits.started_at end,
 attempts=case when site_preview_limits.started_at<now()-interval '1 minute' then 1 else site_preview_limits.attempts+1 end returning * into l;
 if l.attempts>10 then return jsonb_build_object('ok',false,'code','RATE_LIMIT');end if;
 select * into i from public.site_preview_invites where code_hash=p_code_hash for update;
 if not found or i.revoked_at is not null or i.used_at is not null or i.redeem_before<=now()
  or(i.claimed_at is not null and i.claimed_at>now()-interval '2 minutes') then return jsonb_build_object('ok',false,'code','INVALID_INVITE');end if;
 update public.site_preview_invites set claim_hash=p_claim_hash,claimed_at=now() where id=i.id;
 return jsonb_build_object('ok',true,'id',i.id,'label',i.label);
end $$;
create or replace function public.abort_site_preview(p_invite uuid,p_claim_hash text) returns void
language sql security definer set search_path='' as $$
 update public.site_preview_invites set claim_hash=null,claimed_at=null where id=p_invite and claim_hash=p_claim_hash and used_at is null
$$;
create or replace function public.complete_site_preview(p_invite uuid,p_claim_hash text,p_user uuid,p_token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.site_preview_invites;deadline timestamptz;key_id uuid;
begin
 select * into i from public.site_preview_invites where id=p_invite for update;
 if not found or i.claim_hash is distinct from p_claim_hash or i.claimed_at<now()-interval '2 minutes' or i.used_at is not null or i.revoked_at is not null or i.redeem_before<=now() then raise exception 'INVALID_INVITE';end if;
 if p_token_hash is null or p_token_hash!~'^[a-f0-9]{64}$' or not exists(select 1 from auth.users where id=p_user and raw_app_meta_data->>'site_preview'='true') then raise exception 'INVALID_GUEST';end if;
 deadline:=now()+make_interval(hours=>i.hours);
 if i.plan<>'free' then
  insert into public.access_keys(batch_id,key_hash,key_hint,plan,months,label,redeem_before,created_by,redeemed_by,redeemed_at)
  values(i.id,p_token_hash,'PREVIEW',i.plan,1,'Temporary preview: '||i.label,deadline,i.created_by,p_user,now()) returning id into key_id;
  insert into public.account_access_grants(user_id,source_key,plan,starts_at,ends_at) values(p_user,key_id,i.plan,now(),deadline);
 end if;
 insert into public.site_preview_guests(user_id,invite_id,expires_at,access_key_id) values(p_user,i.id,deadline,key_id);
 insert into public.site_preview_sessions(user_id,kind,token_hash,expires_at) values(p_user,'guest',p_token_hash,deadline);
 update public.site_preview_invites set used_at=now(),claim_hash=null,claimed_at=null where id=i.id;
 return jsonb_build_object('kind','guest','expiresAt',deadline);
end $$;
create or replace function public.get_site_preview_gate(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.site_preview_sessions;valid boolean:=false;enabled boolean;
begin
 select m.enabled into enabled from public.site_maintenance_settings m where singleton;
 if enabled is null then raise exception 'MAINTENANCE_NOT_INSTALLED';end if;
 select * into s from public.site_preview_sessions where token_hash=p_token_hash;
 if found and s.revoked_at is null and s.expires_at>now() and public.is_site_account_allowed(s.user_id) then
  valid:=case when s.kind='owner' then exists(select 1 from public.site_admins where user_id=s.user_id and role='owner') else exists(select 1 from public.site_preview_guests where user_id=s.user_id) end;
 end if;
 return jsonb_build_object('enabled',enabled,'valid',valid,'allowed',not enabled or valid,'kind',s.kind,'expiresAt',s.expires_at);
end $$;
create or replace function public.close_site_preview_session(p_token_hash text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.site_preview_sessions;
begin
 select * into s from public.site_preview_sessions where token_hash=p_token_hash for update;
 if not found then return;end if;
 update public.site_preview_sessions set revoked_at=coalesce(revoked_at,now()) where id=s.id;
 if s.kind='guest' then
  update public.site_preview_invites set revoked_at=coalesce(revoked_at,now()) where id in(select invite_id from public.site_preview_guests where user_id=s.user_id);
  update public.account_access_grants set revoked_at=coalesce(revoked_at,now()) where user_id=s.user_id;
 end if;
end $$;

revoke all on function public.is_site_preview_active(uuid),public.maintenance_require_owner(),public.get_site_maintenance_state(),public.set_site_maintenance(boolean),public.create_site_preview_invite(text,text,integer,text,integer),public.revoke_site_preview_invite(uuid),public.create_site_owner_session(text),public.reserve_site_preview(text,text,text),public.abort_site_preview(uuid,text),public.complete_site_preview(uuid,text,uuid,text),public.get_site_preview_gate(text),public.close_site_preview_session(text) from public,anon,authenticated;
grant execute on function public.is_site_preview_active(uuid),public.get_site_maintenance_state(),public.set_site_maintenance(boolean),public.create_site_preview_invite(text,text,integer,text,integer),public.revoke_site_preview_invite(uuid),public.create_site_owner_session(text) to authenticated;
grant execute on function public.reserve_site_preview(text,text,text),public.abort_site_preview(uuid,text),public.complete_site_preview(uuid,text,uuid,text),public.get_site_preview_gate(text),public.close_site_preview_session(text) to service_role;

-- Expired/revoked preview identities also lose direct table access, even with a
-- still-valid Auth JWT. Existing permissive RLS policies remain in place.
do $$ declare t record;begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity loop
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t.relname and policyname='site_preview_expiry_guard') then
   execute format('create policy site_preview_expiry_guard on public.%I as restrictive for all to authenticated using(public.is_site_preview_active(auth.uid())) with check(public.is_site_preview_active(auth.uid()))',t.relname);
  end if;
 end loop;
end $$;
commit;
