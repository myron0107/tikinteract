-- Creator workspace update. Run after the existing admin, support, users, access keys, leaderboard and gifts migrations.
-- Requires admin.sql, access-keys.sql and users.sql. Private PRO community.
begin;
create table if not exists public.community_members(
 user_id uuid primary key references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),last_seen_at timestamptz not null default now()
);
create table if not exists public.community_messages(
 id bigint generated always as identity primary key,
 author_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid references auth.users(id) on delete cascade,
 channel text not null check(channel in ('general','tips','collab','direct')),
 body text not null check(length(trim(body)) between 1 and 2000),
 client_id uuid not null,created_at timestamptz not null default now(),deleted_at timestamptz,
 check((channel='direct')=(recipient_id is not null)),check(recipient_id is distinct from author_id),
 unique(author_id,client_id)
);
create index if not exists community_channel_idx on public.community_messages(channel,id desc) where channel<>'direct';
create index if not exists community_dm_idx on public.community_messages(author_id,recipient_id,id desc) where channel='direct';
create index if not exists community_recipient_idx on public.community_messages(recipient_id,id desc) where channel='direct';
create table if not exists public.community_reads(
 user_id uuid not null references auth.users(id) on delete cascade,scope text not null,
 last_seen_id bigint not null default 0,primary key(user_id,scope)
);
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;
alter table public.community_reads enable row level security;
revoke all on public.community_members,public.community_messages,public.community_reads from anon,authenticated;

create or replace function public.community_has_pro(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_site_account_allowed(p_user) and exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and not is_anonymous)
 and exists(select 1 from public.account_access_grants where user_id=p_user and plan='play_pass_pro' and revoked_at is null and starts_at<=now() and ends_at>now())
$$;
create or replace function public.community_require_pro() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=public.access_require_user();begin
 if not public.community_has_pro(u) then raise exception 'COMMUNITY_PRO_REQUIRED' using errcode='42501';end if;return u;
end $$;
create or replace function public.community_identity(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',u.id,'name',coalesce(nullif(p.tiktok_display_name,''),nullif(u.raw_user_meta_data->>'display_name',''),nullif(u.raw_user_meta_data->>'full_name',''),'Creator'),
 'username',p.tiktok_username,'avatar',p.avatar_url,'online',m.last_seen_at>now()-interval '90 seconds')
 from public.community_members m join auth.users u on u.id=m.user_id left join public.streamer_profiles p on p.user_id=u.id where u.id=p_user
$$;
create or replace function public.community_join() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.community_require_pro();begin
 insert into public.community_members(user_id) values(u) on conflict(user_id) do update set last_seen_at=now();
 return public.community_identity(u);
end $$;
create or replace function public.community_people(p_search text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=public.community_require_pro();begin
 if p_search is null or length(p_search)>80 then raise exception 'COMMUNITY_INVALID';end if;
 return coalesce((select jsonb_agg(person order by last_seen_at desc) from (
 select public.community_identity(m.user_id) person,m.last_seen_at from public.community_members m
 where m.user_id<>u and public.community_has_pro(m.user_id)
 and (p_search='' or strpos(lower(public.community_identity(m.user_id)::text),lower(p_search))>0)
 order by last_seen_at desc limit 40)s),'[]'::jsonb);
end $$;
create or replace function public.community_thread(p_channel text default 'general',p_peer uuid default null,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=public.community_require_pro();result jsonb;begin
 if p_channel is null or p_channel not in ('general','tips','collab','direct') or (p_channel='direct')<>(p_peer is not null) or p_peer=u or p_before<=0 then raise exception 'COMMUNITY_INVALID';end if;
 if p_peer is not null and not exists(select 1 from public.community_members where user_id=p_peer) then raise exception 'COMMUNITY_PEER_UNAVAILABLE';end if;
 with accessible as(select * from public.community_messages m where m.channel=p_channel and (p_channel<>'direct' or(m.author_id=u and m.recipient_id=p_peer)or(m.author_id=p_peer and m.recipient_id=u))),
 page as(select * from accessible where p_before is null or id<p_before order by id desc limit 50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'author',public.community_identity(author_id),'mine',author_id=u,'body',case when deleted_at is null then body else null end,'at',created_at,'deleted',deleted_at is not null) order by id)from page),'[]'::jsonb),
 'hasMore',exists(select 1 from accessible where id<(select min(id)from page)),
 'peer',case when p_peer is not null then public.community_identity(p_peer) else null end)into result;return result;
