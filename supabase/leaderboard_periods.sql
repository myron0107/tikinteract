create index if not exists streamer_gift_events_user_created_at_idx
    on public.streamer_gift_events (user_id, created_at);

create index if not exists streamer_live_sessions_user_started_ended_idx
    on public.streamer_live_sessions (user_id, started_at, ended_at);

create or replace function public.get_streamer_leaderboard(p_period text)
returns table (
    tiktok_username text,
    tiktok_display_name text,
    avatar_url text,
    total_coins bigint,
    total_live_seconds bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := statement_timestamp();
    v_cutoff timestamptz;
begin
    if p_period is null or p_period not in ('all', '24h', '7d', '30d') then
        raise exception 'Unsupported leaderboard period';
    end if;

    v_cutoff := case p_period
        when '24h' then v_now - interval '24 hours'
        when '7d' then v_now - interval '7 days'
        when '30d' then v_now - interval '30 days'
        else null
    end;

    return query
    with leaderboard_rows as (
        select
            p.tiktok_username,
            p.tiktok_display_name,
            p.avatar_url,
            case
                when p_period = 'all' then p.total_coins
                else coalesce(gifts.period_coins, 0)
            end as total_coins,
            case
                when p_period = 'all' then p.total_live_seconds
                else coalesce(live.period_live_seconds, 0)
            end as total_live_seconds
        from public.streamer_profiles p
        left join lateral (
            select sum(g.coins)::bigint as period_coins
            from public.streamer_gift_events g
            where g.user_id = p.user_id
              and g.created_at >= v_cutoff
              and g.created_at <= v_now
        ) gifts on p_period <> 'all'
        left join lateral (
            select sum(
                greatest(
                    0,
                    floor(extract(epoch from (
                        least(coalesce(s.ended_at, v_now), v_now)
                        - greatest(s.started_at, v_cutoff)
                    )))::bigint
                )
            )::bigint as period_live_seconds
            from public.streamer_live_sessions s
            where s.user_id = p.user_id
              and s.started_at < v_now
              and coalesce(s.ended_at, v_now) > v_cutoff
        ) live on p_period <> 'all'
        where p.is_public
    )
    select
        leaderboard_rows.tiktok_username,
        leaderboard_rows.tiktok_display_name,
        leaderboard_rows.avatar_url,
        leaderboard_rows.total_coins,
        leaderboard_rows.total_live_seconds
    from leaderboard_rows
    where p_period = 'all'
       or leaderboard_rows.total_coins > 0
       or leaderboard_rows.total_live_seconds > 0
    order by leaderboard_rows.total_coins desc, leaderboard_rows.total_live_seconds desc
    limit 100;
end;
$$;

revoke all on function public.get_streamer_leaderboard(text) from public;
grant execute on function public.get_streamer_leaderboard(text) to anon, authenticated;

notify pgrst, 'reload schema';
