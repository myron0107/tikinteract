-- Run AFTER animations.sql. TEST commerce only; no public prices or live access
-- grants are changed. Safe to rerun. Existing live wallets stay separate.
begin;
create table if not exists public.animation_commerce_price_terms(
 price_id text primary key,kind text not null,offer text not null,amount integer not null,credits integer not null,
 created_at timestamptz not null default now());
create table if not exists public.animation_commerce_orders(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,kind text not null check(kind in ('subscription','topup')),offer text not null,
 price_id text not null,amount integer not null check(amount>0),currency text not null check(currency='eur'),
 credits integer not null check(credits>0),test boolean not null default true check(test),
 session_id text unique,customer_id text,subscription_id text unique,intent text unique,
 status text not null default 'pending',refunded_amount integer not null default 0,
 paid_at timestamptz,created_at timestamptz not null default now(),unique(user_id,request_id));
create table if not exists public.animation_commerce_invoices(
 id text primary key,order_id uuid not null references public.animation_commerce_orders(id),
 user_id uuid not null references auth.users(id) on delete cascade,subscription_id text not null,
 plan text not null check(plan in ('play_pass','play_pass_pro')),price_id text not null,credits integer not null,
 amount integer not null check(amount>0),currency text not null check(currency='eur'),
 starts_at timestamptz not null,ends_at timestamptz not null,paid_at timestamptz not null,
 refunded_amount integer not null default 0,disputed boolean not null default false,
 test boolean not null default true check(test),created_at timestamptz not null default now(),
 unique(subscription_id,starts_at),check(ends_at>starts_at and ends_at<=starts_at+interval '32 days'));
create table if not exists public.animation_provider_costs(
 job_id uuid not null references public.animation_jobs(id) on delete cascade,
 stage text not null check(stage in ('image','video')),request_id text not null unique,model text not null,
 usd_nanos bigint not null check(usd_nanos>=0),source text not null check(source='fal-billing-events'),
 observed_at timestamptz not null default now(),created_at timestamptz not null default now(),primary key(job_id,stage));
create index if not exists animation_commerce_paid on public.animation_commerce_orders(paid_at);
alter table public.animation_commerce_orders add column if not exists charge_id text;
alter table public.animation_commerce_orders add column if not exists stripe_fee_cents integer;
alter table public.animation_commerce_orders add column if not exists tax_cents integer;
alter table public.animation_commerce_invoices add column if not exists charge_id text;
alter table public.animation_commerce_invoices add column if not exists stripe_fee_cents integer;
alter table public.animation_commerce_invoices add column if not exists tax_cents integer;
create index if not exists animation_commerce_invoice_paid on public.animation_commerce_invoices(paid_at);
do $$declare n text;begin
 foreach n in array array['animation_commerce_orders','animation_commerce_invoices','animation_provider_costs','animation_commerce_price_terms'] loop
  execute format('alter table public.%I enable row level security',n);
  execute format('revoke all on public.%I from public,anon,authenticated',n);
  execute format('grant all on public.%I to service_role',n);
 end loop;
end $$;

