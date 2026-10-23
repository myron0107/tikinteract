-- Additive installation. Run AFTER admin.sql, users.sql, access-keys.sql, billing.sql.
-- Does not alter existing plans, prices, keys, games or account grants.
begin;
create table if not exists public.animation_settings(
 singleton boolean primary key default true check(singleton),revision integer not null default 0,
 config jsonb not null default '{"enabled":false,"testMode":true,"monthlyCredits":{"play_pass":0,"play_pass_pro":0},"standardCredits":null,"premiumCredits":null,"standardUsdMicros":null,"premiumUsdMicros":null,"dailyUsdMicros":null,"userMonthlyUsdMicros":null,"maxConcurrent":1,"packages":[],"finance":{"taxBps":0,"stripeBps":0,"stripeFixedCents":0,"affiliateBps":0,"infrastructureCents":0,"usdToCurrency":null,"minimumMarginBps":null}}',
 updated_at timestamptz not null default now());
insert into public.animation_settings(singleton) values(true) on conflict do nothing;
create table if not exists public.animation_credit_batches(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 source text unique not null,kind text not null check(kind in ('included','purchased')),issued integer not null check(issued>0),
 remaining integer not null check(remaining>=0),reversed integer not null default 0 check(reversed>=0),starts_at timestamptz not null default now(),expires_at timestamptz,test boolean not null,
 created_at timestamptz not null default now());
alter table public.animation_credit_batches add column if not exists starts_at timestamptz not null default now();
create table if not exists public.animation_credit_debts(user_id uuid not null references auth.users(id) on delete cascade,test boolean not null,amount integer not null default 0 check(amount>=0),primary key(user_id,test));
create table if not exists public.animation_transactions(
 id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,
 reference text unique not null,kind text not null,amount integer not null,test boolean not null,created_at timestamptz not null default now());
create table if not exists public.animation_universes(
 id text primary key,user_id uuid references auth.users(id) on delete cascade,name text not null,description text not null,base text not null,
 created_at timestamptz not null default now());
insert into public.animation_universes(id,name,description,base) values
 ('vampire','Vampire Kingdom','Gothic castles and crimson moonlight.','vampire'),('knights','Medieval Knights','Armour and golden fortresses.','knights'),
 ('superhero','Superheroes','Original heroes above the city.','superhero'),('galactic','Galactic Empire','Distant planets and cosmic light.','galactic'),
 ('military','Military','Fictional tactical cinematic scenes.','military'),('fantasy','Dark Fantasy','Mystical forests and ancient ruins.','fantasy'),
 ('cyberpunk','Cyberpunk','Neon, holograms and rain.','cyberpunk'),('anime','Anime','Vibrant original anime worlds.','anime') on conflict do nothing;
create table if not exists public.animation_media(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 path text unique not null,mime text not null check(mime in ('image/jpeg','image/png','image/webp','video/mp4')),bytes bigint not null check(bytes>0 and bytes<=104857600),
 title text not null,world text not null references public.animation_universes(id),format text not null check(format in ('9:16','16:9')),
 fan text not null default '',kind text not null check(kind in ('photo','upload','generated','character')),ready boolean not null default false,
 deleted boolean not null default false,created_at timestamptz not null default now());
create table if not exists public.animation_jobs(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,
 photo_id uuid references public.animation_media(id),world text not null references public.animation_universes(id),title text not null,prompt text not null,
 tier text not null check(tier in ('standard','premium')),format text not null check(format in ('9:16','16:9')),duration integer not null default 5 check(duration=5),
 consent_at timestamptz not null default now(),moderated_by uuid references auth.users(id) on delete set null,
 status text not null default 'moderation' check(status in ('moderation','queued','submitting_image','image_queued','submitting_video','video_queued','saving','completed','failed','review')),
 credits integer not null check(credits>0),estimated_usd_micros bigint not null check(estimated_usd_micros>0),test boolean not null,
 image_model text not null,video_model text not null,image_request text,video_request text,character_path text,
 result_id uuid references public.animation_media(id),error text,settled boolean not null default false,
 lease uuid,lease_until timestamptz,next_poll_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,request_id));
