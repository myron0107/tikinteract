import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const u='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002',photo='20000000-0000-0000-0000-000000000001';
async function fixture(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);insert into auth.users values('${u}'),('${other}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table public.billing_orders(id uuid primary key,user_id uuid,plan text,status text,paid_at timestamptz,live boolean);
 create table public.account_access_grants(source_payment uuid,starts_at timestamptz,ends_at timestamptz);
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 const sql=await readFile(new URL('../supabase/animations.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await db.exec(`update public.animation_settings set config=jsonb_set(config,'{enabled}','true')||'{"standardCredits":10,"premiumCredits":30,"standardUsdMicros":300000,"premiumUsdMicros":650000,"dailyUsdMicros":10000000,"userMonthlyUsdMicros":10000000}'::jsonb;
 insert into public.animation_media(id,user_id,path,mime,bytes,title,world,format,kind,ready) values('${photo}','${u}','${u}/photo.jpg','image/jpeg',100,'Photo','vampire','9:16','photo',true);`);
 const call=async(name,args=[])=>{const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');return(await db.query(`select public.${name}(${placeholders}) as data`,args)).rows[0].data;};
 const grant=(source,credits,kind='purchased',expires=null,testMode=true,user=u)=>call('animation_grant',[user,source,kind,credits,expires,testMode]);
 const reserve=(id=crypto.randomUUID(),user=u)=>call('animation_reserve',[user,id,JSON.stringify({tier:'standard',photo_id:photo,world:'vampire',title:'Test',prompt:'Waves to the audience',format:'9:16'}),'fal-ai/flux-pro/kontext','minimax/h3-max-turbo/image-to-video']);
 const wallet=()=>call('animation_wallet',[u,true]);return {db,call,grant,reserve,wallet};
}
test('PostgreSQL: RLS, server-only credits, zero FREE grant, atomic included-first reservation, settlement and expiry',async()=>{
 const f=await fixture();try{
  assert.deepEqual(await f.wallet(),{included:0,purchased:0,debt:0,test:true});await assert.rejects(f.reserve(),/ANIM_INSUFFICIENT_CREDITS/);
  await f.grant('included',6,'included',new Date(Date.now()+86400000).toISOString());await f.grant('purchased',20);
  await f.grant('included',6,'included',new Date(Date.now()+86400000).toISOString());assert.equal((await f.wallet()).included,6,'Grant replay never credits twice');
  await assert.rejects(f.grant('included',100),/ANIM_GRANT_MISMATCH/);
  const id=crypto.randomUUID(),job=await f.reserve(id);assert.equal(job.status,'moderation');assert.equal((await f.reserve(id)).id,job.id);assert.deepEqual(await f.wallet(),{included:0,purchased:16,debt:0,test:true});
  await assert.rejects(f.reserve(),/ANIM_CONCURRENCY/);
  await f.call('animation_settle',[job.id,false,'REJECTED',null]);await f.call('animation_settle',[job.id,false,'REJECTED',null]);assert.equal((await f.wallet()).included,6);assert.equal((await f.wallet()).purchased,20);
  const j=await f.reserve();await f.db.exec("update public.animation_credit_batches set expires_at=now()-interval '1 second' where source='included'");await f.call('animation_settle',[j.id,false,'FAILED',null]);assert.equal((await f.wallet()).included,0);assert.equal((await f.wallet()).purchased,20,'Expired included lot must not resurrect');
  await f.db.exec(`set request.jwt.claim.sub='${u}';set role authenticated`);
  await assert.rejects(f.db.query('select public.animation_grant($1,$2,$3,100,null,true)',[u,'hacked','purchased']),/permission denied/);
  await assert.rejects(f.db.exec('update public.animation_credit_batches set remaining=999'),/permission denied/);
  const rows=await f.db.query('select * from public.animation_media');assert.equal(rows.rows.length,1);
  await f.db.exec(`reset role;set request.jwt.claim.sub='${other}';set role authenticated`);assert.equal((await f.db.query('select * from public.animation_media')).rows.length,0);
 }finally{await f.db.close();}
});
test('PostgreSQL: refunds/disputes are replay-safe and cannot create a negative balance or refund a generation twice',async()=>{
 const f=await fixture();try{
  await f.grant('pack',20);const job=await f.reserve();await f.call('animation_reverse',['pack',20]);assert.equal((await f.wallet()).purchased,0);assert.equal((await f.wallet()).debt,10);
  await f.call('animation_reverse',['pack',20]);assert.equal((await f.wallet()).debt,10);
  await f.call('animation_settle',[job.id,false,'FAILED',null]);assert.equal((await f.wallet()).debt,0);assert.equal((await f.wallet()).purchased,0);
  await f.grant('newpack',20);const j=await f.reserve();
  const media=await f.db.query(`insert into public.animation_media(user_id,path,mime,bytes,title,world,format,kind,ready) values('${u}','${u}/result.mp4','video/mp4',100,'Result','vampire','9:16','generated',true) returning id`);
  await f.call('animation_settle',[j.id,true,null,media.rows[0].id]);await f.call('animation_settle',[j.id,false,'FAILED',null]);assert.equal((await f.wallet()).purchased,10);
  await f.call('animation_reverse',['newpack',20]);assert.equal((await f.wallet()).debt,10);await assert.rejects(f.reserve(),/ANIM_CREDIT_DEBT/);
  await f.grant('debt-topup',15);assert.equal((await f.wallet()).debt,0);assert.equal((await f.wallet()).purchased,5);
 }finally{await f.db.close();}
});
test('PostgreSQL: Test/Live wallets, immutable order prices, duplicate paid webhooks and paid invoice periods',async()=>{
 const f=await fixture();try{
  await f.grant('live-pack',100,'purchased',null,false);assert.equal((await f.wallet()).purchased,0);await assert.rejects(f.reserve(),/ANIM_INSUFFICIENT_CREDITS/);
  await f.db.exec(`update public.animation_settings set config=jsonb_set(jsonb_set(config,'{packages}','[{"id":"pack","enabled":true,"credits":20,"amount":1500,"currency":"ron"}]'),'{monthlyCredits}','{"play_pass":5,"play_pass_pro":15}')`);
  const req=crypto.randomUUID(),o=await f.call('animation_create_order',[u,req,'pack',true]);assert.equal(o.amount,1500);await f.db.exec(`update public.animation_settings set config=jsonb_set(config,'{packages,0,amount}','2000')`);assert.equal((await f.call('animation_create_order',[u,req,'pack',true])).amount,1500);
  await f.call('animation_credit_payment',[o.id,'cs_test_fixture','pi_fixture','cus_fixture',0,false]);await f.call('animation_credit_payment',[o.id,'cs_test_fixture','pi_fixture','cus_fixture',0,false]);assert.equal((await f.wallet()).purchased,20);
  await f.call('animation_credit_payment',[o.id,'cs_test_fixture','pi_fixture','cus_fixture',750,false]);assert.equal((await f.wallet()).purchased,10);
  const period=[u,'invoice:in_fixture:period','sub_fixture','play_pass',new Date().toISOString(),new Date(Date.now()+30*86400000).toISOString(),true];await f.call('animation_invoice_grant',period);await f.call('animation_invoice_grant',period);assert.equal((await f.wallet()).included,5);
  await f.call('animation_invoice_grant',[u,'invoice:duplicate-period','sub_fixture',...period.slice(3)]);assert.equal((await f.wallet()).included,5,'Another invoice for the same subscription period must not double grant');
  await assert.rejects(f.call('animation_invoice_grant',[...period.slice(0,5),new Date(Date.now()+366*86400000).toISOString(),true]),/ANIM_INVALID/);
 }finally{await f.db.close();}
});
test('PostgreSQL: atomic moderation/cancel prevents racing paid jobs; erasure preserves finance and schedules all private objects',async()=>{
 const f=await fixture();try{
  await f.grant('pack',30);const job=await f.reserve();await f.call('animation_review_job',[job.id,u,true,u]);
  await assert.rejects(f.call('animation_review_job',[job.id,u,false,null]),/ANIM_INVALID/);assert.equal((await f.wallet()).purchased,20);
  await assert.rejects(f.call('animation_erase_data',[u]),/ANIM_MEDIA_IN_USE/);await f.call('animation_settle',[job.id,false,'TEST',null]);
  const paths=await f.call('animation_erase_data',[u]);assert(paths.includes(u+'/photo.jpg'));assert.equal((await f.db.query('select count(*)::integer n from public.animation_media')).rows[0].n,0);
  assert.equal((await f.db.query('select prompt from public.animation_jobs')).rows[0].prompt,'');assert.equal((await f.wallet()).purchased,30);
  assert.equal((await f.db.query('select count(*)::integer n from public.animation_storage_cleanup')).rows[0].n,1);
 }finally{await f.db.close();}
});
test('PostgreSQL: spending limits, uncertain submissions, queue leases and duplicate LIVE events',async()=>{
 const f=await fixture();try{
  await f.grant('pack',100);await f.db.exec("update public.animation_settings set config=jsonb_set(config,'{dailyUsdMicros}','1')");await assert.rejects(f.reserve(),/ANIM_GLOBAL_BUDGET/);assert.equal((await f.wallet()).purchased,100);
  await f.db.exec("update public.animation_settings set config=jsonb_set(config,'{dailyUsdMicros}','10000000')");const j=await f.reserve();await f.db.exec(`update public.animation_jobs set status='submitting_image' where id='${j.id}'`);assert.equal(await f.call('animation_claim',[u]),null);assert.equal((await f.db.query(`select status from public.animation_jobs where id='${j.id}'`)).rows[0].status,'review');
  const media=(await f.db.query(`insert into public.animation_media(user_id,path,mime,bytes,title,world,format,kind,ready) values('${u}','${u}/video.mp4','video/mp4',100,'Video','vampire','9:16','upload',true) returning id`)).rows[0].id;
  assert.equal(await f.call('animation_enqueue',[u,'gift:1',[media]]),1);assert.equal(await f.call('animation_enqueue',[u,'gift:1',[media]]),0);
  const clip=await f.call('animation_overlay_next',[u,null,null,false]);assert.equal(await f.call('animation_overlay_next',[u,null,null,false]),null);
  await f.call('animation_overlay_next',[u,clip.id,crypto.randomUUID(),false]);assert.equal((await f.db.query('select status from public.animation_playback')).rows[0].status,'playing');
  await f.call('animation_overlay_next',[u,clip.id,clip.lease,false]);assert.equal((await f.db.query('select status from public.animation_playback')).rows[0].status,'done');
 }finally{await f.db.close();}
});
