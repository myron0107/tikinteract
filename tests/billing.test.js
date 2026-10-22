import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {PGlite} from '@electric-sql/pglite';
import {createBillingService,verifyStripeSignature} from '../lib/billing-service.js';
import {handleBillingRequest,nodeBillingHandler} from '../lib/billing-http.js';
import {routeMaintenance} from '../middleware.js';
const user='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002',orderId='20000000-0000-0000-0000-000000000001';
const secret='whsec_isolated_fixture',now=Date.now();
const sign=raw=>'t='+Math.floor(now/1000)+',v1='+createHmac('sha256',secret).update(Math.floor(now/1000)+'.').update(raw).digest('hex');
test('Stripe signature uses exact bytes, constant-time digest comparison and a bounded timestamp',()=>{
 const raw=Buffer.from('{"message":"plată"}');assert(verifyStripeSignature(raw,sign(raw),secret,now));
 assert(!verifyStripeSignature(Buffer.from('{}'),sign(raw),secret,now));assert(!verifyStripeSignature(raw,sign(raw),secret,now+301000));
 assert(!verifyStripeSignature(raw,sign(raw)+',t='+Math.floor(now/1000),secret,now));assert(!verifyStripeSignature(raw,'v1=bad',secret,now));
 assert(verifyStripeSignature(raw,sign(raw)+',v1='+'0'.repeat(64),secret,now));
});
function fixture(){
 const o={id:orderId,user_id:user,email:'buyer@example.invalid',plan:'play_pass',plan_name:'Play Pass',amount:2900,currency:'ron',live:false,locale:'ro',status:'pending',created_at:new Date(now).toISOString(),session_id:null};
 const s={id:'cs_test_123456789012',url:'https://checkout.stripe.com/c/pay/test',client_reference_id:orderId,metadata:{order_id:orderId,user_id:user},livemode:false,amount_total:2900,currency:'ron',mode:'payment',status:'complete',payment_status:'paid',payment_intent:{id:'pi_123456',status:'succeeded',amount_received:2900,currency:'ron',latest_charge:{id:'ch_123456',refunded:false,disputed:false,receipt_url:'https://pay.stripe.com/receipts/test'}}};
 const calls=[];let currentUser=user,allowed=true;
 const fetchImpl=async(url,options={})=>{
  calls.push({url,options});const body=options.body?JSON.parse(options.body.startsWith('{')?options.body:'{}'):{};
  if(url.endsWith('/auth/v1/user'))return Response.json({id:currentUser,email_confirmed_at:new Date(now).toISOString()});
  if(url.endsWith('/get_my_account_status'))return Response.json({allowed});
  if(url.endsWith('/billing_create_order'))return Response.json(o);
  if(url.endsWith('/billing_attach_session')){o.session_id=body.p_session;return Response.json(null);}
  if(url.endsWith('/billing_get_order'))return Response.json(o);
  if(url.endsWith('/billing_complete_order'))return Response.json({status:body.p_reversed||'test_paid',plan:o.plan});
  if(url.endsWith('/billing_reverse_order'))return Response.json(null);
  if(url==='https://api.stripe.com/v1/checkout/sessions')return Response.json({...s,status:'open'});
  if(url.startsWith('https://api.stripe.com/v1/checkout/sessions/'))return Response.json(s);
  if(url.startsWith('https://api.stripe.com/v1/charges/'))return Response.json({payment_intent:s.payment_intent.id,refunded:true});
  throw Error('Unexpected fixture endpoint: '+url);
 };
 const service=createBillingService({key:'sk_test_fixture',webhookSecret:secret,serviceKey:'isolated-service-role',siteUrl:'https://site.example',fetchImpl,now:()=>now});
 const request=body=>new Request('https://site.example/api/billing',{method:'POST',headers:{Origin:'https://site.example',Authorization:'Bearer '+'t'.repeat(30),'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {o,s,calls,service,request,setUser:id=>currentUser=id,block:()=>allowed=false};
}
test('Checkout reserves server-side price and identity, uses one-time payment and dynamic payment methods',async()=>{
 const f=fixture(),body={plan:'play_pass',amount:2900,currency:'ron',requestId:randomUUID(),locale:'ro'};
 assert.equal((await f.service.create(f.request(body),body)).url,'https://checkout.stripe.com/c/pay/test');
 const call=f.calls.find(c=>c.url==='https://api.stripe.com/v1/checkout/sessions'),p=new URLSearchParams(call.options.body);
 assert.equal(p.get('mode'),'payment');assert.equal(p.get('line_items[0][price_data][unit_amount]'),'2900');assert.equal(p.get('metadata[user_id]'),user);
 assert.equal(p.get('payment_method_types[0]'),null);assert.match(p.get('success_url'),/^https:\/\/site.example\/live-studio.html/);
 assert.equal(call.options.headers['Idempotency-Key'],'tikinteract-order-'+orderId);
 assert.equal((await f.service.create(f.request(body),body)).status,'test_paid','Retrying a completed Checkout reconciles it instead of creating another payment');
 assert.equal(f.calls.filter(c=>c.url==='https://api.stripe.com/v1/checkout/sessions').length,1);
 f.block();await assert.rejects(f.service.create(f.request(body),body),/BILLING_ACCOUNT_REQUIRED/);
 assert.equal(createBillingService({key:'sk_live_fixture',webhookSecret:secret,serviceKey:'service',siteUrl:'https://site.example'}).ready,false);
 assert.equal(createBillingService({key:'sk_live_fixture',webhookSecret:secret,serviceKey:'service',siteUrl:'http://localhost:3000',liveEnabled:true}).ready,false);
});
test('Only canonical, paid, owned sessions can complete; pending, reversed and mode-mismatched events are safe',async()=>{
 const f=fixture(),body={sessionId:f.s.id};
 assert.equal((await f.service.verify(f.request(body),body)).status,'test_paid');
 f.setUser(other);await assert.rejects(f.service.verify(f.request(body),body),/BILLING_PAYMENT_MISMATCH/);f.setUser(user);
 f.s.payment_status='unpaid';const before=f.calls.filter(c=>c.url.endsWith('/billing_complete_order')).length;
 assert.equal((await f.service.verify(f.request(body),body)).status,'pending');assert.equal(f.calls.filter(c=>c.url.endsWith('/billing_complete_order')).length,before);
 f.s.payment_status='paid';f.s.amount_total=1;await assert.rejects(f.service.verify(f.request(body),body),/BILLING_PAYMENT_MISMATCH/);f.s.amount_total=2900;
 f.s.payment_intent.latest_charge.refunded=true;assert.equal((await f.service.verify(f.request(body),body)).status,'refunded');
 const complete=f.calls.filter(c=>c.url.endsWith('/billing_complete_order')).at(-1);assert.equal(JSON.parse(complete.options.body).p_reversed,'refunded');
 const raw=Buffer.from(JSON.stringify({type:'checkout.session.completed',livemode:false,data:{object:{id:f.s.id}}}));
 assert.deepEqual(await f.service.webhook(raw,sign(raw)),{received:true});
 await assert.rejects(f.service.webhook(raw,sign(Buffer.from('{}'))),/BILLING_INVALID_SIGNATURE/);
 const live=Buffer.from(JSON.stringify({type:'checkout.session.completed',livemode:true}));await assert.rejects(f.service.webhook(live,sign(live)),/BILLING_MODE_MISMATCH/);
});
test('HTTP and maintenance boundaries keep signed notifications reachable and purchase APIs private',async()=>{
 const f=fixture();const status=await handleBillingRequest(new Request('https://site.example/api/billing?action=config'),{service:f.service});
 assert.deepEqual(await status.json(),{available:true,test:true});assert.match(status.headers.get('cache-control'),/no-store/);
 const evil=new Request('https://site.example/api/billing',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'});
 assert.equal((await handleBillingRequest(evil,{service:f.service})).status,403);
 const unsigned=new Request('https://site.example/api/billing/webhook',{method:'POST',body:'{}'});assert.equal((await handleBillingRequest(unsigned,{service:f.service})).status,400);
 const closed={gate:async()=>({allowed:false,enabled:true})};
 assert.equal((await routeMaintenance(new Request('https://site.example/api/billing/webhook',{method:'POST',body:'{}'}),closed)).headers.get('x-middleware-next'),'1');
 assert.equal((await routeMaintenance(new Request('https://site.example/api/billing'),closed)).status,503);
 assert.equal((await routeMaintenance(new Request('https://site.example/assets/tikinteract-favicon.svg'),closed)).headers.get('x-middleware-next'),'1');
});
test('Node/Vercel entry reads original webhook bytes rather than an already-parsed JSON object',async()=>{
 const raw=Buffer.from('{"message":"plată","space": "kept"}'),signature=sign(raw);
 const req=Readable.from([raw.subarray(0,7),raw.subarray(7)]);req.method='POST';req.url='/api/billing/webhook';req.headers={host:'localhost','stripe-signature':signature};req.socket={};req.body={incorrect:'This parsed body must not replace signed bytes'};
 let code,result;const res={writeHead(status){code=status;return this;},end(body){result=JSON.parse(body);}};
 await nodeBillingHandler(req,res,{service:{webhook:async(bytes,header)=>{assert.deepEqual(bytes,raw);assert(verifyStripeSignature(bytes,header,secret,now));return{received:true};}}});
 assert.equal(code,200);assert.deepEqual(result,{received:true});
});

test('real billing SQL: permissions, published pricing, replay safety, keys, upgrades, test isolation and reversals',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_app_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
  create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())',[user,'mironsergiuflorin@gmail.com',other,'other@example.invalid']);
  for(const file of ['admin.sql','access-keys.sql','billing.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  async function rpc(role,id,sql,args=[]){await db.exec(`reset role;set request.jwt.claim.sub='${id||''}';set role ${role}`);try{return(await db.query('select public.'+sql+' as data',args)).rows[0].data;}finally{await db.exec('reset role');}}
  const service=(sql,args=[])=>rpc('service_role',null,sql,args),get=id=>rpc('authenticated',id,'get_my_access()');
  const reserve=(id=user,plan='play_pass',live=true,amount=2900,request=randomUUID())=>service('billing_create_order($1,$2,$3,$4,\'ron\',$5,\'ro\')',[id,plan,request,amount,live]);
  const paid=(o,extra={})=>service('billing_complete_order($1,$2,$3,$4,$5,$6,$7,$8)',[o.id,'cs_test_'+o.id.replaceAll('-',''),'pi_'+o.id.replaceAll('-',''),extra.amount??o.amount,o.currency,o.live,'https://pay.stripe.com/receipts/test',extra.reversed||null]);
  for(const role of ['anon','authenticated']){
   await assert.rejects(rpc(role,user,'billing_create_order($1,\'play_pass\',$2,2900,\'ron\',true,\'ro\')',[user,randomUUID()]),/permission denied/);
   await db.exec('set role '+role);await assert.rejects(db.query('select * from public.billing_orders'),/permission denied/);await db.exec('reset role');
  }
  await assert.rejects(reserve(user,'play_pass',true,1),/BILLING_PRICE_CHANGED/);
  const req=randomUUID(),o=await reserve(user,'play_pass',true,2900,req);assert.equal((await get(user)).plan,'free');
  assert.equal((await reserve(user,'play_pass',true,2900,req)).id,o.id);
  await assert.rejects(paid(o,{amount:1}),/BILLING_PAYMENT_MISMATCH/);
  await paid(o);const initial=await get(user);assert.equal(initial.plan,'play_pass');assert.equal(initial.periods.length,1);
  await paid(o);assert.equal((await get(user)).periods.length,1);
  const pro=await reserve(user,'play_pass_pro',true,7900);await paid(pro);const upgraded=await get(user);assert.equal(upgraded.plan,'play_pass_pro');
  assert(Date.parse(upgraded.periods.find(p=>p.plan==='play_pass').endsAt)>Date.parse(initial.validUntil));
  const testOrder=await reserve(other,'play_pass',false);assert.equal((await paid(testOrder)).status,'test_paid');assert.equal((await get(other)).plan,'free');
  const reversed=await reserve(other);assert.equal((await paid(reversed,{reversed:'refunded'})).status,'refunded');assert.equal((await get(other)).plan,'free');
  await service('billing_reverse_order($1,\'refunded\')',['pi_'+pro.id.replaceAll('-','')]);await paid(pro);assert.equal((await get(user)).plan,'free','Replayed completion cannot revive refunded PRO or consume preserved future Pass');
  const history=await rpc('authenticated',user,'get_my_billing_orders()');assert.equal(history.length,2);assert.equal((await rpc('authenticated',other,'get_my_billing_orders()')).length,2);assert(!JSON.stringify(history).includes(other));
  const keys=await rpc('authenticated',user,"generate_access_keys('play_pass',1)");await rpc('authenticated',other,'redeem_access_key($1)',[keys[0].code]);assert.equal((await get(other)).plan,'play_pass');
  await db.exec(await readFile(new URL('../supabase/billing.sql',import.meta.url),'utf8'));assert.equal((await db.query('select count(*)::integer n from public.billing_orders')).rows[0].n,4);
 }finally{await db.close();}
});