create or replace function public.animation_effective_config() returns jsonb
language plpgsql stable security definer set search_path='' as $$declare cfg jsonb;c jsonb;begin
 select config into cfg from public.animation_settings where singleton;c:=cfg->'testCommerce';
 if (cfg->>'testMode')::boolean and c is not null then
  cfg:=cfg||jsonb_build_object('standardCredits',c->'standardCredits','premiumCredits',c->'premiumCredits',
   'monthlyCredits',jsonb_build_object('play_pass',c#>'{plans,play_pass,credits}','play_pass_pro',c#>'{plans,play_pass_pro,credits}'),
   'packages',coalesce((select jsonb_agg(p||'{"currency":"eur"}') from jsonb_array_elements(c->'packages') p),'[]'::jsonb));
 end if;return cfg;
end $$;

create or replace function public.animation_commerce_order(p_user uuid,p_request uuid,p_kind text,p_offer text) returns jsonb
language plpgsql security definer set search_path='' as $$declare cfg jsonb;p jsonb;o public.animation_commerce_orders;begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,912));
 select * into o from public.animation_commerce_orders where user_id=p_user and request_id=p_request;
 if found then
  if o.kind<>p_kind or o.offer<>p_offer then raise exception 'ANIM_REQUEST_MISMATCH';end if;return to_jsonb(o);
 end if;
 select config into cfg from public.animation_settings where singleton;
 if not coalesce((cfg->>'testMode')::boolean,false) then raise exception 'ANIM_TEST_ONLY';end if;
 if p_kind='subscription' and p_offer in ('play_pass','play_pass_pro') then p:=cfg#>array['testCommerce','plans',p_offer];
 elsif p_kind='topup' then select item into p from jsonb_array_elements(cfg#>'{testCommerce,packages}') item where item->>'id'=p_offer and item->>'enabled'='true';end if;
 if p is null or coalesce(p->>'priceId','')!~'^price_[A-Za-z0-9]+$' then raise exception 'ANIM_PRICE_REQUIRED';end if;
 insert into public.animation_commerce_price_terms(price_id,kind,offer,amount,credits) values(p->>'priceId',p_kind,p_offer,(p->>'amount')::integer,(p->>'credits')::integer) on conflict do nothing;
 if exists(select 1 from public.animation_commerce_price_terms t where t.price_id=p->>'priceId' and (t.kind<>p_kind or t.offer<>p_offer or t.amount<>(p->>'amount')::integer or t.credits<>(p->>'credits')::integer)) then raise exception 'ANIM_PRICE_TERMS';end if;
 if(select count(*) from public.animation_commerce_orders where user_id=p_user and created_at>now()-interval '15 minutes')>=12 then raise exception 'ANIM_RATE_LIMIT';end if;
 -- Resume an abandoned unpaid Checkout instead of charging twice or locking
 -- the user out after returning through cancel_url.
 if p_kind='subscription' then
  if exists(select 1 from public.animation_commerce_orders where user_id=p_user and kind='subscription' and status in ('paid','active')) then raise exception 'ANIM_SUBSCRIPTION_EXISTS';end if;
  select * into o from public.animation_commerce_orders where user_id=p_user and kind='subscription' and status='pending' and created_at>now()-interval '23 hours' order by created_at desc limit 1;
  if found then
   if o.offer<>p_offer or o.price_id<>p->>'priceId' then raise exception 'ANIM_SUBSCRIPTION_EXISTS';end if;return to_jsonb(o);
  end if;
 end if;
 insert into public.animation_commerce_orders(user_id,request_id,kind,offer,price_id,amount,currency,credits)
 values(p_user,p_request,p_kind,p_offer,p->>'priceId',(p->>'amount')::integer,'eur',(p->>'credits')::integer) returning * into o;return to_jsonb(o);
end $$;

create or replace function public.animation_commerce_paid(p_order uuid,p_session text,p_customer text,p_intent text,p_paid_at timestamptz,p_refunded integer default 0,p_disputed boolean default false) returns void
language plpgsql security definer set search_path='' as $$declare o public.animation_commerce_orders;n integer;begin
 select * into o from public.animation_commerce_orders where id=p_order;if o.id is null or o.kind<>'topup' then raise exception 'ANIM_INVALID';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(o.user_id::text,912));
 select * into o from public.animation_commerce_orders where id=p_order for update;
 if o.session_id is not null and o.session_id<>p_session or o.intent is not null and o.intent<>p_intent or p_refunded<0 or p_refunded>o.amount then raise exception 'ANIM_PAYMENT_MISMATCH';end if;
 -- Monotonic reversal: an older payment webhook cannot restore refunded credits.
 n:=greatest(p_refunded,o.refunded_amount);
 update public.animation_commerce_orders set session_id=p_session,customer_id=p_customer,intent=p_intent,paid_at=coalesce(paid_at,p_paid_at),
 status=case when p_disputed or status='disputed' then 'disputed' when n>0 then 'refunded' else 'paid' end,refunded_amount=n where id=o.id;
 perform public.animation_grant(o.user_id,'commerce:'||o.id,'purchased',o.credits,null,true);
 perform public.animation_reverse('commerce:'||o.id,case when p_disputed or o.status='disputed' then o.credits else ceil(o.credits::numeric*n/o.amount)::integer end);
