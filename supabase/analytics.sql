-- Requires leaderboard.sql, tiktok_gifts.sql, access-keys.sql and users.sql.
-- Historical sessions retain their original totals. New sessions collect heartbeat/audience data.
begin;
-- Older installations predate game tracking. Keep their historical game unknown.
alter table public.streamer_live_sessions add column if not exists current_game text default 'unselected';
alter table public.streamer_live_sessions add column if not exists last_metrics_at timestamptz;
alter table public.streamer_live_sessions add column if not exists chat_count bigint not null default 0;
alter table public.streamer_live_sessions add column if not exists like_count bigint not null default 0;
alter table public.streamer_live_sessions add column if not exists peak_viewers integer;
create table if not exists public.streamer_session_people(
 session_id uuid not null references public.streamer_live_sessions(id) on delete cascade,
 username text not null check(length(username)between 1 and 80),primary key(session_id,username)
);
create table if not exists public.streamer_session_games(
 id bigint generated always as identity primary key,
 session_id uuid not null references public.streamer_live_sessions(id) on delete cascade,
 game_id text not null,started_at timestamptz not null default now(),ended_at timestamptz
);
create unique index if not exists streamer_session_game_open_idx on public.streamer_session_games(session_id)where ended_at is null;
create index if not exists streamer_session_game_idx on public.streamer_session_games(session_id,started_at);
alter table public.streamer_gift_collection_events add column if not exists game_id text;
alter table public.streamer_session_people enable row level security;
alter table public.streamer_session_games enable row level security;
revoke all on public.streamer_session_people,public.streamer_session_games from anon,authenticated;

create or replace function public.track_stream_session_game() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.streamer_session_games(session_id,game_id,started_at)values(new.id,coalesce(new.current_game,'unselected'),new.started_at);
 elsif new.current_game is distinct from old.current_game or new.ended_at is distinct from old.ended_at then
  update public.streamer_session_games set ended_at=coalesce(new.ended_at,now())where session_id=new.id and ended_at is null;
  if new.ended_at is null then insert into public.streamer_session_games(session_id,game_id)values(new.id,coalesce(new.current_game,'unselected'));end if;
 end if;return new;
end $$;
drop trigger if exists track_stream_session_game on public.streamer_live_sessions;
create trigger track_stream_session_game after insert or update of current_game,ended_at on public.streamer_live_sessions for each row execute function public.track_stream_session_game();
create or replace function public.track_stream_gift_game() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 select game_id into new.game_id from public.streamer_session_games where session_id=new.session_id and started_at<=new.created_at and(ended_at is null or ended_at>=new.created_at)order by started_at desc,id desc limit 1;
 return new;
end $$;
drop trigger if exists track_stream_gift_game on public.streamer_gift_collection_events;
create trigger track_stream_gift_game before insert on public.streamer_gift_collection_events for each row execute function public.track_stream_gift_game();

create or replace function public.record_my_live_metrics(p_session uuid,p_chat bigint,p_likes bigint,p_peak integer default null,p_people text[] default '{}')returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.access_require_user();begin
 if p_session is null or p_chat is null or p_chat not between 0 and 1000000000 or p_likes is null or p_likes not between 0 and 1000000000 or(p_peak is not null and p_peak not between 0 and 10000000)or p_people is null or cardinality(p_people)>200 then raise exception 'ANALYTICS_INVALID';end if;
 update public.streamer_live_sessions set chat_count=greatest(chat_count,p_chat),like_count=greatest(like_count,p_likes),peak_viewers=case when p_peak is null then peak_viewers else greatest(coalesce(peak_viewers,0),p_peak)end,last_metrics_at=now()where id=p_session and user_id=u and ended_at is null;
 if not found then raise exception 'ANALYTICS_SESSION_REQUIRED' using errcode='42501';end if;
 insert into public.streamer_session_people(session_id,username)select p_session,lower(trim(x))from unnest(p_people)x where length(trim(x))between 1 and 80 on conflict do nothing;
end $$;