create table if not exists public.animation_allocations(job_id uuid references public.animation_jobs(id) on delete cascade,batch_id uuid references public.animation_credit_batches(id) on delete cascade,amount integer not null check(amount>0),primary key(job_id,batch_id));
create table if not exists public.animation_orders(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,
 package_id text not null,credits integer not null check(credits>0),amount integer not null check(amount>0),currency text not null,test boolean not null,
 status text not null default 'pending',session_id text unique,intent text unique,customer_id text,refunded_amount integer not null default 0,
 created_at timestamptz not null default now(),unique(user_id,request_id));
create table if not exists public.animation_stripe_accounts(
 user_id uuid not null references auth.users(id) on delete cascade,customer_id text not null,test boolean not null,primary key(user_id,test),unique(customer_id,test));
create table if not exists public.animation_stripe_periods(
 source text primary key,user_id uuid not null references auth.users(id) on delete cascade,subscription_id text,plan text not null,
 starts_at timestamptz not null,ends_at timestamptz not null,test boolean not null,created_at timestamptz not null default now(),unique(subscription_id,starts_at,test));
create table if not exists public.animation_rules(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,clip uuid not null references public.animation_media(id) on delete cascade,
 type text not null check(type in ('gift','user','threshold','manual')),gift text not null default '',username text not null default '',threshold integer not null check(threshold between 1 and 1000000),enabled boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.animation_overlay_tokens(user_id uuid primary key references auth.users(id) on delete cascade,token_hash text unique not null,expires_at timestamptz not null);
create table if not exists public.animation_playback(
 id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,event_key text not null,clip uuid not null references public.animation_media(id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','playing','done','error')),lease uuid,lease_until timestamptz,created_at timestamptz not null default now(),unique(user_id,event_key,clip));
create table if not exists public.animation_storage_cleanup(path text primary key,created_at timestamptz not null default now());
create index if not exists animation_jobs_pending on public.animation_jobs(status,next_poll_at);
create index if not exists animation_media_user on public.animation_media(user_id,created_at desc);
create index if not exists animation_batches_user on public.animation_credit_batches(user_id,test,expires_at);
create index if not exists animation_playback_user on public.animation_playback(user_id,status,id);

-- Only the server can write or read sensitive operational data. No direct credit
-- mutation by authenticated clients. Owner-scoped read policies on library/rules.
do $$declare n text;begin
 foreach n in array array['animation_settings','animation_credit_batches','animation_credit_debts','animation_transactions','animation_universes','animation_media','animation_jobs','animation_allocations','animation_orders','animation_stripe_accounts','animation_stripe_periods','animation_rules','animation_overlay_tokens','animation_playback','animation_storage_cleanup'] loop
  execute format('alter table public.%I enable row level security',n);
  execute format('revoke all on public.%I from public,anon,authenticated',n);
  execute format('grant all on public.%I to service_role',n);
 end loop;
end $$;
grant usage,select on sequence public.animation_transactions_id_seq,public.animation_playback_id_seq to service_role;
grant select on public.animation_universes,public.animation_media,public.animation_rules to authenticated;
drop policy if exists animation_worlds_read on public.animation_universes;
create policy animation_worlds_read on public.animation_universes for select to authenticated using(user_id is null or user_id=auth.uid());
drop policy if exists animation_media_read on public.animation_media;
create policy animation_media_read on public.animation_media for select to authenticated using(user_id=auth.uid() and not deleted);
drop policy if exists animation_rules_read on public.animation_rules;
create policy animation_rules_read on public.animation_rules for select to authenticated using(user_id=auth.uid());

-- Account deletion must not orphan photos/character frames in private storage.
-- The secured worker deletes these objects; retries are idempotent.
create or replace function public.animation_schedule_storage_delete() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='animation_media' then insert into public.animation_storage_cleanup(path) values(old.path) on conflict do nothing;
 elsif old.character_path is not null then insert into public.animation_storage_cleanup(path) values(old.character_path) on conflict do nothing;end if;return old;
end $$;
drop trigger if exists animation_media_delete_storage on public.animation_media;
create trigger animation_media_delete_storage after delete on public.animation_media for each row execute function public.animation_schedule_storage_delete();
drop trigger if exists animation_job_delete_storage on public.animation_jobs;
create trigger animation_job_delete_storage after delete on public.animation_jobs for each row execute function public.animation_schedule_storage_delete();
revoke all on function public.animation_schedule_storage_delete() from public,anon,authenticated;

create or replace function public.animation_grant(p_user uuid,p_source text,p_kind text,p_credits integer,p_expires timestamptz,p_test boolean) returns uuid
language plpgsql security definer set search_path='' as $$declare b public.animation_credit_batches;debt integer;begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,912));
 select * into b from public.animation_credit_batches where source=p_source;
 if b.id is not null then
  if b.user_id<>p_user or b.issued<>p_credits or b.test<>p_test or b.kind<>p_kind then raise exception 'ANIM_GRANT_MISMATCH';end if;
  return b.id;
 end if;
 select least(amount,p_credits) into debt from public.animation_credit_debts where user_id=p_user and test=p_test;debt:=coalesce(debt,0);
 insert into public.animation_credit_batches(user_id,source,kind,issued,remaining,expires_at,test) values(p_user,p_source,p_kind,p_credits,p_credits-debt,p_expires,p_test) returning * into b;
 if debt>0 then
  update public.animation_credit_debts set amount=amount-debt where user_id=p_user and test=p_test;
  insert into public.animation_transactions(user_id,reference,kind,amount,test) values(p_user,'debt:'||p_source,'debt_settlement',-debt,p_test);
 end if;
 insert into public.animation_transactions(user_id,reference,kind,amount,test) values(p_user,'grant:'||p_source,'grant',p_credits,p_test);
 return b.id;
end $$;

create or replace function public.animation_reverse(p_source text,p_total integer) returns void
language plpgsql security definer set search_path='' as $$declare b public.animation_credit_batches;delta integer;removed integer;begin
 select * into b from public.animation_credit_batches where source=p_source;if b.id is null then return;end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(b.user_id::text,912));
 select * into b from public.animation_credit_batches where source=p_source for update;
 delta:=greatest(0,least(b.issued,p_total)-b.reversed);if delta=0 then return;end if;
 removed:=least(delta,b.remaining);
 update public.animation_credit_batches set remaining=remaining-removed,reversed=reversed+delta where id=b.id;
 insert into public.animation_credit_debts(user_id,test,amount) values(b.user_id,b.test,delta-removed) on conflict(user_id,test) do update set amount=public.animation_credit_debts.amount+excluded.amount;
 insert into public.animation_transactions(user_id,reference,kind,amount,test) values(b.user_id,'reverse:'||p_source||':'||(b.reversed+delta),'reversal',-delta,b.test);
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
 select config into cfg from public.animation_settings where singleton;
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
 if(select coalesce(sum(estimated_usd_micros),0) from public.animation_jobs where created_at>=date_trunc('day',now()))+estimate>(cfg->>'dailyUsdMicros')::bigint then raise exception 'ANIM_GLOBAL_BUDGET';end if;
 if(select coalesce(sum(estimated_usd_micros),0) from public.animation_jobs where user_id=p_user and created_at>=date_trunc('month',now()))+estimate>(cfg->>'userMonthlyUsdMicros')::bigint then raise exception 'ANIM_USER_BUDGET';end if;
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

