-- Run after admin.sql, access-keys.sql and users.sql. Additive billing installation.
begin;
do $$ begin
 if to_regprocedure('public.get_my_access()') is null then raise exception 'Run access-keys.sql before billing.sql';end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then raise exception 'Supabase service_role is required';end if;
end $$;
create table if not exists public.billing_orders(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,plan text not null check(plan in ('play_pass','play_pass_pro')),
 plan_name text not null,email text not null,locale text not null check(locale in ('ro','en')),
 amount integer not null check(amount between 1 and 10000000),currency text not null check(currency in ('ron','eur','usd')),
 live boolean not null,status text not null default 'pending' check(status in ('pending','paid','test_paid','refunded','disputed')),
 session_id text unique,payment_intent text unique,receipt_url text,
 created_at timestamptz not null default now(),paid_at timestamptz,unique(user_id,request_id)
);
create index if not exists billing_orders_user_idx on public.billing_orders(user_id,created_at desc);
alter table public.billing_orders enable row level security;
revoke all on public.billing_orders from public,anon,authenticated;
-- Widen the existing source field; all existing key grants remain untouched.
alter table public.account_access_grants alter column source_key drop not null;
alter table public.account_access_grants add column if not exists source_payment uuid unique references public.billing_orders(id);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='access_grant_one_source' and conrelid='public.account_access_grants'::regclass) then
  alter table public.account_access_grants add constraint access_grant_one_source check((source_key is null)<>(source_payment is null));
 end if;
end $$;

create or replace function public.billing_create_order(p_user uuid,p_plan text,p_request uuid,p_amount integer,p_currency text,p_live boolean,p_locale text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.billing_orders;cfg jsonb;u auth.users;
begin
 if p_user is null or p_request is null or p_plan is null or p_plan not in ('play_pass','play_pass_pro') or p_live is null or p_locale is null or p_locale not in ('ro','en') then raise exception 'BILLING_INVALID';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,813));
 select * into u from auth.users where id=p_user;
 if u.id is null or u.email_confirmed_at is null or u.is_anonymous or coalesce(u.raw_app_meta_data->>'site_preview','false')='true' then raise exception 'BILLING_ACCOUNT_REQUIRED';end if;
 select * into o from public.billing_orders where user_id=p_user and request_id=p_request;
 if o.id is not null then
  if o.plan<>p_plan or o.live<>p_live then raise exception 'BILLING_INVALID';end if;
  return to_jsonb(o);
 end if;
 if(select count(*) from public.billing_orders where user_id=p_user and created_at>now()-interval '15 minutes')>=12 then raise exception 'BILLING_RATE_LIMIT';end if;
 select item into cfg from public.site_settings s,jsonb_array_elements(s.published->'plans') item where s.singleton and item->>'id'=p_plan;
 if cfg is null or not coalesce((cfg->>'enabled')::boolean,false) or (cfg->>'priceCents')::integer<=0 then raise exception 'BILLING_PLAN_UNAVAILABLE';end if;
 if p_amount is null or p_currency is null or p_amount<>(cfg->>'priceCents')::integer or lower(p_currency)<>lower(cfg->>'currency') then raise exception 'BILLING_PRICE_CHANGED';end if;
 insert into public.billing_orders(user_id,request_id,plan,plan_name,email,locale,amount,currency,live)
 values(p_user,p_request,p_plan,cfg->>'name',u.email,p_locale,p_amount,lower(p_currency),p_live) returning * into o;
 return to_jsonb(o);
