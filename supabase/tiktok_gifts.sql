-- Run after leaderboard.sql and leaderboard_periods.sql. Additive and rerunnable.
begin;

create table if not exists public.streamer_gift_collection_events (
    event_id uuid primary key,
    session_id uuid not null references public.streamer_live_sessions(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    gift_id text not null check (length(gift_id) between 1 and 100),
    gift_name text not null,
    gift_image text,
    quantity integer not null check (quantity between 1 and 1000),
    unit_coins integer not null check (unit_coins between 0 and 1000000),
    coins integer not null check (coins between 0 and 1000000),
    sender text not null default 'Spectator',
    created_at timestamptz not null default now()
);
create index if not exists streamer_gift_collection_recent_idx
    on public.streamer_gift_collection_events(user_id,created_at desc);
create index if not exists streamer_gift_collection_kind_idx
    on public.streamer_gift_collection_events(user_id,gift_id);
alter table public.streamer_gift_collection_events enable row level security;
revoke all on public.streamer_gift_collection_events from anon,authenticated;

-- One transaction records the existing leaderboard total and the gift details.
-- Retrying a UUID never adds its coins/quantity again. Old queued events can be
-- enriched after their original session has ended without changing totals.
create or replace function public.record_my_live_gift_details(
    p_event_id uuid,p_tiktok_username text,p_coins integer,p_gift_id text,
    p_gift_name text,p_gift_image text,p_quantity integer,p_unit_coins integer,p_sender text
)
returns boolean language plpgsql security definer set search_path='' as $$
declare
    v_user uuid:=auth.uid();
    v_session uuid;
    v_coins integer;
    v_created timestamptz;
    v_image text:=nullif(left(trim(coalesce(p_gift_image,'')),2048),'');
begin
    if v_user is null then raise exception 'Authentication required'; end if;
    if p_event_id is null or p_coins is null or p_coins<0 or p_coins>1000000
       or p_quantity is null or p_quantity<1 or p_quantity>1000
       or p_unit_coins is null or p_unit_coins<0 or p_unit_coins>1000000
       or length(trim(coalesce(p_gift_id,''))) not between 1 and 100 then
        raise exception 'Invalid gift details';
    end if;
    perform 1 from public.streamer_profiles
      where user_id=v_user and lower(tiktok_username)=lower(regexp_replace(trim(p_tiktok_username),'^@',''))
      ;
    if not found then raise exception 'This streamer is not linked to your account'; end if;
    if exists(select 1 from public.streamer_gift_collection_events where event_id=p_event_id) then
        return false;
    end if;
    if v_image is not null and v_image !~ '^https://[^[:space:]]+$' then v_image:=null; end if;

    select session_id,coins,created_at into v_session,v_coins,v_created
      from public.streamer_gift_events where event_id=p_event_id and user_id=v_user;
    if v_session is null then
        if p_coins>0 then
            perform public.record_my_live_gift(p_event_id,p_coins);
            select session_id,coins,created_at into v_session,v_coins,v_created
              from public.streamer_gift_events where event_id=p_event_id and user_id=v_user;
        else
            select id,now() into v_session,v_created from public.streamer_live_sessions
              where user_id=v_user and ended_at is null for update;
            v_coins:=0;
        end if;
    end if;
    if v_session is null then raise exception 'No active TikInteract LIVE session'; end if;
    if v_coins<>p_coins then raise exception 'Gift value does not match the recorded event'; end if;
    insert into public.streamer_gift_collection_events
        (event_id,session_id,user_id,gift_id,gift_name,gift_image,quantity,unit_coins,coins,sender,created_at)
    values(p_event_id,v_session,v_user,trim(p_gift_id),left(coalesce(nullif(trim(p_gift_name),''),'Cadou TikTok'),100),
        v_image,p_quantity,p_unit_coins,p_coins,left(coalesce(nullif(trim(p_sender),''),'Spectator'),80),coalesce(v_created,now()))
    on conflict(event_id) do nothing;
    return found;
end;
$$;

create or replace function public.get_streamer_gift_collection(p_tiktok_username text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid;v_username text;v_result jsonb;
begin
    select user_id,tiktok_username into v_user,v_username from public.streamer_profiles
      where lower(tiktok_username)=lower(regexp_replace(trim(p_tiktok_username),'^@',''))
        and (is_public or user_id=auth.uid());
    if v_user is null then return null; end if;
    with entries as (
      select * from public.streamer_gift_collection_events where user_id=v_user
    ), grouped as (
      select gift_id,sum(quantity)::bigint as count,sum(coins)::bigint as coins,
        min(created_at) as first_at,max(created_at) as last_at from entries group by gift_id
    ), latest as (
      select distinct on(gift_id) gift_id,gift_name,gift_image,unit_coins
        from entries order by gift_id,created_at desc,event_id
    ), gifts as (
      select jsonb_build_object('id',g.gift_id,'name',l.gift_name,'image',l.gift_image,
        'unitCoins',l.unit_coins,'count',g.count,'coins',g.coins,
        'firstAt',extract(epoch from g.first_at)*1000,'lastAt',extract(epoch from g.last_at)*1000) as value,g.coins
      from grouped g join latest l using(gift_id)
    ), recent as (select * from entries order by created_at desc,event_id limit 30)
    select jsonb_build_object('username',v_username,
      'count',coalesce((select sum(quantity) from entries),0),
      'coins',coalesce((select sum(coins) from entries),0),
      'types',(select count(*) from grouped),
      'collection',coalesce((select jsonb_agg(value order by coins desc) from gifts),'[]'::jsonb),
      'recent',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_id,'id',gift_id,
        'name',gift_name,'image',gift_image,'quantity',quantity,'unitCoins',unit_coins,'coins',coins,
        'sender',sender,'at',extract(epoch from created_at)*1000) order by created_at desc) from recent),'[]'::jsonb)) into v_result;
    return v_result;
end;
$$;
revoke all on function public.record_my_live_gift_details(uuid,text,integer,text,text,text,integer,integer,text) from public;
grant execute on function public.record_my_live_gift_details(uuid,text,integer,text,text,text,integer,integer,text) to authenticated;
revoke all on function public.get_streamer_gift_collection(text) from public;
grant execute on function public.get_streamer_gift_collection(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