create or replace function public.animation_settle(p_job uuid,p_success boolean,p_error text default null,p_result uuid default null) returns void
language plpgsql security definer set search_path='' as $$declare j public.animation_jobs;a record;debt integer;returned integer:=0;begin
 select * into j from public.animation_jobs where id=p_job;if j.id is null then raise exception 'ANIM_INVALID';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(j.user_id::text,912));
 select * into j from public.animation_jobs where id=p_job for update;if j.settled then return;end if;
 if p_success and not exists(select 1 from public.animation_media where id=p_result and user_id=j.user_id and kind='generated' and ready and not deleted) then raise exception 'ANIM_INVALID';end if;
 if not p_success then
  for a in select x.amount,b.* from public.animation_allocations x join public.animation_credit_batches b on b.id=x.batch_id where x.job_id=j.id loop
   select coalesce(amount,0) into debt from public.animation_credit_debts where user_id=j.user_id and test=j.test;debt:=least(coalesce(debt,0),a.amount);
   if debt>0 then update public.animation_credit_debts set amount=amount-debt where user_id=j.user_id and test=j.test;end if;
   if a.expires_at is null or a.expires_at>now() then
    update public.animation_credit_batches set remaining=least(issued-reversed,remaining+a.amount-debt) where id=a.id;returned:=returned+a.amount-debt;
   end if;
  end loop;
 end if;
 update public.animation_jobs set status=case when p_success then 'completed' else 'failed' end,result_id=p_result,error=p_error,settled=true,lease=null,lease_until=null,updated_at=now() where id=p_job;
 insert into public.animation_transactions(user_id,reference,kind,amount,test) values(j.user_id,'settle:'||j.id,case when p_success then 'consume' else 'return' end,case when p_success then 0 else returned end,j.test);
