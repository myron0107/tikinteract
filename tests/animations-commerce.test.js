import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {createAnimationFixture} from './helpers/animations-fixture.mjs';
import {TEST_COMMERCE,validateCommerce,maximumAICost,commerceProjection,testGenerationProfitable} from '../lib/animations-finance.js';
import {aggregateFinance,createFinanceService} from '../lib/animations-finance-service.js';
import {createAnimationBilling} from '../lib/animations-billing.js';
import {createAnimationService} from '../lib/animations-service.js';
const clone=()=>structuredClone(TEST_COMMERCE);
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
const complete=()=>{const c=clone();Object.assign(c.finance,{taxBps:2000,stripeBps:150,stripeFixedCents:25,premiumEurMicros:600000,usdToEur:.9});return c;};
async function fixture(){const f=await createAnimationFixture();const sql=await readFile(new URL('../supabase/animations-commerce.sql',import.meta.url),'utf8');await f.db.exec(sql);await f.db.exec(sql);return f;}
async function configure(f,c=complete()){
 c.plans.play_pass.priceId='price_pass1';c.plans.play_pass_pro.priceId='price_pro1';c.packages.forEach((p,i)=>p.priceId='price_pack'+i);
 const row=await f.store.one('animation_settings',{singleton:true});await f.store.update('animation_settings',{singleton:true},{config:{...row.config,testCommerce:c},revision:row.revision+1});return c;
}
function stripeFixture(f){
 const objects=new Map(),calls=[],secret='whsec_local',key='sk_test_local';let seq=0;
 const fetchImpl=async(url,options={})=>{const u=new URL(url),path=u.pathname.replace('/v1/','');calls.push({path,options});
  if(options.method==='POST'&&path==='checkout/sessions'){
   const p=new URLSearchParams(options.body),o=await f.store.one('animation_commerce_orders',{id:p.get('client_reference_id')});
   const s={id:'cs_test_'+(++seq),metadata:{purpose:p.get('metadata[purpose]'),order_id:o.id,user_id:f.user.id},client_reference_id:o.id,mode:p.get('mode'),livemode:false,status:'open',payment_status:'unpaid',amount_total:o.amount,currency:'eur',customer:'cus_fixture',url:'https://checkout.stripe.com/c/pay/test_'+seq};objects.set('checkout/sessions/'+s.id,s);return Response.json(s);
  }
  if(objects.has(path))return Response.json(objects.get(path));
  if(path==='checkout/sessions'){
   const all=[...objects.entries()].filter(([k])=>/^checkout\/sessions\//.test(k)).map(([,v])=>v);
   return Response.json({data:all.filter(s=>u.searchParams.has('subscription')?s.subscription===u.searchParams.get('subscription'):s.payment_intent?.id===u.searchParams.get('payment_intent'))});
  }
  return Response.json({error:'Not in local fixture: '+path},{status:404});
 };
 const billing=createAnimationBilling({store:f.store,key,secret,siteUrl:'https://site.invalid',fetchImpl});
 const sign=event=>{const raw=Buffer.from(JSON.stringify({livemode:false,...event})),stamp=Math.floor(Date.now()/1000);return billing.webhook(raw,'t='+stamp+',v1='+createHmac('sha256',secret).update(stamp+'.').update(raw).digest('hex'));};
 const price=(id,amount,subscription=false)=>objects.set('prices/'+id,{id,active:true,livemode:false,currency:'eur',unit_amount:amount,billing_scheme:'per_unit',type:subscription?'recurring':'one_time',...(subscription?{recurring:{interval:'month',interval_count:1,usage_type:'licensed'}}:{})});
 return {billing,objects,calls,sign,price,fetchImpl};
}

test('Commercial proposal, unknown costs and exact full-use Standard/Premium/mixed margins',()=>{
 const c=clone(),p=commerceProjection(c);assert.equal(validateCommerce(c).plans.play_pass.amount,799);
 assert.deepEqual(c.plans.free,{amount:0,credits:0,priceId:''});assert.deepEqual(c.packages.map(x=>[x.amount,x.credits]),[[299,200],[499,500],[999,1100]]);
 close(p.plans.play_pass.standardOnlyCost,.9);close(p.plans.play_pass_pro.standardOnlyCost,2.4);
 assert.equal(p.premiumCost,null);assert.equal(p.plans.play_pass.aiMaximum,null);assert.equal(p.plans.play_pass.fullUse,null);assert.equal(p.plans.play_pass.warning,'incomplete');
 const full=complete(),r=commerceProjection(full),pass=r.plans.play_pass;
 close(pass.tax,7.99-7.99/1.2);close(pass.processing,7.99*.015+.25);close(pass.billing,7.99*.007);close(pass.aiMaximum,.9);close(pass.fullUse,pass.zeroUse-.9);
 full.finance.premiumEurMicros=1100000;assert.deepEqual(maximumAICost(300,full),{eurMicros:1400000,standard:1,premium:1,unused:0});
 full.standardCredits=120;full.premiumCredits=210;assert.equal(maximumAICost(300,full).unused,90,'No fractional videos');
 full.finance.premiumEurMicros=20000000;assert.equal(commerceProjection(full).plans.play_pass.warning,'loss');
 for(const change of [c=>c.plans.free.credits=1,c=>c.standardCredits=0,c=>c.finance.taxBps=-1,c=>c.packages[0].priceId='prod_bad']){const x=clone();change(x);assert.throws(()=>validateCommerce(x),/ANIM_CONFIG_INVALID/);}
});

test('Additive test migration preserves public prices, FREE zero balance, paid periods and RLS; replay-safe renewals/refunds',async()=>{
 const f=await fixture();try{
  const published=await f.store.one('site_settings',{singleton:true});await configure(f);
  assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).included,0);
  const o=await f.store.rpc('animation_commerce_order',{p_user:f.user.id,p_request:crypto.randomUUID(),p_kind:'subscription',p_offer:'play_pass'});
  assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).included,0);
  await f.store.update('animation_commerce_orders',{id:o.id},{subscription_id:'sub_local',customer_id:'cus_local'});
  const start=new Date(Date.now()-10000),end=new Date(Date.now()+29*86400000),args={p_order:o.id,p_invoice:'in_first',p_subscription:'sub_local',p_start:start.toISOString(),p_end:end.toISOString(),p_amount:799,p_paid_at:start.toISOString()};
  await f.store.rpc('animation_commerce_invoice',args);await f.store.rpc('animation_commerce_invoice',args);
  assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).included,300);
  assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:false})).included,0);
  assert.equal((await f.db.query('select count(*) n from account_access_grants')).rows[0].n,0,'Test cards cannot create production entitlements');
  const next={...args,p_invoice:'in_next',p_start:end.toISOString(),p_end:new Date(end.getTime()+30*86400000).toISOString()};await f.store.rpc('animation_commerce_invoice',next);await f.store.rpc('animation_commerce_invoice',next);
  assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).included,300,'Future paid periods are not spendable early');
  await f.store.rpc('animation_commerce_reverse_invoice',{p_invoice:'in_first',p_refunded:400,p_disputed:false});await f.store.rpc('animation_commerce_invoice',args);
  assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).included,149,'Stale paid webhook does not restore refunded credits');
  assert.deepEqual(await f.store.one('site_settings',{singleton:true}),published);
  await f.db.exec('set role authenticated');await assert.rejects(f.db.exec('select * from animation_commerce_invoices'),/permission denied/);await assert.rejects(f.db.exec("select animation_financial_report(now(),now()+interval '1 day')"),/permission denied/);
 }finally{await f.db.close();}
});

