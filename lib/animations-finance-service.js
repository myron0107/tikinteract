import {AnimationError,requireUUID} from './animations-store.js';
import {validateCommerce,commerceProjection} from './animations-finance.js';
const fail=code=>{throw new AnimationError(code);};
export function aggregateFinance(raw,c){
 const f=c.finance,rows=[...raw.invoices.map(x=>({...x,subscription:true})),...raw.topups.map(x=>({...x,subscription:false}))];
 let gross=0,refunds=0,net=0,processing=0,billing=0,affiliate=0,infra=0,storage=0;const missing=new Set();
 for(const x of rows){
  const original=x.amount/100,refund=x.disputed?original:x.refunded/100,revenue=original-refund;
  gross+=original;refunds+=refund;
  const tax=x.taxCents??(f.taxBps===null?null:x.amount-x.amount/(1+f.taxBps/10000));
  if(tax===null)missing.add('taxBps');
  // Tax is estimated proportionally after refunds; original processing fees
  // remain costs (do not assume Stripe returns its fee on a refund).
  const n=tax===null?0:revenue-(tax/100)*(1-refund/original);net+=n;
  const fee=x.stripeFeeCents??(f.stripeBps===null||f.stripeFixedCents===null?null:x.amount*f.stripeBps/10000+f.stripeFixedCents);
  if(fee===null)missing.add('stripeFees');else processing+=fee/100;
  if(x.subscription){if(f.billingBps===null)missing.add('billingBps');else billing+=original*f.billingBps/10000;}
  if(f.affiliateBps===null)missing.add('affiliateBps');else affiliate+=n*f.affiliateBps/10000;
  for(const k of ['infrastructureCents','storageCents'])if(f[k]===null)missing.add(k);
  infra+=(f.infrastructureCents||0)/100;storage+=(f.storageCents||0)/100;
 }
 let actualUsd=0,estimatedUsd=0,pending=0;
 for(const j of raw.costs){const actual=Number(j.actualUsdNanos)/1e9;actualUsd+=actual;if(!j.reconciled){pending++;estimatedUsd+=Math.max(0,Number(j.estimatedUsdMicros)/1e6-actual);}}
 const aiCost=raw.costs.length&&f.usdToEur===null?null:(actualUsd+estimatedUsd)*(f.usdToEur||0);
 if(aiCost===null)missing.add('usdToEur');
 const margin=missing.size?null:net-processing-billing-affiliate-infra-storage-aiCost;
 const active=raw.activePlans||{};
 return {...raw,totals:{gross,refunds,subscriptionGross:raw.invoices.reduce((n,x)=>n+x.amount/100,0),topupGross:raw.topups.reduce((n,x)=>n+x.amount/100,0),net:missing.has('taxBps')?null:net,processing:missing.has('stripeFees')?null:processing,billing,affiliate,infra,storage,actualUsd,estimatedUsd,aiCost,margin,missing:[...missing],pendingCostJobs:pending,
 mrr:Number(raw.mrrCents||0)/100},projection:commerceProjection(c)};
}
export function createFinanceService({store,stripe,key=process.env.FAL_BILLING_KEY||process.env.FAL_KEY||'',fetchImpl=fetch,now=Date.now}){
 const settings=()=>store.one('animation_settings',{singleton:true});
 async function state(user,body){
  await store.admin(user);const row=await settings(),c=row?.config.testCommerce;if(!c)fail('ANIM_COMMERCE_SETUP');
  const month=body.month||new Date(now()).toISOString().slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))fail('ANIM_INVALID');
  const start=new Date(month+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
  const raw=await store.rpc('animation_financial_report',{p_start:start.toISOString(),p_end:end.toISOString()});
  return {revision:row.revision,config:c,report:aggregateFinance(raw,c),checkout:!!stripe?.commerce?.available,costSync:!!key,
   jobs:raw.costs.slice(0,100)};
 }
 async function save(user,body){
  await store.admin(user);const c=validateCommerce(body.config),row=await settings();
  if(!Number.isSafeInteger(body.revision)||row.revision!==body.revision)fail('ANIM_CONFIG_CONFLICT');
  // Existing public subscription settings are deliberately never written here.
  const result=await store.update('animation_settings',{singleton:true,revision:body.revision},{config:{...row.config,testCommerce:c},revision:body.revision+1,updated_at:new Date(now()).toISOString()});
  if(!result.length)fail('ANIM_CONFIG_CONFLICT');return {saved:true,projection:commerceProjection(c)};
 }
 async function validatePrices(user,body={}){
  await store.admin(user);if(!stripe?.commerce?.available)fail('ANIM_TEST_ONLY');
  const row=await settings(),c=validateCommerce(body.config||row.config.testCommerce),results=[];
  for(const [id,p] of Object.entries(c.plans).filter(([id])=>id!=='free')){
   if(!p.priceId){results.push({id,valid:false,error:'ANIM_PRICE_REQUIRED'});continue;}
   try{await stripe.commerce.validatePrice({price_id:p.priceId,amount:p.amount,kind:'subscription'});results.push({id,valid:true});}catch(e){results.push({id,valid:false,error:e.code||'ANIM_CHECKOUT_UNAVAILABLE'});}
  }
  for(const p of c.packages.filter(p=>p.enabled)){
   if(!p.priceId){results.push({id:p.id,valid:false,error:'ANIM_PRICE_REQUIRED'});continue;}
   try{await stripe.commerce.validatePrice({price_id:p.priceId,amount:p.amount,kind:'topup'});results.push({id:p.id,valid:true});}catch(e){results.push({id:p.id,valid:false,error:e.code||'ANIM_CHECKOUT_UNAVAILABLE'});}
  }return {results};
 }
 async function syncCosts(user,body){
  await store.admin(user);if(!key)fail('ANIM_COST_SYNC_UNAVAILABLE');
  const j=await store.one('animation_jobs',{id:requireUUID(body.id)});if(!j)fail('ANIM_NOT_FOUND');
  const requests=[['image',j.image_request,j.image_model],['video',j.video_request,j.video_model]].filter(x=>x[1]);
  if(!requests.length||now()-Date.parse(j.created_at)>89*86400000)fail('ANIM_COST_REVIEW');
  let cursor=null,events=[];
  for(let page=0;page<10;page++){
   const u=new URL('https://api.fal.ai/v1/models/billing-events');u.searchParams.set('start',new Date(Date.parse(j.created_at)-60000).toISOString());u.searchParams.set('end',new Date(now()+1000).toISOString());u.searchParams.set('limit','1000');
   for(const [,id] of requests)u.searchParams.append('request_id',id);if(cursor)u.searchParams.set('cursor',cursor);
   const r=await fetchImpl(u,{headers:{Authorization:'Key '+key},redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!r.ok)fail('ANIM_COST_SYNC_UNAVAILABLE');const data=await r.json();
   if(!Array.isArray(data.billing_events))fail('ANIM_COST_REVIEW');events.push(...data.billing_events);
   if(!data.has_more){cursor=null;break;}cursor=data.next_cursor;if(typeof cursor!=='string'||cursor.length>2000)fail('ANIM_COST_REVIEW');
  }
  if(cursor)fail('ANIM_COST_REVIEW');let synced=0;
  for(const [stage,id,model] of requests){
   const rows=events.filter(e=>e.request_id===id&&e.endpoint_id===model);if(!rows.length)continue;
   let nanos=0;for(const e of rows){const n=e.cost_estimate_nano_usd??Math.round(e.cost_total*1e9);if(!Number.isSafeInteger(n)||n<0)fail('ANIM_COST_REVIEW');nanos+=n;}
   if(!Number.isSafeInteger(nanos))fail('ANIM_COST_REVIEW');
   await store.rpc('animation_record_provider_cost',{p_job:j.id,p_stage:stage,p_request:id,p_model:model,p_usd_nanos:nanos});synced++;
  }return {synced,pending:requests.length-synced};
 }
 return {state,save,validatePrices,syncCosts};
}