end $$;

create or replace function public.animation_claim(p_user uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$declare j public.animation_jobs;begin
 select * into j from public.animation_jobs where (p_user is null or user_id=p_user) and status in ('queued','submitting_image','image_queued','submitting_video','video_queued','saving') and next_poll_at<=now() and (lease_until is null or lease_until<now()) order by updated_at for update skip locked limit 1;
 if j.id is null then return null;end if;
 -- A timed-out submit has an unknown provider outcome. Never submit twice.
 if j.status in ('submitting_image','submitting_video') then update public.animation_jobs set status='review',error='ANIM_SUBMISSION_UNCERTAIN',lease=null,lease_until=null where id=j.id;return null;end if;
 update public.animation_jobs set lease=gen_random_uuid(),lease_until=now()+interval '4 minutes',next_poll_at=now()+interval '8 seconds',updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;

-- Server returns only safe, selected columns to the browser.
create or replace function public.animation_wallet(p_user uuid,p_test boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('included',coalesce(sum(remaining) filter(where kind='included'),0),'purchased',coalesce(sum(remaining) filter(where kind='purchased'),0),'debt',coalesce((select amount from public.animation_credit_debts where user_id=p_user and test=p_test),0),'test',p_test) from public.animation_credit_batches where user_id=p_user and test=p_test and starts_at<=now() and (expires_at is null or expires_at>now()) $$;

create or replace function public.animation_enqueue(p_user uuid,p_event text,p_clips uuid[]) returns integer
language plpgsql security definer set search_path='' as $$declare n integer;room integer;begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,914));
 delete from public.animation_playback where user_id=p_user and created_at<now()-interval '1 day';
 room:=20-(select count(*) from public.animation_playback where user_id=p_user and status in ('queued','playing') and created_at>now()-interval '5 minutes');
 if room<=0 then raise exception 'ANIM_QUEUE_FULL';end if;
 insert into public.animation_playback(user_id,event_key,clip) select p_user,left(p_event,150),m.id from public.animation_media m where m.id=any(p_clips) and m.user_id=p_user and m.ready and not m.deleted and m.mime='video/mp4' limit room on conflict do nothing;
 get diagnostics n=row_count;return n;
end $$;
create or replace function public.animation_overlay_next(p_user uuid,p_ack bigint default null,p_lease uuid default null,p_error boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$declare q public.animation_playback;begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,914));
 if p_ack is not null then update public.animation_playback set status=case when p_error then 'error' else 'done' end where id=p_ack and user_id=p_user and lease=p_lease and status='playing';end if;
 -- At-most-once playback across two Browser Sources. Expired playing entries
 -- become errors, never replay automatically after a browser crash.
 update public.animation_playback set status='error' where user_id=p_user and status='playing' and lease_until<now();
 if exists(select 1 from public.animation_playback where user_id=p_user and status='playing') then return null;end if;
 select * into q from public.animation_playback where user_id=p_user and status='queued' and created_at>now()-interval '5 minutes' order by id limit 1 for update;
 if q.id is null then return null;end if;
 update public.animation_playback set status='playing',lease=gen_random_uuid(),lease_until=now()+interval '3 minutes' where id=q.id returning * into q;return to_jsonb(q);
end $$;

do $$declare f record;begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('animation_grant','animation_reverse','animation_reserve','animation_settle','animation_claim','animation_wallet','animation_enqueue','animation_overlay_next') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

-- No public bucket, no client policies granting writes. Signed upload URLs are
-- issued only by authenticated server code with fixed owner paths and limits.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('studio-animations','studio-animations',false,104857600,array['image/jpeg','image/png','image/webp','video/mp4']) on conflict(id) do nothing;