end $$;
create or replace function public.community_send(p_channel text,p_peer uuid,p_body text,p_client uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.community_require_pro();v_id bigint;existing public.community_messages;begin
 if p_channel is null or p_channel not in ('general','tips','collab','direct') or (p_channel='direct')<>(p_peer is not null) or p_peer=u or p_body is null or length(trim(p_body)) not between 1 and 2000 or p_client is null then raise exception 'COMMUNITY_INVALID';end if;
 if not exists(select 1 from public.community_members where user_id=u) then raise exception 'COMMUNITY_JOIN_REQUIRED';end if;
 if p_peer is not null and (not public.community_has_pro(p_peer) or not exists(select 1 from public.community_members where user_id=p_peer)) then raise exception 'COMMUNITY_PEER_UNAVAILABLE';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,931));
 select * into existing from public.community_messages where author_id=u and client_id=p_client;
 if found then
  if existing.channel<>p_channel or existing.recipient_id is distinct from p_peer or existing.body<>trim(p_body) then raise exception 'COMMUNITY_REQUEST_CONFLICT';end if;
  return existing.id;
 end if;
 if(select count(*)from public.community_messages where author_id=u and created_at>now()-interval '1 minute')>=20 then raise exception 'COMMUNITY_RATE_LIMIT';end if;
 insert into public.community_messages(author_id,recipient_id,channel,body,client_id)values(u,p_peer,p_channel,trim(p_body),p_client)returning id into v_id;
 update public.community_members set last_seen_at=now() where user_id=u;return v_id;
end $$;
create or replace function public.community_delete(p_message bigint) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.community_require_pro();begin
 update public.community_messages set deleted_at=coalesce(deleted_at,now()) where id=p_message and(author_id=u or coalesce(public.site_admin_role(),'') in ('owner','admin'));
 if not found then raise exception 'COMMUNITY_NOT_ALLOWED' using errcode='42501';end if;
end $$;
create or replace function public.community_mark_read(p_channel text,p_peer uuid,p_seen bigint) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.community_require_pro();v_max bigint;begin
 if p_channel is null or p_channel not in ('general','tips','collab','direct') or(p_channel='direct')<>(p_peer is not null)or p_seen is null or p_seen<0 then raise exception 'COMMUNITY_INVALID';end if;
 select coalesce(max(id),0)into v_max from public.community_messages where channel=p_channel and(p_channel<>'direct' or(author_id=u and recipient_id=p_peer)or(author_id=p_peer and recipient_id=u));
 insert into public.community_reads(user_id,scope,last_seen_id)values(u,coalesce('dm:'||p_peer::text,p_channel),least(v_max,p_seen))on conflict(user_id,scope)do update set last_seen_id=greatest(community_reads.last_seen_id,excluded.last_seen_id);
end $$;
revoke all on function public.community_has_pro(uuid),public.community_require_pro(),public.community_identity(uuid) from public;
revoke all on function public.community_join(),public.community_people(text),public.community_thread(text,uuid,bigint),public.community_send(text,uuid,text,uuid),public.community_delete(bigint),public.community_mark_read(text,uuid,bigint) from public;
grant execute on function public.community_join(),public.community_people(text),public.community_thread(text,uuid,bigint),public.community_send(text,uuid,text,uuid),public.community_delete(bigint),public.community_mark_read(text,uuid,bigint) to authenticated;
notify pgrst,'reload schema';
commit;


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