end $$;

create or replace function public.animation_commerce_invoice(p_order uuid,p_invoice text,p_subscription text,p_start timestamptz,p_end timestamptz,p_amount integer,p_paid_at timestamptz,p_refunded integer default 0,p_disputed boolean default false) returns void
language plpgsql security definer set search_path='' as $$declare o public.animation_commerce_orders;i public.animation_commerce_invoices;begin
 select * into o from public.animation_commerce_orders where id=p_order;if o.id is null or o.kind<>'subscription' then raise exception 'ANIM_INVALID';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(o.user_id::text,912));
 select * into o from public.animation_commerce_orders where id=p_order for update;
 if o.subscription_id is distinct from p_subscription or p_amount<>o.amount or p_end<=p_start or p_end>p_start+interval '32 days' then raise exception 'ANIM_PAYMENT_MISMATCH';end if;
 select * into i from public.animation_commerce_invoices where id=p_invoice or (subscription_id=p_subscription and starts_at=p_start);
 if found then
  if i.order_id<>o.id or i.starts_at<>p_start or i.ends_at<>p_end or i.amount<>p_amount then raise exception 'ANIM_PAYMENT_MISMATCH';end if;perform public.animation_commerce_reverse_invoice(p_invoice,p_refunded,p_disputed);return;
 end if;
 insert into public.animation_commerce_invoices(id,order_id,user_id,subscription_id,plan,price_id,credits,amount,currency,starts_at,ends_at,paid_at)
 values(p_invoice,o.id,o.user_id,p_subscription,o.offer,o.price_id,o.credits,p_amount,'eur',p_start,p_end,p_paid_at);
 perform public.animation_grant(o.user_id,'commerce-invoice:'||p_invoice,'included',o.credits,p_end,true);
 update public.animation_credit_batches set starts_at=p_start where source='commerce-invoice:'||p_invoice;
 perform public.animation_commerce_reverse_invoice(p_invoice,p_refunded,p_disputed);
 update public.animation_commerce_orders set paid_at=coalesce(paid_at,p_paid_at),status=case when status='cancelled' then status else 'active' end where id=o.id;
 -- Intentionally no account_access_grants: a test card never buys live access.
end $$;

create or replace function public.animation_commerce_reverse_invoice(p_invoice text,p_refunded integer,p_disputed boolean) returns void
language plpgsql security definer set search_path='' as $$declare i public.animation_commerce_invoices;n integer;begin
 select * into i from public.animation_commerce_invoices where id=p_invoice;if i.id is null then raise exception 'ANIM_INVOICE_REVIEW';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(i.user_id::text,912));
 select * into i from public.animation_commerce_invoices where id=p_invoice for update;
 if p_refunded<0 or p_refunded>i.amount then raise exception 'ANIM_PAYMENT_MISMATCH';end if;
 n:=greatest(i.refunded_amount,p_refunded);
 update public.animation_commerce_invoices set refunded_amount=n,disputed=disputed or p_disputed where id=i.id;
 perform public.animation_reverse('commerce-invoice:'||i.id,case when p_disputed or i.disputed then i.credits else ceil(i.credits::numeric*n/i.amount)::integer end);
end $$;