create table if not exists public.animation_rate_limits(key text primary key,started_at timestamptz not null default now(),count integer not null default 1);
alter table public.animation_rate_limits enable row level security;
revoke all on public.animation_rate_limits from public,anon,authenticated;
grant all on public.animation_rate_limits to service_role;
create or replace function public.animation_rate_limit(p_key text,p_limit integer) returns boolean
language plpgsql security definer set search_path='' as $$declare n integer;begin
 insert into public.animation_rate_limits(key) values(p_key) on conflict(key) do update set count=case when public.animation_rate_limits.started_at<now()-interval '1 minute' then 1 else public.animation_rate_limits.count+1 end,started_at=case when public.animation_rate_limits.started_at<now()-interval '1 minute' then now() else public.animation_rate_limits.started_at end returning count into n;
 return n<=p_limit;
end $$;
revoke all on function public.animation_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.animation_rate_limit(text,integer) to service_role;

create or replace function public.animation_credit_payment(p_order uuid,p_session text,p_intent text,p_customer text,p_refunded integer default 0,p_disputed boolean default false) returns void
language plpgsql security definer set search_path='' as $$declare o public.animation_orders;total integer;begin
 select * into o from public.animation_orders where id=p_order;if o.id is null then raise exception 'ANIM_INVALID';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(o.user_id::text,912));
 select * into o from public.animation_orders where id=p_order for update;
 if o.session_id is not null and o.session_id<>p_session or o.intent is not null and o.intent<>p_intent then raise exception 'ANIM_PAYMENT_MISMATCH';end if;
 if o.status in ('failed','expired') then return;end if;
 update public.animation_orders set session_id=p_session,intent=p_intent,customer_id=p_customer,status=case when p_disputed then 'disputed' when p_refunded>0 then 'refunded' else 'paid' end,refunded_amount=greatest(refunded_amount,p_refunded) where id=o.id;
 perform public.animation_grant(o.user_id,'checkout:'||o.id,'purchased',o.credits,null,o.test);
 total:=case when p_disputed then o.credits else ceil(o.credits::numeric*greatest(o.refunded_amount,p_refunded)/o.amount)::integer end;
 if total>0 then perform public.animation_reverse('checkout:'||o.id,total);end if;
 if p_customer is not null then insert into public.animation_stripe_accounts(user_id,customer_id,test) values(o.user_id,p_customer,o.test) on conflict(user_id,test) do update set customer_id=excluded.customer_id;end if;
end $$;
revoke all on function public.animation_credit_payment(uuid,text,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.animation_credit_payment(uuid,text,text,text,integer,boolean) to service_role;

create or replace function public.animation_create_order(p_user uuid,p_request uuid,p_package text,p_test boolean) returns jsonb
language plpgsql security definer set search_path='' as $$declare cfg jsonb;pack jsonb;o public.animation_orders;begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,912));
 select * into o from public.animation_orders where user_id=p_user and request_id=p_request;
 if o.id is not null then
  if o.package_id<>p_package or o.test<>p_test then raise exception 'ANIM_INVALID';end if;return to_jsonb(o);
 end if;
 select config into cfg from public.animation_settings where singleton;
 select item into pack from jsonb_array_elements(cfg->'packages') item where item->>'id'=p_package and item->>'enabled'='true';
 if pack is null or (cfg->>'testMode')::boolean<>p_test then raise exception 'ANIM_PACKAGE_UNAVAILABLE';end if;
 if(select count(*) from public.animation_orders where user_id=p_user and created_at>now()-interval '15 minutes')>=12 then raise exception 'ANIM_RATE_LIMIT';end if;
 insert into public.animation_orders(user_id,request_id,package_id,credits,amount,currency,test) values(p_user,p_request,p_package,(pack->>'credits')::integer,(pack->>'amount')::integer,lower(pack->>'currency'),p_test) returning * into o;return to_jsonb(o);
