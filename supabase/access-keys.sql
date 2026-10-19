-- Run after admin.sql. Access keys and account entitlements; no card billing.
begin;
do $$ begin
 if to_regprocedure('public.site_admin_role()') is null then raise exception 'Rulează mai întâi supabase/admin.sql sau instalatorul complet install-admin.sql.';end if;
end $$;
create table if not exists public.access_keys(
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null,
 key_hash text not null unique,
 key_hint text not null,
 plan text not null check(plan in ('play_pass','play_pass_pro')),
 months integer not null check(months in (1,3,6,12)),
 label text not null default '' check(length(label)<=160),
 bound_email text check(length(bound_email)<=254),
 redeem_before timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 redeemed_by uuid references auth.users(id) on delete set null,
 redeemed_at timestamptz,
 revoked_by uuid references auth.users(id) on delete set null,
 revoked_at timestamptz
);
create table if not exists public.account_access_grants(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_key uuid not null unique references public.access_keys(id),
 plan text not null check(plan in ('play_pass','play_pass_pro')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 revoked_at timestamptz,
 check(ends_at>starts_at)
);
create table if not exists public.access_key_events(
 id bigint generated always as identity primary key,
 key_id uuid not null references public.access_keys(id),
 actor uuid references auth.users(id) on delete set null,
 action text not null check(action in ('create','redeem','revoke')),
 created_at timestamptz not null default now()
);
create table if not exists public.access_redeem_limits(
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null default now(),attempts integer not null default 0
);
create index if not exists access_key_batch_idx on public.access_keys(batch_id);
create index if not exists access_grants_user_idx on public.account_access_grants(user_id,ends_at);
alter table public.access_keys enable row level security;
alter table public.account_access_grants enable row level security;
alter table public.access_key_events enable row level security;
alter table public.access_redeem_limits enable row level security;
revoke all on public.access_keys,public.account_access_grants,public.access_key_events,public.access_redeem_limits from anon,authenticated;

create or replace function public.access_require_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null and not is_anonymous) then raise exception 'ACCESS_ACCOUNT_REQUIRED' using errcode='42501';end if;
 return u;
end $$;
create or replace function public.get_my_access() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=public.access_require_user();active_plan text;until_date timestamptz;
begin
 select g.plan into active_plan from public.account_access_grants g where g.user_id=u and g.revoked_at is null and g.starts_at<=now() and g.ends_at>now()
 order by case when g.plan='play_pass_pro' then 2 else 1 end desc limit 1;
 -- Same-plan periods are contiguous; a revoked period can leave a gap, so walk only the current chain.
 if active_plan is not null then
  with recursive coverage(ends_at) as (
   select max(ends_at) from public.account_access_grants where user_id=u and plan=active_plan and revoked_at is null and starts_at<=now() and ends_at>now()
   union
   select g.ends_at from coverage c join public.account_access_grants g on g.user_id=u and g.plan=active_plan and g.revoked_at is null and g.starts_at<=c.ends_at and g.ends_at>c.ends_at
  ) select max(ends_at) into until_date from coverage;
 end if;
 return jsonb_build_object('plan',coalesce(active_plan,'free'),'validUntil',until_date,'serverNow',now(),
  'periods',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'plan',g.plan,'startsAt',g.starts_at,'endsAt',g.ends_at) order by g.starts_at)
   from public.account_access_grants g where g.user_id=u and g.revoked_at is null and g.ends_at>now()),'[]'::jsonb));
end $$;

