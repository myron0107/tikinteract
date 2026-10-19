import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('owner directory lists every account; moderation, deletion and role changes enforce server permissions',async()=>{
 const db=new PGlite(),ids={owner:'10000000-0000-0000-0000-000000000001',editor:'10000000-0000-0000-0000-000000000002',admin:'10000000-0000-0000-0000-000000000003',user:'10000000-0000-0000-0000-000000000004',other:'10000000-0000-0000-0000-000000000005',unconfirmed:'10000000-0000-0000-0000-000000000006'};
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',encrypted_password text default 'NEVER_EXPOSE');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;
   create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
   create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade);`);
  for(const [name,id] of Object.entries(ids))await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)',[id,name==='owner'?'mironsergiuflorin@gmail.com':name+'@example.invalid',name==='unconfirmed'?null:new Date().toISOString(),JSON.stringify({display_name:'Nume '+name,role:'owner'})]);
  for(const file of ['admin.sql','support.sql','access-keys.sql','leaderboard.sql','leaderboard_periods.sql','tiktok_gifts.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  const migration=await readFile(new URL('../supabase/users.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
  async function rpc(user,sql,args=[]){await db.exec(`reset role;set request.jwt.claim.sub='${ids[user]||''}';set role ${user?'authenticated':'anon'}`);try{return(await db.query('select public.'+sql+' as data',args)).rows[0].data;}finally{await db.exec('reset role');}}
  const directory=(search='',role='all',state='all')=>rpc('owner','list_site_users($1,$2,$3,30,0)',[search,role,state]);
  const detail=user=>rpc('owner','get_site_user($1)',[ids[user]]);
  const moderate=async(user,action,hours=24)=>rpc('owner','moderate_site_user($1,$2,$3,\'Motiv de moderare\',$4)',[ids[user],action,hours,(await detail(user)).user.version]);
  const role=async(user,level)=>rpc('owner','set_site_user_role($1,$2,\'Schimbare grad de test\',$3)',[ids[user],level,(await detail(user)).user.version]);
  await role('admin','admin');await role('editor','editor');
  let list=await directory();assert.equal(list.stats.total,6);assert.equal(list.items.length,6);assert.equal(list.stats.staff,3);assert.equal(list.stats.confirmed,5);
  assert(list.items.some(u=>u.email==='user@example.invalid'&&u.role==='user'),'Regular accounts must be visible, not just staff');assert(!JSON.stringify(list).includes('NEVER_EXPOSE'));assert(!JSON.stringify(list).includes('raw_user_meta_data'));
  assert.equal((await directory('Nume user')).total,1);assert.equal((await directory('','user','unconfirmed')).total,1);assert.equal((await directory('','admin')).total,1);
  await assert.rejects(rpc(null,'list_site_users()'),/permission denied/);
  for(const caller of ['admin','editor','user']){
   await assert.rejects(rpc(caller,'list_site_users()'),/OWNER_REQUIRED/);
   await assert.rejects(rpc(caller,'get_site_user($1)',[ids.other]),/OWNER_REQUIRED/);
   await assert.rejects(rpc(caller,"set_site_user_role($1,'owner','Escalation attempt',0)",[ids.other]),/OWNER_REQUIRED/);
   await assert.rejects(rpc(caller,"moderate_site_user($1,'ban',null,'Forbidden action',0)",[ids.other]),/OWNER_REQUIRED/);
   await assert.rejects(rpc(caller,"delete_site_user($1,'other@example.invalid','Forbidden action',0)",[ids.other]),/OWNER_REQUIRED/);
  }
  await assert.rejects(role('unconfirmed','admin'),/USER_ROLE_INELIGIBLE/);
  await assert.rejects(role('owner','user'),/OWNER_PROTECTED/);
  await assert.rejects(moderate('owner','ban'),/SELF_PROTECTED/);
  await role('other','owner');await assert.rejects(moderate('other','ban'),/OWNER_PROTECTED/);await assert.rejects(rpc('owner',"delete_site_user($1,'other@example.invalid','Owner deletion test',1)",[ids.other]),/OWNER_PROTECTED/);await role('other','user');
  let u=(await detail('user')).user;assert.equal(u.version,0);
  await rpc('user',"save_my_streamer_profile('user.live','User LIVE',null,true)");
  await rpc('user',"start_my_live_session('user.live')");
  const [key]=await rpc('owner',"generate_access_keys('play_pass',1)");await rpc('user','redeem_access_key($1)',[key.code]);
  const ticket=await rpc('user',"create_support_ticket('question','O intrebare pentru echipa','Am nevoie de ajutor cu jocurile din studio.')");
  await moderate('user','suspend',1);let status=await rpc('user','get_my_account_status()');assert.equal(status.allowed,false);assert.equal(status.state,'suspended');assert(status.until);
  await assert.rejects(rpc('user','get_my_access()'),/ACCOUNT_SUSPENDED/);
  await assert.rejects(rpc('user','get_support_thread($1)',[ticket.ticket.id]),/ACCOUNT_SUSPENDED/);
  await assert.rejects(rpc('user',"save_my_streamer_profile('user.live','Changed',null,true)"),/ACCOUNT_SUSPENDED/);
  await assert.rejects(rpc('user',"record_my_live_gift(gen_random_uuid(),1)"),/ACCOUNT_SUSPENDED/);
  await assert.rejects(rpc('user',"record_my_live_gift_details(gen_random_uuid(),'user.live',1,'gift','Rose','',1,1,'Viewer')"),/ACCOUNT_SUSPENDED/);
  await assert.rejects(rpc('user','finish_my_live_session()'),/ACCOUNT_SUSPENDED/);
  await assert.rejects(rpc('owner',"moderate_site_user($1,'restore',null,'Stale change',0)",[ids.user]),/USER_CONFLICT/);
  await db.query("update public.site_account_controls set until_date=now()-interval '1 second' where user_id=$1",[ids.user]);assert.equal((await rpc('user','get_my_account_status()')).allowed,true,'Temporary suspension expires on the server');assert.equal((await rpc('user','get_my_access()')).plan,'play_pass');
  await moderate('user','ban');assert.equal((await rpc('user','get_my_account_status()')).state,'banned');await assert.rejects(role('user','admin'),/USER_ROLE_INELIGIBLE/);
  await moderate('admin','ban');assert.equal(await rpc('admin','site_admin_role()'),null);await assert.rejects(rpc('admin','get_site_admin_state()'),/ADMIN_REQUIRED/);await assert.rejects(rpc('admin',"generate_access_keys('play_pass',1)"),/ACCOUNT_BANNED/);
  await moderate('admin','restore');assert.equal(await rpc('admin','site_admin_role()'),'admin');
  await moderate('user','restore');assert.equal((await rpc('user','get_my_account_status()')).allowed,true);
  const [reserved]=await rpc('owner',"generate_access_keys('play_pass',1,1,'Reserved key','user@example.invalid')");
  assert((await detail('user')).audit.some(e=>e.action==='ban'));assert((await detail('user')).audit.some(e=>e.action==='restore'));
  await db.query('insert into auth.sessions(user_id) values($1)',[ids.user]);
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values('site-media','test.webp',$1)",[ids.user]);
  assert.equal((await detail('user')).storageObjects,1);
  await assert.rejects(rpc('owner',"delete_site_user($1,'wrong@example.invalid','Delete account test',$2)",[ids.user,(await detail('user')).user.version]),/USER_DELETE_CONFIRMATION/);
  await assert.rejects(rpc('owner',"delete_site_user($1,'user@example.invalid','Delete account test',$2)",[ids.user,(await detail('user')).user.version]),/USER_HAS_STORAGE/);
  await db.query('delete from storage.objects where owner_id=$1',[ids.user]);
  await rpc('owner',"delete_site_user($1,'user@example.invalid','Delete account test',$2)",[ids.user,(await detail('user')).user.version]);
  assert.equal((await directory('user@example.invalid')).total,0);assert.equal((await rpc('user','get_my_account_status()')).allowed,false,'A deleted user cannot use an old JWT');
  for(const table of ['auth.sessions','public.streamer_profiles','public.streamer_live_sessions','public.account_access_grants'])assert.equal((await db.query('select count(*)::integer n from '+table+' where user_id=$1',[ids.user])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::integer n from public.support_tickets where owner_id=$1',[ids.user])).rows[0].n,0);
  const keptKeys=await rpc('owner','list_access_keys()');for(const id of [key.id,reserved.id]){const k=keptKeys.items.find(k=>k.id===id);assert.equal(k.state,'revoked');assert.equal(k.boundEmail,null);assert.equal(k.redeemedBy,null);}
  assert.equal((await rpc('other','redeem_access_key($1)',[reserved.code])).ok,false,'Deleting an account must not turn its reserved code into a public code');
  assert((await db.query("select 1 from public.site_user_audit where target_id=$1 and action='delete'",[ids.user])).rows.length>0,'Technical deletion audit survives account removal');
  await assert.rejects(rpc('user','get_my_access()'),/ACCOUNT_UNAVAILABLE/);await assert.rejects(rpc('user',"save_my_streamer_profile('user.live','Zombie',null,true)"),/ACCOUNT_UNAVAILABLE/);
  await db.exec(`set request.jwt.claim.sub='${ids.other}';set role authenticated;`);await assert.rejects(db.query("insert into public.site_admins(user_id,role) values($1,'owner')",[ids.other]),/permission denied/);await assert.rejects(db.query('select * from public.site_account_controls'),/permission denied/);await db.exec('reset role');
  await db.exec(migration);assert.equal((await directory()).stats.total,5);assert.equal((await rpc('user','get_my_account_status()')).allowed,false);
 }finally{await db.close();}
});
