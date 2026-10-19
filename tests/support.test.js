import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {composeAdminInstall} from '../scripts/build-admin-install.mjs';

test('support protects conversations, notes and grades; handles replies, unread, assignment and retries',async()=>{
 const db=new PGlite();
 const ids={owner:'10000000-0000-0000-0000-000000000001',editor:'10000000-0000-0000-0000-000000000002',admin:'10000000-0000-0000-0000-000000000003',customer:'10000000-0000-0000-0000-000000000004',stranger:'10000000-0000-0000-0000-000000000005',unconfirmed:'10000000-0000-0000-0000-000000000006'};
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
   create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for(const [name,id] of Object.entries(ids))await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,name==='owner'?'mironsergiuflorin@gmail.com':name+'@example.invalid',name==='unconfirmed'?null:new Date().toISOString()]);
  const adminMigration=await readFile(new URL('../supabase/admin.sql',import.meta.url),'utf8');
  const migration=await readFile(new URL('../supabase/support.sql',import.meta.url),'utf8');
  await assert.rejects(db.exec(migration),/Administrarea nu este activată/);
  await db.exec('rollback');
  const installer=await readFile(new URL('../supabase/install-admin.sql',import.meta.url),'utf8');
  assert.equal(installer,composeAdminInstall(adminMigration,migration,await readFile(new URL('../supabase/access-keys.sql',import.meta.url),'utf8')),'Installer must stay synchronized with the source migrations');
  await db.exec(installer);await db.exec(installer); // Fresh installation and rerun, without prerequisite steps.
  await db.exec(adminMigration);await db.exec(migration);
  async function call(user,sql,args=[]){await db.exec(`reset role;set request.jwt.claim.sub='${ids[user]||''}';set role ${user?'authenticated':'anon'}`);try{return await db.query(sql,args);}finally{await db.exec('reset role');}}
  async function rpc(user,sql,args=[]){return (await call(user,'select public.'+sql+' as data',args)).rows[0].data;}
  const list=(user,filter='all',search='',offset=0)=>rpc(user,'list_support_tickets($1,$2,30,$3)',[filter,search,offset]);
  await rpc('owner',"manage_site_admin('editor@example.invalid','editor')");await rpc('owner',"manage_site_admin('admin@example.invalid','admin')");
  await assert.rejects(rpc(null,'list_support_tickets()'),/permission denied/);
  await assert.rejects(rpc('unconfirmed','list_support_tickets()'),/SUPPORT_ACCOUNT_REQUIRED/);
  await assert.rejects(rpc('customer','support_summary(null,null,true)'),/permission denied/);
  await assert.rejects(call('customer','select * from public.support_messages'),/permission denied/);
  await assert.rejects(call('owner','select * from public.support_tickets'),/permission denied/);
  const create="create_support_ticket('bug','Problema de conectare',$1,'LIVE Studio',$2)";
  const nonce='20000000-0000-0000-0000-000000000001',body='Conexiunea se opreste imediat dupa ce pornesc jocul.';
  let thread=await rpc('customer',create,[body,nonce]),id=thread.ticket.id;
  assert.equal(thread.messages.length,1);assert.equal(thread.ticket.state,'open');assert.equal(thread.ticket.priority,null);
  const duplicate=await rpc('customer',create,[body,nonce]);assert.equal(duplicate.ticket.id,id);assert.equal((await list('customer')).total,1);
  assert.equal((await list('stranger')).total,0);assert.equal((await list('editor')).total,0);
  await assert.rejects(rpc('stranger','get_support_thread($1)',[id]),/SUPPORT_NOT_FOUND/);
  await assert.rejects(rpc('editor','get_support_thread($1)',[id]),/SUPPORT_NOT_FOUND/);
  await assert.rejects(rpc('editor','list_support_team()'),/SUPPORT_STAFF_REQUIRED/);
  await assert.rejects(rpc('customer',"send_support_message($1,'Secret',true)",[id]),/SUPPORT_STAFF_REQUIRED/);
  await assert.rejects(rpc('stranger',"send_support_message($1,'Injected message')",[id]),/SUPPORT_NOT_FOUND/);
  await assert.rejects(rpc('customer',"update_support_ticket($1,'resolved','urgent',null,0)",[id]),/SUPPORT_STAFF_REQUIRED/);
  assert.equal((await list('owner')).stats.unread,1);
  await rpc('owner','mark_support_read($1,$2)',[id,thread.messages[0].id]);assert.equal((await list('owner')).stats.unread,0);
  assert.equal((await list('admin')).stats.unread,1,'Read state is per staff member');
  thread=await rpc('owner',"send_support_message($1,'Confidential investigation note',true)",[id]);
  assert.equal(thread.messages.length,2);assert.equal(thread.ticket.state,'open');
  const ownThread=await rpc('customer','get_support_thread($1)',[id]);assert.equal(ownThread.messages.length,1);assert.equal(ownThread.ticket.preview,body);
  assert.equal((await list('customer','all','Confidential')).total,0,'Internal notes must not leak through search');
  assert.equal((await list('owner','all','Confidential')).total,1);
  const replyNonce='20000000-0000-0000-0000-000000000002';
  thread=await rpc('admin',"send_support_message($1,'Am verificat conexiunea. Poti incerca din nou?',false,$2)",[id,replyNonce]);
  assert.equal(thread.ticket.state,'pending');
  const retried=await rpc('admin',"send_support_message($1,'Am verificat conexiunea. Poti incerca din nou?',false,$2)",[id,replyNonce]);assert.equal(retried.messages.length,thread.messages.length);
  const customerReply=await rpc('customer','get_support_thread($1)',[id]);assert.equal(customerReply.messages.length,2);assert.equal(customerReply.messages.at(-1).author,'Echipa TIKINTERACT');
  assert(!JSON.stringify(customerReply).includes('admin@example.invalid'),'Staff address stays private in customer messages');
  assert.equal((await list('customer','unread')).total,1);await rpc('customer','mark_support_read($1,$2)',[id,customerReply.messages.at(-1).id]);assert.equal((await list('customer','unread')).total,0);
  thread=await rpc('owner',"update_support_ticket($1,'resolved','urgent',$2,$3)",[id,ids.admin,thread.ticket.version]);
  assert.equal(thread.ticket.priority,'urgent');assert.equal(thread.ticket.assignedTo,ids.admin);assert.equal((await list('admin','mine')).total,1);
  await assert.rejects(rpc('owner',"update_support_ticket($1,'open','normal',null,0)",[id]),/SUPPORT_CONFLICT/);
  await assert.rejects(rpc('owner',"update_support_ticket($1,'open','normal',$2,$3)",[id,ids.editor,thread.ticket.version]),/SUPPORT_INVALID_ASSIGNEE/);
  thread=await rpc('customer',"send_support_message($1,'Problema a reaparut.')",[id]);assert.equal(thread.ticket.state,'open','A new customer message reopens a resolved case');
  await assert.rejects(rpc('customer',"create_support_ticket('bug','tiny','short')"),/SUPPORT_INVALID_MESSAGE/);
  await assert.rejects(rpc('customer',"list_support_tickets('all','',999,0)"),/SUPPORT_INVALID_FILTER/);
  await rpc('owner',"manage_site_admin('admin@example.invalid','editor')");
  await assert.rejects(rpc('admin','get_support_thread($1)',[id]),/SUPPORT_NOT_FOUND/);
  // More than one page of messages; older pages do not overlap or disclose notes.
  for(let i=0;i<51;i++)await rpc('customer',"send_support_message($1,$2)",[id,'Mesaj de verificare '+i]);
  const latest=await rpc('customer','get_support_thread($1)',[id]);assert.equal(latest.messages.length,50);assert.equal(latest.hasMore,true);
  const older=await rpc('customer','get_support_thread($1,$2)',[id,latest.messages[0].id]);assert(older.messages.length>0);assert(older.messages.every(m=>m.id<latest.messages[0].id&&!m.internal));
  for(let i=1;i<10;i++)await rpc('customer',"create_support_ticket('question','Intrebare noua',$1)",[body]);
  await assert.rejects(rpc('customer',"create_support_ticket('question','Prea multe mesaje',$1)",[body]),/SUPPORT_RATE_LIMIT/);
  await db.exec(migration);assert.equal((await list('customer')).total,10,'Re-running the migration preserves conversations');
 }finally{await db.close();}
});