test('Valid Stripe Price ID checkout for FREE top-ups: no grant on redirect, forged signature or unpaid session; canonical paid grant once',async()=>{
 const f=await fixture();try{
  await configure(f);const x=stripeFixture(f);x.price('price_pack0',299);
  const body={kind:'topup',offer:'credits-200',requestId:crypto.randomUUID(),amount:1,credits:99999};
  await x.billing.commerce.create(f.user,body);await x.billing.commerce.create(f.user,body);
  assert.equal(x.calls.filter(c=>c.path==='checkout/sessions'&&c.options.method==='POST').length,1);
  const post=new URLSearchParams(x.calls.find(c=>c.options.method==='POST').options.body);assert.equal(post.get('line_items[0][price]'),'price_pack0');assert.equal(post.has('line_items[0][price_data][unit_amount]'),false);
  const s=x.objects.get('checkout/sessions/cs_test_1');
  assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).purchased,0);
  const event={type:'checkout.session.completed',data:{object:s}};
  await assert.rejects(x.billing.webhook(Buffer.from(JSON.stringify(event)),'forged'),/ANIM_INVALID_SIGNATURE/);
  await x.sign(event);assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).purchased,0);
  Object.assign(s,{status:'complete',payment_status:'paid',payment_intent:{id:'pi_local',status:'succeeded',amount_received:299,currency:'eur',latest_charge:{id:'ch_local',amount:299,livemode:false,amount_refunded:0,created:Math.floor(Date.now()/1000),balance_transaction:{currency:'eur',fee:30}}}});
  await x.sign(event);await x.sign(event);assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).purchased,200);
  s.payment_intent.latest_charge.amount_refunded=150;await x.sign(event);await x.sign(event);assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).purchased,99);
  s.payment_intent.latest_charge.amount_refunded=0;await x.sign(event);assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).purchased,99);
  assert.equal((await f.store.one('animation_commerce_orders',{session_id:s.id})).stripe_fee_cents,30);
  const live=createAnimationBilling({store:f.store,key:'sk_live_fixture',secret:'whsec_local',siteUrl:'https://site.invalid',liveApproved:true,fetchImpl:x.fetchImpl});await assert.rejects(live.commerce.create(f.user,body),/ANIM_TEST_ONLY/);
 }finally{await f.db.close();}
});