-- Official notifications and support replies, separate from Community.
begin;
create table if not exists public.site_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id)on delete cascade,
 kind text not null check(kind in('welcome','access','team')),source text not null,
 title_ro text,body_ro text,title_en text,body_en text,
 created_at timestamptz not null default now(),read_at timestamptz,unique(user_id,source)
);
alter table public.site_notifications enable row level security;
revoke all on public.site_notifications from anon,authenticated;
create index if not exists site_notification_user_idx on public.site_notifications(user_id,created_at desc);
create or replace function public.notify_access_grant()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.site_notifications(user_id,kind,source)values(new.user_id,'access','access:'||new.id)on conflict do nothing;return new;
end $$;
drop trigger if exists notify_access_grant on public.account_access_grants;
create trigger notify_access_grant after insert on public.account_access_grants for each row execute function public.notify_access_grant();
create or replace function public.get_my_site_inbox(p_unread boolean default false,p_offset integer default 0)returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.access_require_user();result jsonb;begin
 if p_unread is null or p_offset is null or p_offset not between 0 and 100000 then raise exception 'INBOX_INVALID';end if;
 insert into public.site_notifications(user_id,kind,source)values(u,'welcome','welcome')on conflict do nothing;
 with entries as(
 select n.id::text id,n.kind,n.title_ro,n.body_ro,n.title_en,n.body_en,n.created_at at,n.read_at is null unread,null::uuid ticket_id
 from public.site_notifications n where n.user_id=u
 union all
 select t.id::text,'support',t.subject,left(m.body,4000),null,null,m.created_at,
 m.id>coalesce((select last_seen_id from public.support_reads where user_id=u and ticket_id=t.id),0),t.id
 from public.support_tickets t join lateral(select * from public.support_messages where ticket_id=t.id and author_kind='staff' and not internal order by id desc limit 1)m on true where t.owner_id=u
 ),page as(select * from entries where not p_unread or unread order by at desc,id limit 20 offset p_offset)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'titleRo',title_ro,'bodyRo',body_ro,'titleEn',title_en,'bodyEn',body_en,'at',at,'unread',unread,'ticket',ticket_id)order by at desc)from page),'[]'::jsonb),
 'unread',(select count(*)from entries where unread),'total',(select count(*)from entries where not p_unread or unread))into result;return result;
end $$;
create or replace function public.mark_my_site_messages_read(p_id uuid default null,p_all boolean default false)returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.access_require_user();begin
 if p_all is null or(not p_all and p_id is null)then raise exception 'INBOX_INVALID';end if;
 update public.site_notifications set read_at=coalesce(read_at,now())where user_id=u and(p_all or id=p_id);
 insert into public.support_reads(ticket_id,user_id,last_seen_id)
 select t.id,u,max(m.id)from public.support_tickets t join public.support_messages m on m.ticket_id=t.id and not m.internal where t.owner_id=u and(p_all or t.id=p_id)group by t.id
 on conflict(ticket_id,user_id)do update set last_seen_id=greatest(support_reads.last_seen_id,excluded.last_seen_id);
end $$;
create or replace function public.send_site_notification(p_user uuid,p_title_ro text,p_body_ro text,p_title_en text default null,p_body_en text default null)returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.access_require_user();v_id uuid;begin
 if coalesce(public.site_admin_role(),'')not in('owner','admin')then raise exception 'INBOX_ADMIN_REQUIRED'using errcode='42501';end if;
 if p_user is null or p_title_ro is null or length(trim(p_title_ro))not between 1 and 120 or p_body_ro is null or length(trim(p_body_ro))not between 1 and 4000 or length(coalesce(p_title_en,''))>120 or length(coalesce(p_body_en,''))>4000 then raise exception 'INBOX_INVALID';end if;
 insert into public.site_notifications(user_id,kind,source,title_ro,body_ro,title_en,body_en)values(p_user,'team',gen_random_uuid()::text,trim(p_title_ro),trim(p_body_ro),nullif(trim(p_title_en),''),nullif(trim(p_body_en),''))returning id into v_id;return v_id;
end $$;
revoke all on function public.notify_access_grant(),public.get_my_site_inbox(boolean,integer),public.mark_my_site_messages_read(uuid,boolean),public.send_site_notification(uuid,text,text,text,text)from public;
grant execute on function public.get_my_site_inbox(boolean,integer),public.mark_my_site_messages_read(uuid,boolean),public.send_site_notification(uuid,text,text,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