create or replace function public.get_my_stream_analytics(p_days integer default 30,p_session uuid default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=public.access_require_user();since_date timestamptz:=date_trunc('day',now() at time zone 'UTC')at time zone 'UTC';result jsonb;
begin
 if p_days is null or p_days not in (7,30,90)then raise exception 'ANALYTICS_INVALID';end if;
 since_date:=since_date-make_interval(days=>p_days-1);
 if p_session is not null and not exists(select 1 from public.streamer_live_sessions where id=p_session and user_id=u)then raise exception 'ANALYTICS_NOT_FOUND' using errcode='42501';end if;
 with sessions as(select s.*,greatest(0,extract(epoch from(least(coalesce(s.ended_at,s.last_metrics_at,s.started_at),now())-greatest(s.started_at,since_date))))::bigint seconds from public.streamer_live_sessions s where s.user_id=u and coalesce(s.ended_at,s.last_metrics_at,s.started_at)>=since_date and(p_session is null or s.id=p_session)),
 gift_values as(select g.* from public.streamer_gift_events g where g.user_id=u and g.created_at>=since_date and(p_session is null or g.session_id=p_session)),
 gifts as(select g.* from public.streamer_gift_collection_events g where g.user_id=u and g.created_at>=since_date and(p_session is null or g.session_id=p_session)),
 days as(select d::date bucket_date from generate_series((since_date at time zone 'UTC')::date,(now()at time zone 'UTC')::date,interval '1 day')d),
 supporters as(select sender,sum(coins)::bigint coins,sum(quantity)::bigint quantity,count(distinct session_id) sessions from gifts group by sender order by sum(coins)desc,sender limit 20),
 games as(select coalesce(g.game_id,'unknown') game_id,sum(g.coins)::bigint coins,sum(g.quantity)::bigint quantity from gifts g group by coalesce(g.game_id,'unknown')),
 recent as(select * from gifts order by created_at desc,event_id limit 50),
 session_page as(select * from sessions order by started_at desc limit 100)
 select jsonb_build_object('days',p_days,'since',since_date,'timezone','UTC',
 'totals',jsonb_build_object('coins',coalesce((select sum(coins)from gift_values),0),'gifts',coalesce((select sum(quantity)from gifts),0),'supporters',(select count(distinct sender)from gifts),
 'seconds',coalesce((select sum(seconds)from sessions),0),'sessions',(select count(*)from sessions),'likes',coalesce((select sum(like_count)from sessions),0),'comments',coalesce((select sum(chat_count)from sessions),0),'peakViewers',(select max(peak_viewers)from sessions),
 'chatters',(select count(distinct p.username)from public.streamer_session_people p join sessions s on s.id=p.session_id),
 'unattributedCoins',greatest(0,coalesce((select sum(coins)from gift_values),0)-coalesce((select sum(coins)from gifts),0))),
 'daily',coalesce((select jsonb_agg(jsonb_build_object('day',bucket_date,'coins',coalesce((select sum(coins)from gift_values g where(g.created_at at time zone 'UTC')::date=d.bucket_date),0))order by bucket_date)from days d),'[]'::jsonb),
 'supporters',coalesce((select jsonb_agg(jsonb_build_object('name',sender,'coins',coins,'gifts',quantity,'sessions',sessions)order by coins desc)from supporters),'[]'::jsonb),
 'games',coalesce((select jsonb_agg(jsonb_build_object('id',game_id,'coins',coins,'gifts',quantity)order by coins desc)from games),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'startedAt',started_at,'endedAt',ended_at,'lastSeenAt',last_metrics_at,'game',current_game,'coins',total_coins,'seconds',seconds,'peakViewers',peak_viewers,'gifts',coalesce((select sum(quantity)from public.streamer_gift_collection_events g where g.session_id=s.id),0))order by started_at desc)from session_page s),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(jsonb_build_object('id',event_id,'name',gift_name,'image',gift_image,'sender',sender,'quantity',quantity,'coins',coins,'at',created_at,'game',game_id)order by created_at desc)from recent),'[]'::jsonb),
 'sessionTotal',(select count(*)from sessions),'updatedAt',now())into result;return result;
end $$;

create or replace function public.get_streams_directory()returns jsonb
language sql stable security definer set search_path='' as $$
 with eligible as(select s.*,p.tiktok_display_name,p.avatar_url,
  (s.ended_at is null and coalesce(s.last_metrics_at,s.started_at)>now()-interval '2 minutes')is_live,
  greatest(0,extract(epoch from(coalesce(s.ended_at,s.last_metrics_at,s.started_at)-s.started_at)))::bigint seconds
  from public.streamer_live_sessions s join public.streamer_profiles p on p.user_id=s.user_id
  where p.is_public and lower(p.tiktok_username)<>'numele_tau' and public.is_site_account_allowed(p.user_id) and s.current_game is not null and s.current_game<>'unselected'
  and coalesce(s.ended_at,s.last_metrics_at,s.started_at)>now()-interval '24 hours'),
 latest as(select distinct on(user_id)* from eligible order by user_id,is_live desc,started_at desc),
 page as(select * from latest order by is_live desc,total_coins desc,started_at desc limit 100)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('tiktok_username',tiktok_username,'tiktok_display_name',tiktok_display_name,'avatar_url',avatar_url,'current_game',current_game,'started_at',started_at,'ended_at',case when is_live then null else coalesce(ended_at,last_metrics_at,started_at)end,'total_coins',total_coins,'duration_seconds',seconds,'peak_viewers',peak_viewers,'is_live',is_live)order by is_live desc,total_coins desc)from page),'[]'::jsonb),
 'stats',jsonb_build_object('live',(select count(*)from latest where is_live),'creators',(select count(*)from latest),'coins',coalesce((select sum(g.coins)from public.streamer_gift_events g join public.streamer_profiles p on p.user_id=g.user_id where p.is_public and public.is_site_account_allowed(p.user_id)and g.created_at>now()-interval '24 hours'),0)),
 'total',(select count(*)from latest),'updatedAt',now())
$$;
revoke all on function public.track_stream_session_game(),public.track_stream_gift_game() from public;
revoke all on function public.record_my_live_metrics(uuid,bigint,bigint,integer,text[]),public.get_my_stream_analytics(integer,uuid),public.get_streams_directory()from public;
grant execute on function public.record_my_live_metrics(uuid,bigint,bigint,integer,text[]),public.get_my_stream_analytics(integer,uuid)to authenticated;
grant execute on function public.get_streams_directory()to anon,authenticated;
notify pgrst,'reload schema';
commit;