create or replace function public.generate_access_keys(p_plan text,p_months integer,p_count integer default 1,p_label text default '',p_email text default null,p_redeem_days integer default 90,p_batch uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.access_require_user();raw text;code text;key_id uuid;result jsonb:='[]'::jsonb;deadline timestamptz;email text:=nullif(lower(trim(p_email)),'');
begin
 if coalesce(public.site_admin_role(),'') not in ('owner','admin') then raise exception 'ACCESS_ADMIN_REQUIRED' using errcode='42501';end if;
 if p_plan is null or p_plan not in ('play_pass','play_pass_pro') or p_months is null or p_months not in (1,3,6,12) or p_count is null or p_count not between 1 and 25 or p_label is null or length(p_label)>160 or p_batch is null
  or(p_redeem_days is not null and p_redeem_days not in (7,30,90,180,365)) or(email is not null and (length(email)>254 or email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then raise exception 'ACCESS_INVALID_OPTIONS';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_batch::text,812));
 if exists(select 1 from public.access_keys where batch_id=p_batch) then raise exception 'ACCESS_BATCH_EXISTS';end if;
 if (select count(*) from public.access_keys where created_by=u and created_at>now()-interval '1 hour')+p_count>250 then raise exception 'ACCESS_GENERATION_LIMIT';end if;
 deadline:=case when p_redeem_days is null then null else now()+make_interval(days=>p_redeem_days) end;
 for i in 1..p_count loop
  raw:=upper(replace(gen_random_uuid()::text,'-',''));
  code:='TI-'||substr(raw,1,8)||'-'||substr(raw,9,8)||'-'||substr(raw,17,8)||'-'||substr(raw,25,8);
  insert into public.access_keys(batch_id,key_hash,key_hint,plan,months,label,bound_email,redeem_before,created_by)
   values(p_batch,encode(sha256(convert_to(raw,'UTF8')),'hex'),'TI-••••-'||right(raw,8),p_plan,p_months,trim(p_label),email,deadline,u) returning id into key_id;
  insert into public.access_key_events(key_id,actor,action) values(key_id,u,'create');
  result:=result||jsonb_build_array(jsonb_build_object('id',key_id,'code',code,'plan',p_plan,'months',p_months,'redeemBefore',deadline));
 end loop;
 return result;
end $$;

create or replace function public.list_access_keys(p_filter text default 'all',p_search text default '',p_limit integer default 30,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.access_require_user();
 if coalesce(public.site_admin_role(),'') not in ('owner','admin') then raise exception 'ACCESS_ADMIN_REQUIRED' using errcode='42501';end if;
 if p_filter is null or p_filter not in ('all','unused','redeemed','revoked','expired') or p_search is null or length(p_search)>160 or p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'ACCESS_INVALID_OPTIONS';end if;
 return (with classified as (
  select k.*,a.email redeemed_email,c.email creator_email,g.starts_at,g.ends_at,
   case when k.revoked_at is not null then 'revoked' when k.redeemed_at is not null then 'redeemed' when k.redeem_before<=now() then 'expired' else 'unused' end state
  from public.access_keys k left join auth.users a on a.id=k.redeemed_by left join auth.users c on c.id=k.created_by left join public.account_access_grants g on g.source_key=k.id
 ),filtered as (select * from classified where(p_filter='all' or state=p_filter) and(p_search='' or strpos(lower(key_hint||' '||label||' '||coalesce(bound_email,'')||' '||coalesce(redeemed_email,'')),lower(p_search))>0)),
 page as(select * from filtered order by created_at desc,id limit p_limit offset p_offset)
 select jsonb_build_object('total',(select count(*) from filtered),'stats',jsonb_build_object('unused',(select count(*) from classified where state='unused'),'redeemed',(select count(*) from classified where state='redeemed'),'revoked',(select count(*) from classified where state='revoked'),'expired',(select count(*) from classified where state='expired')),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'hint',key_hint,'plan',plan,'months',months,'label',label,'boundEmail',bound_email,'redeemBefore',redeem_before,'createdAt',created_at,'createdBy',creator_email,'redeemedBy',redeemed_email,'redeemedAt',redeemed_at,'state',state,'startsAt',starts_at,'endsAt',ends_at) order by created_at desc,id) from page),'[]'::jsonb)));
end $$;

create or replace function public.redeem_access_key(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.access_require_user();raw text;email text;k public.access_keys;attempt_count integer;start_date timestamptz;end_date timestamptz;shift interval;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,813));
 insert into public.access_redeem_limits(user_id,attempts) values(u,1) on conflict(user_id) do update set
  attempts=case when public.access_redeem_limits.window_start<now()-interval '15 minutes' then 1 else public.access_redeem_limits.attempts+1 end,
  window_start=case when public.access_redeem_limits.window_start<now()-interval '15 minutes' then now() else public.access_redeem_limits.window_start end returning attempts into attempt_count;
 if attempt_count>15 then return jsonb_build_object('ok',false,'code','ACCESS_RATE_LIMIT');end if;
 -- Only separators and whitespace are ignored. Never put the key in a URL or a log.
 if p_code is null or length(p_code)>100 then return jsonb_build_object('ok',false,'code','ACCESS_KEY_INVALID');end if;
 raw:=regexp_replace(upper(p_code),'[[:space:]-]','','g');
 if length(raw)<>34 or left(raw,2)<>'TI' or substr(raw,3)!~'^[0-9A-F]{32}$' then return jsonb_build_object('ok',false,'code','ACCESS_KEY_INVALID');end if;
 raw:=substr(raw,3);
 select * into k from public.access_keys where key_hash=encode(sha256(convert_to(raw,'UTF8')),'hex') for update;
 if k.id is null or k.revoked_at is not null then return jsonb_build_object('ok',false,'code','ACCESS_KEY_INVALID');end if;
 if k.redeemed_at is not null then
  if k.redeemed_by=u then return jsonb_build_object('ok',true,'alreadyRedeemed',true,'access',public.get_my_access());end if;
  return jsonb_build_object('ok',false,'code','ACCESS_KEY_INVALID');
 end if;
 select lower(a.email) into email from auth.users a where a.id=u;
 if k.redeem_before<=now() or(k.bound_email is not null and k.bound_email<>email) then return jsonb_build_object('ok',false,'code','ACCESS_KEY_INVALID');end if;
 if k.plan='play_pass' then
  select greatest(now(),coalesce(max(ends_at),now())) into start_date from public.account_access_grants where user_id=u and revoked_at is null and ends_at>now();
 else
  select greatest(now(),coalesce(max(ends_at),now())) into start_date from public.account_access_grants where user_id=u and plan='play_pass_pro' and revoked_at is null and ends_at>now();
 end if;
 end_date:=((start_date at time zone 'UTC')+make_interval(months=>k.months)) at time zone 'UTC';
 if k.plan='play_pass_pro' then
  -- Preserve unused standard Pass time after the new PRO period instead of consuming it underneath PRO.
  shift:=end_date-start_date;
  update public.account_access_grants set starts_at=case when starts_at<start_date then end_date else starts_at+shift end,
   ends_at=ends_at+shift where user_id=u and plan='play_pass' and revoked_at is null and ends_at>start_date;
 end if;
 insert into public.account_access_grants(user_id,source_key,plan,starts_at,ends_at) values(u,k.id,k.plan,start_date,end_date);
 update public.access_keys set redeemed_by=u,redeemed_at=now() where id=k.id;
 insert into public.access_key_events(key_id,actor,action) values(k.id,u,'redeem');
 return jsonb_build_object('ok',true,'alreadyRedeemed',false,'startsAt',start_date,'endsAt',end_date,'access',public.get_my_access());