end $$;
create or replace function public.billing_attach_session(p_order uuid,p_session text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.billing_orders;
begin
 select * into o from public.billing_orders where id=p_order for update;
 if o.id is null or p_session is null or p_session!~'^cs_[A-Za-z0-9_]+$' or(o.session_id is not null and o.session_id<>p_session) then raise exception 'BILLING_INVALID';end if;
 update public.billing_orders set session_id=p_session where id=p_order;
end $$;
create or replace function public.billing_get_order(p_order uuid) returns jsonb
language sql stable security definer set search_path='' as $$select to_jsonb(o) from public.billing_orders o where id=p_order$$;

create or replace function public.billing_complete_order(p_order uuid,p_session text,p_intent text,p_amount integer,p_currency text,p_live boolean,p_receipt text default null,p_reversed text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.billing_orders;start_date timestamptz;end_date timestamptz;shift interval;
begin
 -- Use the SAME lock as key redemption: purchases and keys cannot consume the same interval.
 select * into o from public.billing_orders where id=p_order;
 if o.id is null then raise exception 'BILLING_INVALID';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(o.user_id::text,813));
 select * into o from public.billing_orders where id=p_order for update;
 if p_session is null or p_session!~'^cs_[A-Za-z0-9_]+$' or p_intent is null or p_intent!~'^pi_[A-Za-z0-9_]+$' or p_amount is distinct from o.amount or p_currency is distinct from o.currency or p_live is distinct from o.live or(o.session_id is not null and o.session_id<>p_session) or(p_reversed is not null and p_reversed not in ('refunded','disputed')) then raise exception 'BILLING_PAYMENT_MISMATCH';end if;
 if o.status<>'pending' then return jsonb_build_object('status',o.status,'plan',o.plan);end if;
 update public.billing_orders set session_id=p_session,payment_intent=p_intent,paid_at=now(),
  receipt_url=case when p_receipt~'^https://(pay|receipt|invoice)\.stripe\.com/' then p_receipt else null end,
  status=coalesce(p_reversed,case when o.live then 'paid' else 'test_paid' end) where id=o.id;
 if p_reversed is not null then return jsonb_build_object('status',p_reversed,'plan',o.plan);end if;
 if not o.live then return jsonb_build_object('status','test_paid','plan',o.plan);end if;
 if o.plan='play_pass' then
  select greatest(now(),coalesce(max(ends_at),now())) into start_date from public.account_access_grants where user_id=o.user_id and revoked_at is null and ends_at>now();
 else
  select greatest(now(),coalesce(max(ends_at),now())) into start_date from public.account_access_grants where user_id=o.user_id and plan='play_pass_pro' and revoked_at is null and ends_at>now();
 end if;
 end_date:=((start_date at time zone 'UTC')+interval '1 month') at time zone 'UTC';
 if o.plan='play_pass_pro' then
  shift:=end_date-start_date;
  update public.account_access_grants set starts_at=case when starts_at<start_date then end_date else starts_at+shift end,ends_at=ends_at+shift
   where user_id=o.user_id and plan='play_pass' and revoked_at is null and ends_at>start_date;
 end if;
 insert into public.account_access_grants(user_id,source_payment,plan,starts_at,ends_at) values(o.user_id,o.id,o.plan,start_date,end_date);
 return jsonb_build_object('status','paid','plan',o.plan);
end $$;
create or replace function public.billing_reverse_order(p_intent text,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.billing_orders;
begin
 if p_status is null or p_status not in ('refunded','disputed') then raise exception 'BILLING_INVALID';end if;
 select * into o from public.billing_orders where payment_intent=p_intent;
 if o.id is null then return;end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(o.user_id::text,813));
 update public.billing_orders set status=p_status where id=o.id and status in ('paid','test_paid','disputed');
 update public.account_access_grants set revoked_at=coalesce(revoked_at,now()) where source_payment=o.id;
end $$;
create or replace function public.get_my_billing_orders() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=public.access_require_user();result jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc),'[]'::jsonb) into result from
 (select id,plan,amount,currency,status,created_at,paid_at,receipt_url from public.billing_orders where user_id=u and status<>'pending' order by created_at desc limit 30)p;
 return result;
end $$;
revoke all on function public.billing_create_order(uuid,text,uuid,integer,text,boolean,text),public.billing_attach_session(uuid,text),public.billing_get_order(uuid),public.billing_complete_order(uuid,text,text,integer,text,boolean,text,text),public.billing_reverse_order(text,text),public.get_my_billing_orders() from public,anon,authenticated;
grant execute on function public.billing_create_order(uuid,text,uuid,integer,text,boolean,text),public.billing_attach_session(uuid,text),public.billing_get_order(uuid),public.billing_complete_order(uuid,text,text,integer,text,boolean,text,text),public.billing_reverse_order(text,text) to service_role;
grant execute on function public.get_my_billing_orders() to authenticated;
commit;