end $$;
create or replace function public.animation_invoice_grant(p_user uuid,p_source text,p_subscription text,p_plan text,p_start timestamptz,p_end timestamptz,p_test boolean) returns void
language plpgsql security definer set search_path='' as $$declare n integer;begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,912));
 if p_plan not in ('play_pass','play_pass_pro') or p_end<=p_start or p_end>p_start+interval '32 days' then raise exception 'ANIM_INVALID';end if;
 insert into public.animation_stripe_periods(source,user_id,subscription_id,plan,starts_at,ends_at,test) values(p_source,p_user,p_subscription,p_plan,p_start,p_end,p_test) on conflict do nothing;
 if not found then return;end if;
 select (config->'monthlyCredits'->>p_plan)::integer into n from public.animation_settings where singleton;
 if n>0 then perform public.animation_grant(p_user,p_source,'included',n,p_end,p_test);update public.animation_credit_batches set starts_at=p_start where source=p_source;end if;
end $$;
revoke all on function public.animation_create_order(uuid,uuid,text,boolean),public.animation_invoice_grant(uuid,text,text,text,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.animation_create_order(uuid,uuid,text,boolean),public.animation_invoice_grant(uuid,text,text,text,timestamptz,timestamptz,boolean) to service_role;

create or replace function public.animation_erase_data(p_user uuid) returns text[]
language plpgsql security definer set search_path='' as $$declare paths text[];begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,912));
 if exists(select 1 from public.animation_jobs where user_id=p_user and not settled) then raise exception 'ANIM_MEDIA_IN_USE';end if;
 select array_agg(distinct path) into paths from(select path from public.animation_media where user_id=p_user union select character_path from public.animation_jobs where user_id=p_user and character_path is not null)p;
 insert into public.animation_storage_cleanup(path) select unnest(paths) on conflict do nothing;
 delete from public.animation_overlay_tokens where user_id=p_user;
 delete from public.animation_rules where user_id=p_user;
 delete from public.animation_playback where user_id=p_user;
 update public.animation_jobs set title='Deleted',prompt='',photo_id=null,result_id=null,character_path=null where user_id=p_user;
 delete from public.animation_media where user_id=p_user;
 update public.animation_universes set name='Deleted',description='' where user_id=p_user;
 return coalesce(paths,array[]::text[]);
end $$;
revoke all on function public.animation_erase_data(uuid) from public,anon,authenticated;
grant execute on function public.animation_erase_data(uuid) to service_role;
create or replace function public.animation_review_job(p_job uuid,p_user uuid,p_approve boolean,p_actor uuid default null) returns void
language plpgsql security definer set search_path='' as $$declare j public.animation_jobs;begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,912));
 select * into j from public.animation_jobs where id=p_job and user_id=p_user for update;
 if j.id is null or j.status<>'moderation' then raise exception 'ANIM_INVALID';end if;
 if p_approve then update public.animation_jobs set status='queued',moderated_by=p_actor where id=p_job;
 else perform public.animation_settle(p_job,false,'ANIM_CONTENT_REJECTED',null);end if;
end $$;
revoke all on function public.animation_review_job(uuid,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.animation_review_job(uuid,uuid,boolean,uuid) to service_role;

-- Existing products are one-time monthly access, not Stripe subscriptions.
-- Their paid activation grants one monthly AI lot without changing access.
create or replace function public.animation_existing_payment() returns trigger
language plpgsql security definer set search_path='' as $$declare n integer;start_at timestamptz;end_at timestamptz;begin
 if new.status in ('paid','test_paid') and old.status='pending' then
  select (config->'monthlyCredits'->>new.plan)::integer into n from public.animation_settings where singleton;
  select starts_at,ends_at into start_at,end_at from public.account_access_grants where source_payment=new.id;
  -- AFTER UPDATE runs before the original billing function inserts access.
  -- Use the payment activation month; never grant on unpaid future renewals.
  start_at:=coalesce(start_at,new.paid_at,now());end_at:=coalesce(end_at,start_at+interval '1 month');
  if n>0 then perform public.animation_grant(new.user_id,'access-payment:'||new.id,'included',n,end_at,not new.live);end if;
 elsif new.status in ('refunded','disputed') and old.status in ('paid','test_paid','disputed') then
  select issued into n from public.animation_credit_batches where source='access-payment:'||new.id;
  if n>0 then perform public.animation_reverse('access-payment:'||new.id,n);end if;
 end if;return new;
end $$;
drop trigger if exists animation_billing_credits on public.billing_orders;
create trigger animation_billing_credits after update on public.billing_orders for each row execute function public.animation_existing_payment();
revoke all on function public.animation_existing_payment() from public,anon,authenticated;
commit;