test('Recurring Test Checkout: out-of-order invoice, duplicate paid events, wrong charges/prorations and cancellation',async()=>{
 const f=await fixture();try{
  await configure(f);const x=stripeFixture(f);x.price('price_pass1',799,true);
  await x.billing.commerce.create(f.user,{kind:'subscription',offer:'play_pass',requestId:crypto.randomUUID()});const s=x.objects.get('checkout/sessions/cs_test_1');
  await x.billing.commerce.create(f.user,{kind:'subscription',offer:'play_pass',requestId:crypto.randomUUID()});assert.equal(x.calls.filter(c=>c.path==='checkout/sessions'&&c.options.method==='POST').length,1,'An abandoned subscription Checkout is resumed');
  await assert.rejects(x.billing.commerce.create(f.user,{kind:'subscription',offer:'play_pass_pro',requestId:crypto.randomUUID()}),/ANIM_SUBSCRIPTION_EXISTS/);
  const now=Math.floor(Date.now()/1000);Object.assign(s,{status:'complete',subscription:'sub_local',payment_status:'paid'});
  x.objects.set('subscriptions/sub_local',{id:'sub_local',status:'active',livemode:false,metadata:{...s.metadata},customer:s.customer,items:{data:[{price:{id:'price_pass1'},quantity:1}]}});
  const inv={id:'in_first',subscription:'sub_local',customer:s.customer,currency:'eur',status:'paid',livemode:false,amount_paid:799,collection_method:'charge_automatically',billing_reason:'subscription_create',status_transitions:{paid_at:now},lines:{has_more:false,data:[{price:{id:'price_pass1'},quantity:1,amount:799,proration:false,period:{start:now-5,end:now+30*86400}}]},charge:{id:'ch_first',status:'succeeded',livemode:false,amount:799,currency:'eur',balance_transaction:{currency:'eur',fee:37}}};x.objects.set('invoices/in_first',inv);
  inv.charge.status='pending';await assert.rejects(x.sign({type:'invoice.paid',data:{object:{id:inv.id}}}),/ANIM_INVOICE_REVIEW/);assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).included,0);
  inv.charge.status='succeeded';await x.sign({type:'invoice.paid',data:{object:{id:inv.id}}});await x.sign({type:'checkout.session.completed',data:{object:s}});await x.sign({type:'invoice.paid',data:{object:{id:inv.id}}});assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).included,300);
  inv.lines.data[0].proration=true;await assert.rejects(x.sign({type:'invoice.paid',data:{object:{id:inv.id}}}),/ANIM_INVOICE_REVIEW/);inv.lines.data[0].proration=false;
  inv.charge.disputed=true;await x.sign({type:'invoice.paid',data:{object:{id:inv.id}}});assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).included,0);
  x.objects.get('subscriptions/sub_local').status='canceled';await x.sign({type:'customer.subscription.deleted',data:{object:{id:'sub_local'}}});assert.equal((await f.store.one('animation_commerce_orders',{session_id:s.id})).status,'cancelled');
 }finally{await f.db.close();}
});

test('Price validation rejects Live, wrong amounts, currencies, intervals and inactive IDs before payment',async()=>{
 const f=await fixture();try{
  await configure(f);const x=stripeFixture(f);x.price('price_pass1',799,true);const valid=structuredClone(x.objects.get('prices/price_pass1'));
  for(const change of [{livemode:true},{active:false},{unit_amount:1},{currency:'ron'},{type:'one_time'},{recurring:{interval:'year',interval_count:1,usage_type:'licensed'}}]){
   x.objects.set('prices/price_pass1',{...valid,...change});await assert.rejects(x.billing.commerce.create(f.user,{kind:'subscription',offer:'play_pass',requestId:crypto.randomUUID()}),/ANIM_PRICE_MISMATCH/);
  }assert.equal(x.calls.filter(x=>x.options.method==='POST').length,0);
 }finally{await f.db.close();}
});

