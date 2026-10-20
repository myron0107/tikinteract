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
