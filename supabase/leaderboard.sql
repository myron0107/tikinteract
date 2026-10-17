create table if not exists public.streamer_profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    tiktok_username text not null,
    tiktok_display_name text not null,
    avatar_url text,
    is_public boolean not null default false,
    total_coins bigint not null default 0 check (total_coins >= 0),
    total_live_seconds bigint not null default 0 check (total_live_seconds >= 0),
    updated_at timestamptz not null default now(),
    constraint streamer_profiles_tiktok_username_format
        check (tiktok_username ~ '^[A-Za-z0-9._]{2,24}$')
);

create unique index if not exists streamer_profiles_tiktok_username_lower_idx
    on public.streamer_profiles (lower(tiktok_username));

create table if not exists public.streamer_live_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    tiktok_username text not null,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    duration_seconds bigint not null default 0 check (duration_seconds >= 0),
    total_coins bigint not null default 0 check (total_coins >= 0),
    constraint streamer_live_sessions_end_after_start
        check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists streamer_live_sessions_one_active_per_user_idx
    on public.streamer_live_sessions (user_id)
    where ended_at is null;

create table if not exists public.streamer_gift_events (
    event_id uuid primary key,
    session_id uuid not null references public.streamer_live_sessions (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    coins integer not null check (coins > 0 and coins <= 1000000),
    created_at timestamptz not null default now()
);

create index if not exists streamer_profiles_public_leaderboard_idx
    on public.streamer_profiles (total_coins desc, total_live_seconds desc)
    where is_public;

alter table public.streamer_profiles enable row level security;
alter table public.streamer_live_sessions enable row level security;
alter table public.streamer_gift_events enable row level security;

drop policy if exists "Public leaderboard profiles are readable" on public.streamer_profiles;
create policy "Public leaderboard profiles are readable"
    on public.streamer_profiles
    for select
    to anon, authenticated
    using (is_public or user_id = (select auth.uid()));

revoke all on public.streamer_profiles from anon, authenticated;
grant select on public.streamer_profiles to anon, authenticated;
revoke all on public.streamer_live_sessions from anon, authenticated;
revoke all on public.streamer_gift_events from anon, authenticated;

create or replace function public.save_my_streamer_profile(
    p_tiktok_username text,
    p_tiktok_display_name text,
    p_avatar_url text,
    p_is_public boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_username text := regexp_replace(trim(coalesce(p_tiktok_username, '')), '^@', '');
    v_display_name text := left(trim(coalesce(p_tiktok_display_name, '')), 80);
    v_avatar_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if v_username !~ '^[A-Za-z0-9._]{2,24}$' then
        raise exception 'Invalid TikTok username';
    end if;

    if v_display_name = '' then
        v_display_name := v_username;
    end if;

    if v_avatar_url is not null and v_avatar_url !~ '^https://[^[:space:]]+$' then
        raise exception 'Avatar URL must use HTTPS';
    end if;

    insert into public.streamer_profiles (
        user_id, tiktok_username, tiktok_display_name, avatar_url, is_public, updated_at
    )
    values (
        v_user_id, v_username, v_display_name, v_avatar_url, coalesce(p_is_public, false), now()
    )
    on conflict (user_id) do update
    set tiktok_username = excluded.tiktok_username,
        tiktok_display_name = excluded.tiktok_display_name,
        avatar_url = coalesce(excluded.avatar_url, public.streamer_profiles.avatar_url),
        is_public = excluded.is_public,
        updated_at = now();
end;
$$;

create or replace function public.start_my_live_session(p_tiktok_username text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_username text := regexp_replace(trim(coalesce(p_tiktok_username, '')), '^@', '');
    v_session_id uuid;
    v_now timestamptz := now();
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    perform 1
    from public.streamer_profiles
    where user_id = v_user_id and lower(tiktok_username) = lower(v_username)
    for update;

    if not found then
        raise exception 'Save this TikTok username to your profile before starting a LIVE session';
    end if;

    with closed as (
        update public.streamer_live_sessions
        set ended_at = v_now,
            duration_seconds = greatest(0, floor(extract(epoch from (v_now - started_at)))::bigint)
        where user_id = v_user_id and ended_at is null
        returning duration_seconds
    )
    update public.streamer_profiles p
    set total_live_seconds = p.total_live_seconds + coalesce((select sum(duration_seconds) from closed), 0),
        updated_at = v_now
    where p.user_id = v_user_id;

    insert into public.streamer_live_sessions (user_id, tiktok_username, started_at)
    values (v_user_id, v_username, v_now)
    returning id into v_session_id;

    return v_session_id;
end;
$$;

create or replace function public.finish_my_live_session()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_now timestamptz := now();
    v_duration bigint;
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    update public.streamer_live_sessions
    set ended_at = v_now,
        duration_seconds = greatest(0, floor(extract(epoch from (v_now - started_at)))::bigint)
    where user_id = v_user_id and ended_at is null
    returning duration_seconds into v_duration;

    if found then
        update public.streamer_profiles
        set total_live_seconds = total_live_seconds + v_duration,
            updated_at = v_now
        where user_id = v_user_id;
    end if;
end;
$$;

create or replace function public.record_my_live_gift(p_event_id uuid, p_coins integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_session_id uuid;
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if p_event_id is null or p_coins is null or p_coins <= 0 or p_coins > 1000000 then
        raise exception 'Invalid gift event';
    end if;

    select id into v_session_id
    from public.streamer_live_sessions
    where user_id = v_user_id and ended_at is null
    for update;

    if v_session_id is null then
        raise exception 'No active TikInteract LIVE session';
    end if;

    insert into public.streamer_gift_events (event_id, session_id, user_id, coins)
    values (p_event_id, v_session_id, v_user_id, p_coins)
    on conflict (event_id) do nothing;

    if not found then
        return false;
    end if;

    update public.streamer_live_sessions
    set total_coins = total_coins + p_coins
    where id = v_session_id;

    update public.streamer_profiles
    set total_coins = total_coins + p_coins,
        updated_at = now()
    where user_id = v_user_id;

    return true;
end;
$$;

revoke all on function public.save_my_streamer_profile(text, text, text, boolean) from public;
revoke all on function public.start_my_live_session(text) from public;
revoke all on function public.finish_my_live_session() from public;
revoke all on function public.record_my_live_gift(uuid, integer) from public;
grant execute on function public.save_my_streamer_profile(text, text, text, boolean) to authenticated;
grant execute on function public.start_my_live_session(text) to authenticated;
grant execute on function public.finish_my_live_session() to authenticated;
grant execute on function public.record_my_live_gift(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
