-- Ruleaza dupa leaderboard.sql (si users.sql, daca este instalat).
-- Verificarea existentei nu dovedeste ca persoana detine contul TikTok.
begin;
create table if not exists public.tiktok_profile_verifications (
 user_id uuid not null references auth.users(id) on delete cascade,
 username text not null check(username ~ '^[a-z0-9._]{2,24}$' and username <> 'numele_tau' and right(username,1) <> '.'),
 display_name text not null,
 avatar_url text,
 verified_at timestamptz not null default now(),
 primary key(user_id,username)
);
create table if not exists public.tiktok_profile_check_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_attempt timestamptz not null,
 window_started timestamptz not null,
 attempts integer not null
);
alter table public.tiktok_profile_verifications enable row level security;
alter table public.tiktok_profile_check_limits enable row level security;
revoke all on public.tiktok_profile_verifications,public.tiktok_profile_check_limits from public,anon,authenticated;

create or replace function public.begin_tiktok_profile_verification(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare previous public.tiktok_profile_check_limits;current_time_value timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_UNAVAILABLE';end if;
 if to_regprocedure('public.is_site_account_allowed(uuid)') is not null then
  if not public.is_site_account_allowed(p_user_id) then raise exception 'ACCOUNT_UNAVAILABLE';end if;
 end if;
 insert into public.tiktok_profile_check_limits values(p_user_id,'epoch','epoch',0) on conflict do nothing;
 select * into previous from public.tiktok_profile_check_limits where user_id=p_user_id for update;
 if previous.last_attempt>current_time_value-interval '3 seconds' or (previous.window_started>current_time_value-interval '1 hour' and previous.attempts>=30) then raise exception 'RATE_LIMITED';end if;
 update public.tiktok_profile_check_limits set last_attempt=current_time_value,
 window_started=case when previous.window_started<=current_time_value-interval '1 hour' then current_time_value else previous.window_started end,
 attempts=case when previous.window_started<=current_time_value-interval '1 hour' then 1 else previous.attempts+1 end where user_id=p_user_id;
end $$;

create or replace function public.confirm_tiktok_profile(p_user_id uuid,p_username text,p_display_name text,p_avatar_url text)
returns void language plpgsql security definer set search_path='' as $$
declare name text:=lower(regexp_replace(trim(coalesce(p_username,'')),'^@',''));
begin
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_UNAVAILABLE';end if;
 if to_regprocedure('public.is_site_account_allowed(uuid)') is not null then
  if not public.is_site_account_allowed(p_user_id) then raise exception 'ACCOUNT_UNAVAILABLE';end if;
 end if;
 if name !~ '^[a-z0-9._]{2,24}$' or name='numele_tau' or right(name,1)='.' then raise exception 'INVALID_USERNAME';end if;
 if p_avatar_url is not null and p_avatar_url !~ '^https://[^[:space:]]+$' then raise exception 'INVALID_AVATAR';end if;
 insert into public.tiktok_profile_verifications(user_id,username,display_name,avatar_url,verified_at)
 values(p_user_id,name,left(coalesce(nullif(trim(p_display_name),''),name),80),p_avatar_url,now())
 on conflict(user_id,username) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url,verified_at=excluded.verified_at;
end $$;

create or replace function public.require_verified_tiktok_profile(p_user_id uuid,p_username text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare profile public.tiktok_profile_verifications;name text:=lower(regexp_replace(trim(coalesce(p_username,'')),'^@',''));
begin
 if to_regprocedure('public.is_site_account_allowed(uuid)') is not null then
  if not public.is_site_account_allowed(p_user_id) then raise exception 'ACCOUNT_UNAVAILABLE';end if;
 end if;
 select * into profile from public.tiktok_profile_verifications where user_id=p_user_id and username=name and verified_at>=now()-interval '10 minutes';
 if not found then raise exception 'TIKTOK_PROFILE_NOT_VERIFIED';end if;
 return jsonb_build_object('username',profile.username,'displayName',profile.display_name,'avatarUrl',profile.avatar_url);
end $$;
revoke all on function public.begin_tiktok_profile_verification(uuid),public.confirm_tiktok_profile(uuid,text,text,text),public.require_verified_tiktok_profile(uuid,text) from public,anon,authenticated;
grant execute on function public.begin_tiktok_profile_verification(uuid),public.confirm_tiktok_profile(uuid,text,text,text) to service_role;

-- Preserve the current account-moderation checks and the established RPC signature.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.save_my_streamer_profile(text,text,text,boolean)'::regprocedure);
 if strpos(definition,'require_verified_tiktok_profile')=0 then
  definition:=replace(definition,'v_avatar_url text :=',E'v_verified jsonb;\n    v_avatar_url text :=');
  definition:=regexp_replace(definition,'\mbegin\M',E'begin\n    v_verified := public.require_verified_tiktok_profile(auth.uid(), p_tiktok_username);\n    v_username := v_verified->>\'username\';\n    v_display_name := v_verified->>\'displayName\';\n    v_avatar_url := v_verified->>\'avatarUrl\';','i');
  definition:=replace(definition,'coalesce(excluded.avatar_url, public.streamer_profiles.avatar_url)','excluded.avatar_url');
  execute definition;
 end if;
end $$;
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.start_my_live_session(text)'::regprocedure);
 if strpos(definition,'require_verified_tiktok_profile')=0 then
  definition:=regexp_replace(definition,'\mbegin\M',E'begin\n perform public.require_verified_tiktok_profile(auth.uid(), p_tiktok_username);','i');
  execute definition;
 end if;
end $$;
-- Quarantine the old example profile without deleting accounts or activity.
update public.streamer_profiles set is_public=false where lower(tiktok_username)='numele_tau';
notify pgrst,'reload schema';
commit;