end $$;

create or replace function public.revoke_access_key(p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.access_require_user();target uuid;k public.access_keys;
begin
 if coalesce(public.site_admin_role(),'') not in ('owner','admin') then raise exception 'ACCESS_ADMIN_REQUIRED' using errcode='42501';end if;
 select redeemed_by into target from public.access_keys where id=p_key;
 if target is not null then perform pg_advisory_xact_lock(pg_catalog.hashtextextended(target::text,813));end if;
 select * into k from public.access_keys where id=p_key for update;
 if k.id is null then raise exception 'ACCESS_KEY_NOT_FOUND';end if;
 if k.revoked_at is null then
  update public.access_keys set revoked_at=now(),revoked_by=u where id=p_key;
  update public.account_access_grants set revoked_at=now() where source_key=p_key;
  insert into public.access_key_events(key_id,actor,action) values(p_key,u,'revoke');
 end if;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.check_game_access(p_game text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare game jsonb;required_plan text;u uuid:=public.access_require_user();
begin
 select g into game from public.site_settings s cross join jsonb_array_elements(s.published->'games') g where s.singleton and g->>'id'=p_game and g->>'status'='published';
 if game is null then return false;end if;required_plan:=game->>'plan';
 if required_plan='free' then return true;end if;
 return exists(select 1 from public.account_access_grants where user_id=u and revoked_at is null and starts_at<=now() and ends_at>now() and (plan='play_pass_pro' or plan=required_plan));
end $$;

revoke all on function public.access_require_user(),public.get_my_access(),public.generate_access_keys(text,integer,integer,text,text,integer,uuid),public.list_access_keys(text,text,integer,integer),public.redeem_access_key(text),public.revoke_access_key(uuid),public.check_game_access(text) from public,anon,authenticated;
grant execute on function public.get_my_access(),public.generate_access_keys(text,integer,integer,text,text,integer,uuid),public.list_access_keys(text,text,integer,integer),public.redeem_access_key(text),public.revoke_access_key(uuid),public.check_game_access(text) to authenticated;
-- Replace only the original placeholder benefits. Keep any benefits already customized by the owner.
do $$
declare s public.site_settings;d jsonb;p jsonb;items jsonb;kind text;cfg jsonb;pub_changed boolean;
begin
 select * into s from public.site_settings where singleton for update;
 d:=s.draft;p:=s.published;
 foreach kind in array array['draft','published'] loop
  cfg:=case when kind='draft' then d else p end;
  select jsonb_agg(case
   when entry->>'id'='play_pass' and entry->'features'='["Jocuri LIVE extinse","Evenimente interactive","Statistici de bază"]'::jsonb
    then jsonb_set(entry,'{features}','["Jocurile marcate Play Pass","Conectare TikTok LIVE","Acces prin cheie, în cont"]'::jsonb)
   when entry->>'id'='play_pass_pro' and entry->'features'='["Jocuri și opțiuni avansate","Instrumente pentru moderatori","Automatizări pentru chat"]'::jsonb
    then jsonb_set(entry,'{features}','["Jocurile Play Pass și PRO","Conectare TikTok LIVE","Timpul Play Pass rămas se păstrează"]'::jsonb)
   else entry end order by position) into items from jsonb_array_elements(cfg->'plans') with ordinality as x(entry,position);
  if kind='draft' then d:=jsonb_set(d,'{plans}',items);else p:=jsonb_set(p,'{plans}',items);end if;
 end loop;
 if d is distinct from s.draft or p is distinct from s.published then
  pub_changed:=p is distinct from s.published;
  update public.site_settings set draft=d,published=p,revision=revision+1,published_revision=case when pub_changed then revision+1 else published_revision end,updated_at=now() where singleton;
  insert into public.site_config_history(revision,action,payload) values(s.revision+1,case when pub_changed then 'publish' else 'draft' end,case when pub_changed then p else d end);
 end if;
end $$;
notify pgrst,'reload schema';
commit;