create or replace function public.animation_record_provider_cost(p_job uuid,p_stage text,p_request text,p_model text,p_usd_nanos bigint) returns void
language plpgsql security definer set search_path='' as $$declare j public.animation_jobs;cfg jsonb;total bigint;fx numeric;ceil_usd bigint;ceil_eur bigint;begin
 select * into j from public.animation_jobs where id=p_job;
 if j.id is null or p_stage not in ('image','video') or p_usd_nanos<0 or p_request is distinct from (case when p_stage='image' then j.image_request else j.video_request end)
 or p_model is distinct from (case when p_stage='image' then j.image_model else j.video_model end) then raise exception 'ANIM_COST_MISMATCH';end if;
 insert into public.animation_provider_costs(job_id,stage,request_id,model,usd_nanos,source) values(j.id,p_stage,p_request,p_model,p_usd_nanos,'fal-billing-events')
 on conflict(job_id,stage) do update set usd_nanos=excluded.usd_nanos,observed_at=now();
 -- Completed jobs with both billed stages can raise (never lower) the current
 -- test cost ceiling. A stale cheaper assumption cannot keep generation enabled.
 if j.test and j.status='completed' and j.image_model='fal-ai/flux-pro/kontext' and
 j.video_model=(case when j.tier='standard' then 'minimax/h3-max-turbo/image-to-video' else 'fal-ai/kling-video/o1/reference-to-video' end)
 and (select count(*) from public.animation_provider_costs where job_id=j.id)=2 then
  select sum(usd_nanos) into total from public.animation_provider_costs where job_id=j.id;
  select config into cfg from public.animation_settings where singleton for update;
  if (cfg->>'testMode')::boolean and cfg ? 'testCommerce' then
   ceil_usd:=ceil(total::numeric/1000);fx:=(cfg#>>'{testCommerce,finance,usdToEur}')::numeric;
   cfg:=jsonb_set(cfg,array[j.tier||'UsdMicros'],to_jsonb(greatest(coalesce((cfg->>(j.tier||'UsdMicros'))::bigint,0),ceil_usd)));
   if fx is not null then
    ceil_eur:=greatest(1,ceil(total::numeric/1000*fx));
    cfg:=jsonb_set(cfg,array['testCommerce','finance',j.tier||'EurMicros'],to_jsonb(greatest(coalesce((cfg#>>array['testCommerce','finance',j.tier||'EurMicros'])::bigint,0),ceil_eur)));
   end if;
   update public.animation_settings set config=cfg,revision=revision+1,updated_at=now() where singleton and config is distinct from cfg;
  end if;
 end if;
end $$;

create or replace function public.animation_financial_report(p_start timestamptz,p_end timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if p_end<=p_start or p_end>p_start+interval '32 days' then raise exception 'ANIM_INVALID';end if;
 select jsonb_build_object(
 'activePlans',coalesce((select jsonb_object_agg(plan,n) from(select plan,count(distinct user_id) n from(select distinct on (i.user_id) i.user_id,i.plan from public.animation_commerce_invoices i where i.starts_at<=now() and i.ends_at>now() and i.refunded_amount<i.amount and not i.disputed order by i.user_id,case when i.plan='play_pass_pro' then 2 else 1 end desc)x group by plan)y),'{}'::jsonb),
 'mrrCents',coalesce((select sum(amount) from(select distinct on(user_id) amount from public.animation_commerce_invoices where starts_at<=now() and ends_at>now() and refunded_amount<amount and not disputed order by user_id,starts_at desc)x),0),
 'invoices',coalesce((select jsonb_agg(jsonb_build_object('plan',plan,'amount',amount,'refunded',refunded_amount,'disputed',disputed,'credits',credits,'stripeFeeCents',stripe_fee_cents,'taxCents',tax_cents)) from public.animation_commerce_invoices where paid_at>=p_start and paid_at<p_end),'[]'::jsonb),
 'topups',coalesce((select jsonb_agg(jsonb_build_object('amount',amount,'refunded',refunded_amount,'disputed',status='disputed','credits',credits,'stripeFeeCents',stripe_fee_cents,'taxCents',tax_cents)) from public.animation_commerce_orders where kind='topup' and paid_at>=p_start and paid_at<p_end),'[]'::jsonb),
 'creditsGranted',coalesce((select sum(issued) from public.animation_credit_batches where test and created_at>=p_start and created_at<p_end),0),
 'creditsConsumed',coalesce((select sum(credits) from public.animation_jobs where test and status='completed' and updated_at>=p_start and updated_at<p_end),0),
 'creditsReserved',coalesce((select sum(credits) from public.animation_jobs where test and not settled),0),
 'costs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'createdAt',j.created_at,'status',j.status,'tier',j.tier,'estimatedUsdMicros',j.estimated_usd_micros,'actualUsdNanos',coalesce(c.total,0),'reconciled',coalesce(c.n,0)=(case when j.image_request is null then 0 else 1 end+case when j.video_request is null then 0 else 1 end) and j.status<>'review') order by j.created_at desc) from public.animation_jobs j left join lateral(select sum(usd_nanos) total,count(*) n from public.animation_provider_costs where job_id=j.id)c on true where j.test and j.created_at>=p_start and j.created_at<p_end and (j.image_request is not null or j.video_request is not null or j.status='review')),'[]'::jsonb),
 'test',true,'start',p_start,'end',p_end) into result;return result;
end $$;

do $$declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('animation_effective_config','animation_commerce_order','animation_commerce_paid','animation_commerce_invoice','animation_commerce_reverse_invoice','animation_record_provider_cost','animation_financial_report') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
create or replace function public.animation_reserve(p_user uuid,p_request uuid,p_input jsonb,p_image_model text,p_video_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg jsonb;j public.animation_jobs;photo public.animation_media;b public.animation_credit_batches;cost integer;estimate bigint;needed integer;take integer;test_mode boolean;begin
 -- Global lock serializes budget reservations; user lock also covers payment
 -- grants/refunds and credit settlement. Same lock order in all budget paths.
 perform pg_advisory_xact_lock(913);
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,912));
 select * into j from public.animation_jobs where user_id=p_user and request_id=p_request;
 if j.id is not null then
  if j.photo_id is distinct from (p_input->>'photo_id')::uuid or j.prompt is distinct from p_input->>'prompt' or j.tier is distinct from p_input->>'tier' or j.format is distinct from p_input->>'format' or j.world is distinct from p_input->>'world' then raise exception 'ANIM_REQUEST_MISMATCH';end if;
  return to_jsonb(j);
 end if;
 cfg:=public.animation_effective_config();
 if not coalesce((cfg->>'enabled')::boolean,false) then raise exception 'ANIM_DISABLED';end if;
 test_mode:=(cfg->>'testMode')::boolean;
 cost:=(cfg->>((p_input->>'tier')||'Credits'))::integer;estimate:=(cfg->>((p_input->>'tier')||'UsdMicros'))::bigint;
 if cost is null or cost<=0 or estimate is null or estimate<=0 or (cfg->>'dailyUsdMicros')::bigint is null or (cfg->>'userMonthlyUsdMicros')::bigint is null then raise exception 'ANIM_PRICING_REQUIRED';end if;
 if (select coalesce(amount,0) from public.animation_credit_debts where user_id=p_user and test=test_mode)>0 then raise exception 'ANIM_CREDIT_DEBT';end if;
 if(select count(*) from public.animation_jobs where user_id=p_user and status not in ('completed','failed'))>=coalesce((cfg->>'maxConcurrent')::integer,1) then raise exception 'ANIM_CONCURRENCY';end if;
 if(select count(*) from public.animation_jobs where user_id=p_user and created_at>now()-interval '1 hour')>=12 then raise exception 'ANIM_RATE_LIMIT';end if;
 if(select count(*) from public.animation_media where user_id=p_user and not deleted)>=160 then raise exception 'ANIM_LIBRARY_FULL';end if;
 -- Conservative cost reservation remains counted after provider failures; an
 -- administrator must reconcile actual invoices before raising the budget.
 if(select coalesce(sum(greatest(budget_job.estimated_usd_micros,coalesce((select ceil(sum(c.usd_nanos)::numeric/1000) from public.animation_provider_costs c where c.job_id=budget_job.id),0))),0) from public.animation_jobs budget_job where created_at>=date_trunc('day',now()))+estimate>(cfg->>'dailyUsdMicros')::bigint then raise exception 'ANIM_GLOBAL_BUDGET';end if;
 if(select coalesce(sum(greatest(budget_job.estimated_usd_micros,coalesce((select ceil(sum(c.usd_nanos)::numeric/1000) from public.animation_provider_costs c where c.job_id=budget_job.id),0))),0) from public.animation_jobs budget_job where user_id=p_user and created_at>=date_trunc('month',now()))+estimate>(cfg->>'userMonthlyUsdMicros')::bigint then raise exception 'ANIM_USER_BUDGET';end if;
 select * into photo from public.animation_media where id=(p_input->>'photo_id')::uuid and user_id=p_user and kind='photo' and ready and not deleted;
 if photo.id is null or not exists(select 1 from public.animation_universes where id=p_input->>'world' and (user_id is null or user_id=p_user)) then raise exception 'ANIM_INVALID';end if;
 if coalesce((select sum(remaining) from public.animation_credit_batches where user_id=p_user and test=test_mode and starts_at<=now() and (expires_at is null or expires_at>now())),0)<cost then raise exception 'ANIM_INSUFFICIENT_CREDITS';end if;
 insert into public.animation_jobs(user_id,request_id,photo_id,world,title,prompt,tier,format,credits,estimated_usd_micros,test,image_model,video_model)
 values(p_user,p_request,photo.id,p_input->>'world',p_input->>'title',p_input->>'prompt',p_input->>'tier',p_input->>'format',cost,estimate,test_mode,p_image_model,p_video_model) returning * into j;
 needed:=cost;
 for b in select * from public.animation_credit_batches where user_id=p_user and test=test_mode and remaining>0 and starts_at<=now() and (expires_at is null or expires_at>now()) order by case when kind='included' then 0 else 1 end,expires_at nulls last,created_at,id for update loop
  take:=least(needed,b.remaining);update public.animation_credit_batches set remaining=remaining-take where id=b.id;
  insert into public.animation_allocations(job_id,batch_id,amount) values(j.id,b.id,take);needed:=needed-take;exit when needed=0;
 end loop;
 insert into public.animation_transactions(user_id,reference,kind,amount,test) values(p_user,'reserve:'||j.id,'reserve',-cost,test_mode);
 return to_jsonb(j);
end $$;

-- Isolated proposal; rerunning this migration never overwrites admin edits.
update public.animation_settings set config=jsonb_set(config,'{testCommerce}','{"version":1,"currency":"eur","standardCredits":100,"premiumCredits":200,"plans":{"free":{"amount":0,"credits":0,"priceId":""},"play_pass":{"amount":799,"credits":300,"priceId":""},"play_pass_pro":{"amount":1499,"credits":800,"priceId":""}},"packages":[{"id":"credits-200","amount":299,"credits":200,"priceId":"","enabled":true},{"id":"credits-500","amount":499,"credits":500,"priceId":"","enabled":true},{"id":"credits-1100","amount":999,"credits":1100,"priceId":"","enabled":true}],"finance":{"standardEurMicros":300000,"premiumEurMicros":null,"taxBps":null,"stripeBps":null,"stripeFixedCents":null,"billingBps":70,"affiliateBps":0,"infrastructureCents":0,"storageCents":0,"usdToEur":null,"minimumMarginBps":2000}}'::jsonb),revision=revision+1 where singleton and not (config ? 'testCommerce');

commit;
