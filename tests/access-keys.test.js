import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {DEFAULT_CONFIG,cloneConfig} from '../assets/platform-schema.js';

test('real access keys enforce roles, single redemption, calendar periods, upgrades, expiry, revocation and private storage',async()=>{
 const db=new PGlite(),ids={owner:'10000000-0000-0000-0000-000000000001',editor:'10000000-0000-0000-0000-000000000002',admin:'10000000-0000-0000-0000-000000000003',customer:'10000000-0000-0000-0000-000000000004',other:'10000000-0000-0000-0000-000000000005',unconfirmed:'10000000-0000-0000-0000-000000000006'};
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
   create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for(const [name,id] of Object.entries(ids))await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,name==='owner'?'mironsergiuflorin@gmail.com':name+'@example.invalid',name==='unconfirmed'?null:new Date().toISOString()]);
  await db.exec(await readFile(new URL('../supabase/admin.sql',import.meta.url),'utf8'));
  const migration=await readFile(new URL('../supabase/access-keys.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
  async function rpc(user,sql,args=[]){await db.exec(`reset role;set request.jwt.claim.sub='${ids[user]||''}';set role ${user?'authenticated':'anon'}`);try{return(await db.query('select public.'+sql+' as data',args)).rows[0].data;}finally{await db.exec('reset role');}}
  const get=user=>rpc(user,'get_my_access()'),redeem=(user,code)=>rpc(user,'redeem_access_key($1)',[code]);
  const generate=async(plan='play_pass',months=1,email=null,count=1)=>rpc('owner','generate_access_keys($1,$2,$3,\'Test keys\',$4,90)',[plan,months,count,email]);
  await rpc('owner',"manage_site_admin('editor@example.invalid','editor')");await rpc('owner',"manage_site_admin('admin@example.invalid','admin')");
  await assert.rejects(get(null),/permission denied/);await assert.rejects(get('unconfirmed'),/ACCESS_ACCOUNT_REQUIRED/);
  for(const user of ['customer','editor']){
   await assert.rejects(rpc(user,"generate_access_keys('play_pass',1)"),/ACCESS_ADMIN_REQUIRED/);
   await assert.rejects(rpc(user,'list_access_keys()'),/ACCESS_ADMIN_REQUIRED/);
  }
  for(const [months,count] of [[2,1],[12,26],[1,0],[null,1]])await assert.rejects(rpc('owner',"generate_access_keys('play_pass',$1,$2)",[months,count]),/ACCESS_INVALID_OPTIONS/);
  let a=await get('customer');assert.equal(a.plan,'free');assert.deepEqual(a.periods,[]);
  for(const months of [1,3,6,12]){const [key]=await generate('play_pass',months);assert.equal(key.months,months);assert.match(key.code,/^TI-(?:[A-F0-9]{8}-){3}[A-F0-9]{8}$/);}
  const [key]=await generate();let result=await redeem('customer',key.code.toLowerCase().replaceAll('-',' '));assert.equal(result.ok,true);a=result.access;assert.equal(a.plan,'play_pass');const originalEnd=a.validUntil;
  assert.equal((await get('other')).plan,'free');const duplicate=await redeem('customer',key.code);assert.equal(duplicate.alreadyRedeemed,true);assert.equal(duplicate.access.validUntil,originalEnd);
  assert.equal((await redeem('other',key.code)).ok,false);
  const list=await rpc('owner','list_access_keys()');assert(list.items.some(k=>k.redeemedBy==='customer@example.invalid'));
  assert(!JSON.stringify(list).includes(key.code));assert(!JSON.stringify(list).includes('key_hash'));
  const [extend]=await generate('play_pass',3);result=await redeem('customer',extend.code);assert.equal(result.ok,true);assert.equal(result.startsAt,originalEnd);assert(Date.parse(result.access.validUntil)>Date.parse(originalEnd));
  const beforeUpgrade=await get('customer'),remaining=beforeUpgrade.periods.reduce((n,p)=>n+Math.max(0,Date.parse(p.endsAt)-Math.max(Date.parse(p.startsAt),Date.parse(beforeUpgrade.serverNow))),0);
  const [pro]=await generate('play_pass_pro',6);result=await redeem('customer',pro.code);assert.equal(result.access.plan,'play_pass_pro');const proEnd=result.access.validUntil;
  const base=result.access.periods.filter(p=>p.plan==='play_pass');assert(base.every(p=>Date.parse(p.startsAt)>=Date.parse(proEnd)));
  const preserved=base.reduce((n,p)=>n+Date.parse(p.endsAt)-Date.parse(p.startsAt),0);assert(Math.abs(remaining-preserved)<3000,'Unused Pass time is preserved, including queued extensions');
  const [passAfterPro]=await generate();result=await redeem('customer',passAfterPro.code);assert(Date.parse(result.startsAt)>=Date.parse(proEnd));assert.equal(result.access.plan,'play_pass_pro','A standard Pass must never downgrade active PRO');
  // Server-side checks use published game tiers and current grants, not user metadata.
  const config=cloneConfig(DEFAULT_CONFIG);config.games[0].plan='play_pass';config.games[1].plan='play_pass_pro';await rpc('owner','save_site_config($1,0,true)',[JSON.stringify(config)]);
  assert.equal(await rpc('customer',"check_game_access('neon-race-2')"),true);assert.equal(await rpc('customer',"check_game_access('moto-interact')"),true);assert.equal(await rpc('other',"check_game_access('moto-interact')"),false);
  assert.equal(await rpc('customer',"check_game_access('country-derby')"),false);assert.equal(await rpc('customer',"check_game_access('unknown-game')"),false);
  await assert.rejects(rpc('editor','revoke_access_key($1)',[pro.id]),/ACCESS_ADMIN_REQUIRED/);
  await rpc('admin','revoke_access_key($1)',[pro.id]);assert.equal((await get('customer')).plan,'free','A revoked PRO is removed; queued Pass retains its scheduled dates');assert.equal(await rpc('customer',"check_game_access('moto-interact')"),false);
  assert.equal((await redeem('customer',pro.code)).ok,false);await rpc('admin','revoke_access_key($1)',[pro.id]);
  const [bound]=await generate('play_pass',1,'other@example.invalid');assert.equal((await redeem('customer',bound.code)).ok,false);assert.equal((await redeem('other',bound.code)).ok,true);
  const [expired]=await generate();await db.query("update public.access_keys set redeem_before=now()-interval '1 second' where id=$1",[expired.id]);assert.equal((await redeem('other',expired.code)).ok,false);
  const [unusedRevoked]=await generate();await rpc('owner','revoke_access_key($1)',[unusedRevoked.id]);assert.equal((await redeem('other',unusedRevoked.code)).ok,false);
  const batch='20000000-0000-0000-0000-000000000001';await rpc('owner',"generate_access_keys('play_pass',1,1,'',null,90,$1)",[batch]);await assert.rejects(rpc('owner',"generate_access_keys('play_pass',1,1,'',null,90,$1)",[batch]),/ACCESS_BATCH_EXISTS/);
  // Calendar month-end arithmetic is UTC and clamps to February correctly, even under another session timezone.
  const year=new Date().getUTCFullYear()+3,jan31=`${year}-01-31T23:45:00.000Z`,expectedFeb=year%4===0&&(year%100!==0||year%400===0)?29:28;
  await db.query('update public.account_access_grants set ends_at=$1 where user_id=$2',[jan31,ids.other]);await db.exec("set timezone='Pacific/Kiritimati'");
  const [monthEnd]=await generate();result=await redeem('other',monthEnd.code);assert.equal(new Date(result.endsAt).toISOString(),`${year}-02-${expectedFeb}T23:45:00.000Z`);
  const [valid]=await generate();await db.query('delete from public.access_redeem_limits where user_id=$1',[ids.other]);
  for(let i=0;i<15;i++)assert.equal((await redeem('other','wrong')).code,'ACCESS_KEY_INVALID');assert.equal((await redeem('other',valid.code)).code,'ACCESS_RATE_LIMIT','Failed attempts persist rather than rolling back');
  await db.query("update public.access_redeem_limits set window_start=now()-interval '16 minutes' where user_id=$1",[ids.other]);assert.equal((await redeem('other',valid.code)).ok,true);
  await db.exec(`set request.jwt.claim.sub='${ids.customer}';set role authenticated;`);
  for(const table of ['access_keys','account_access_grants','access_key_events'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);await db.exec('reset role');
  const snapshots=(await db.query('select count(*)::integer n from public.access_keys')).rows[0].n;await db.exec(migration);assert.equal((await db.query('select count(*)::integer n from public.access_keys')).rows[0].n,snapshots);
  const legacy=cloneConfig(DEFAULT_CONFIG);legacy.plans[1].features=['Jocuri LIVE extinse','Evenimente interactive','Statistici de bază'];legacy.plans[1].priceCents=12500;legacy.plans[2].features=['Beneficiu personalizat'];
  await db.query('update public.site_settings set draft=$1,published=$1',[JSON.stringify(legacy)]);await db.exec(migration);
  const settings=(await db.query('select * from public.site_settings')).rows[0];assert.deepEqual(settings.published.plans[1].features,DEFAULT_CONFIG.plans[1].features);assert.equal(settings.published.plans[1].priceCents,12500);assert.deepEqual(settings.published.plans[2].features,['Beneficiu personalizat']);
  await db.exec(migration);assert.equal((await db.query('select revision from public.site_settings')).rows[0].revision,settings.revision,'Repeated installation must not rewrite custom plans or add duplicate history');
 }finally{await db.close();}
});
