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