test('Financial totals preserve unknown costs, original Stripe fees on refunds and no-use/full-use profitability guards',()=>{
 const c=complete(),raw={invoices:[{amount:799,refunded:0,disputed:false,stripeFeeCents:37,taxCents:100}],topups:[{amount:299,refunded:299,disputed:false,stripeFeeCents:30,taxCents:0}],costs:[{actualUsdNanos:40000000,estimatedUsdMicros:300000,reconciled:false}],activePlans:{play_pass:1},mrrCents:799};
 const r=aggregateFinance(raw,c);close(r.totals.processing,.67);close(r.totals.net,6.99);close(r.totals.aiCost,.3*.9);close(r.totals.mrr,7.99);assert.equal(r.totals.pendingCostJobs,1);
 c.finance.usdToEur=null;assert.equal(aggregateFinance(raw,c).totals.margin,null);
 const cfg={testMode:true,testCommerce:complete(),standardUsdMicros:300000,premiumUsdMicros:650000};assert.equal(testGenerationProfitable(cfg),true);cfg.premiumUsdMicros=100000000;assert.equal(testGenerationProfitable(cfg),false,'Provider ceiling overrides a cheaper simulation');
});

test('Real fal billing reconciliation is read-only, request/model scoped, idempotent and raises verified test cost ceilings',async()=>{
 const f=await fixture();try{
  const c=await configure(f);await f.grant(300);const photo=await f.addPhoto();
  const s=createAnimationService({store:f.store,provider:f.provider,approved:true});const job=await s.command(f.user,{action:'generate',requestId:crypto.randomUUID(),photoId:photo,world:'vampire',prompt:'The character waves to everyone',title:'Test',tier:'standard',format:'9:16',duration:5,consent:true});
  await s.command(f.user,{action:'moderate',id:job.id,approve:true});for(let i=0;i<3;i++){await f.db.exec('update animation_jobs set next_poll_at=now()');await s.processOne();}
  const requests=f.calls.length,urls=[];const finance=createFinanceService({store:f.store,key:'billing-key-fixture',fetchImpl:async(u,o)=>{urls.push(String(u));assert.equal(o.headers.Authorization,'Key billing-key-fixture');return Response.json({billing_events:[{request_id:'image-'+job.id,endpoint_id:'fal-ai/flux-pro/kontext',cost_total:.04},{request_id:'video-'+job.id,endpoint_id:'minimax/h3-max-turbo/image-to-video',cost_estimate_nano_usd:400000000}],has_more:false});}});
  await finance.syncCosts(f.user,{id:job.id});await finance.syncCosts(f.user,{id:job.id});assert.equal(f.calls.length,requests,'Reporting cannot generate AI');assert( urls.every(u=>u.startsWith('https://api.fal.ai/v1/models/billing-events?')) );
  assert.equal((await f.db.query('select count(*) n from animation_provider_costs')).rows[0].n,2);
  const cfg=(await f.store.one('animation_settings',{singleton:true})).config;assert.equal(cfg.standardUsdMicros,440000);assert.equal(cfg.testCommerce.finance.standardEurMicros,396000);
  const next=()=>s.command(f.user,{action:'generate',requestId:crypto.randomUUID(),photoId:photo,world:'vampire',title:'Next',prompt:'The character waves to everyone',tier:'standard',format:'9:16',duration:5,consent:true});
  await f.store.update('animation_settings',{singleton:true},{config:{...cfg,dailyUsdMicros:750000}});await assert.rejects(next(),/ANIM_GLOBAL_BUDGET/,'Verified costs above the original reservation count against budgets');
  await f.store.update('animation_settings',{singleton:true},{config:{...cfg,dailyUsdMicros:10000000,userMonthlyUsdMicros:750000}});await assert.rejects(next(),/ANIM_USER_BUDGET/);
  const own=await s.command(f.user,{action:'state'});assert.equal(own.config.standardCredits,100);assert.equal('finance' in own.config,false);assert.equal('testCommerce' in own.config,false);assert.equal('estimated_usd_micros' in own.jobs[0],false);
  await assert.rejects(f.store.rpc('animation_record_provider_cost',{p_job:job.id,p_stage:'image',p_request:'other',p_model:'other',p_usd_nanos:1}),/ANIM_COST_MISMATCH/);
  await assert.rejects(createFinanceService({store:{...f.store,admin:async()=>{throw Error('ANIM_ADMIN_REQUIRED');}}}).state(f.user,{}),/ANIM_ADMIN_REQUIRED/);
 }finally{await f.db.close();}
});
