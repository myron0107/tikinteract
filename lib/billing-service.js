// Server only: native Stripe REST API, no secret or card details reach browser code.
import {createHmac,timingSafeEqual} from 'node:crypto';
import publicConfig from '../assets/supabase-config.json' with {type:'json'};
export class BillingError extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status;}}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function verifyStripeSignature(raw,header,secret,now=Date.now()){
 if(!secret||typeof header!=='string'||header.length>4096)return false;
 const parts=header.split(','),times=parts.filter(p=>p.startsWith('t='));if(times.length!==1)return false;
 const stamp=times[0].slice(2);if(!/^\d{10}$/.test(stamp)||Math.abs(now/1000-Number(stamp))>300)return false;
 const expected=createHmac('sha256',secret).update(stamp+'.').update(raw).digest();
 return parts.filter(p=>/^v1=[a-f0-9]{64}$/.test(p)).some(p=>timingSafeEqual(expected,Buffer.from(p.slice(3),'hex')));
}
export function createBillingService({key='',webhookSecret='',serviceKey='',siteUrl='',liveEnabled=false,url=publicConfig.url,anonKey=publicConfig.anonKey,fetchImpl=fetch,now=Date.now}={}){
 let origin;try{const u=new URL(siteUrl);if(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))origin=u.origin;}catch{}
 const live=key.startsWith('sk_live_'),ready=!!(origin&&serviceKey&&webhookSecret&&(/^sk_test_/.test(key)||(live&&liveEnabled&&origin.startsWith('https:'))));
 async function supa(path,body,token){
  let response;try{response=await fetchImpl(url+path,{method:body===undefined?'GET':'POST',headers:{apikey:token?anonKey:serviceKey,Authorization:'Bearer '+(token||serviceKey),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000),cache:'no-store'});}catch{throw new BillingError('BILLING_UNAVAILABLE',503);}
  const data=await response.json().catch(()=>null);
  if(!response.ok){const m=String(data?.message||'');const code=['BILLING_PRICE_CHANGED','BILLING_RATE_LIMIT','BILLING_PLAN_UNAVAILABLE','BILLING_ACCOUNT_REQUIRED'].find(c=>m.includes(c));throw new BillingError(code||'BILLING_UNAVAILABLE',code==='BILLING_RATE_LIMIT'?429:code?400:503);}
  return data;
 }
 const rpc=(name,args)=>supa('/rest/v1/rpc/'+name,args);
 async function stripe(path,params,idempotency){
  let response;try{response=await fetchImpl('https://api.stripe.com/v1/'+path,{method:params?'POST':'GET',headers:{Authorization:'Bearer '+key,...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},...(params?{body:new URLSearchParams(params).toString()}:{}),signal:AbortSignal.timeout(15000),cache:'no-store'});}catch{throw new BillingError('BILLING_UNAVAILABLE',503);}
  const data=await response.json().catch(()=>null);if(!response.ok||!data)throw new BillingError('BILLING_UNAVAILABLE',503);return data;
 }
 function assertReady(){if(!ready)throw new BillingError('BILLING_SETUP_REQUIRED',503);}
 async function authenticate(request){
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,7000})$/)?.[1];if(!token)throw new BillingError('BILLING_LOGIN_REQUIRED',401);
  const user=await supa('/auth/v1/user',undefined,token);
  if(!uuid.test(user?.id||'')||user.is_anonymous||!user.email_confirmed_at||user.app_metadata?.site_preview)throw new BillingError('BILLING_ACCOUNT_REQUIRED',403);
  const status=await supa('/rest/v1/rpc/get_my_account_status',{},token);if(status?.allowed!==true)throw new BillingError('BILLING_ACCOUNT_REQUIRED',403);return user;
 }
 async function create(request,body){
  assertReady();const user=await authenticate(request);
  if(!['play_pass','play_pass_pro'].includes(body.plan)||!uuid.test(body.requestId||'')||!Number.isSafeInteger(body.amount)||!['ron','eur','usd'].includes(body.currency))throw new BillingError('BILLING_INVALID');
  const order=await rpc('billing_create_order',{p_user:user.id,p_plan:body.plan,p_request:body.requestId,p_amount:body.amount,p_currency:body.currency,p_live:live,p_locale:body.locale==='en'?'en':'ro'});
  if(order.status!=='pending')return {status:order.status};
  if(now()-Date.parse(order.created_at)>23*3600000)throw new BillingError('BILLING_CHECKOUT_EXPIRED',409);
  let session;
  if(order.session_id)session=await stripe('checkout/sessions/'+encodeURIComponent(order.session_id));
  else{
   session=await stripe('checkout/sessions',{
    mode:'payment',client_reference_id:order.id,customer_email:order.email,locale:order.locale,'adaptive_pricing[enabled]':'false',
    'metadata[order_id]':order.id,'metadata[user_id]':order.user_id,
    'payment_intent_data[metadata][order_id]':order.id,
    'line_items[0][quantity]':'1','line_items[0][price_data][currency]':order.currency,
    'line_items[0][price_data][unit_amount]':String(order.amount),
    'line_items[0][price_data][product_data][name]':order.plan_name+' — '+(order.locale==='en'?'1 month':'1 lună'),
    'line_items[0][price_data][product_data][description]':order.locale==='en'?'One payment. No automatic renewal.':'O singură plată. Fără reînnoire automată.',
    success_url:origin+'/live-studio.html?billing=success&session_id={CHECKOUT_SESSION_ID}',
    cancel_url:origin+'/live-studio.html?billing=cancelled'
   },'tikinteract-order-'+order.id);
   await rpc('billing_attach_session',{p_order:order.id,p_session:session.id});
  }
  if(session.status==='complete')return complete(session.id,user.id);
  if(session.status!=='open')throw new BillingError('BILLING_CHECKOUT_EXPIRED',409);
  let target;try{target=new URL(session.url);}catch{throw new BillingError('BILLING_UNAVAILABLE',503);}
  if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw new BillingError('BILLING_UNAVAILABLE',503);
  return {url:target.href,test:!live};
 }
 async function complete(sessionId,owner){
  if(typeof sessionId!=='string'||!/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId))throw new BillingError('BILLING_INVALID');
  const s=await stripe('checkout/sessions/'+sessionId+'?expand[]=payment_intent.latest_charge');
  const orderId=s.metadata?.order_id;if(!uuid.test(orderId||''))throw new BillingError('BILLING_INVALID');
  const o=await rpc('billing_get_order',{p_order:orderId});
  if(!o||(owner&&o.user_id!==owner)||s.client_reference_id!==o.id||s.metadata?.user_id!==o.user_id||s.livemode!==o.live||s.livemode!==live||s.amount_total!==o.amount||s.currency!==o.currency||s.mode!=='payment'||(o.session_id&&o.session_id!==s.id))throw new BillingError('BILLING_PAYMENT_MISMATCH',403);
  if(s.status!=='complete'||s.payment_status!=='paid')return {status:'pending'};
  const intent=s.payment_intent,charge=intent?.latest_charge;
  if(!intent?.id||intent.status!=='succeeded'||intent.amount_received!==o.amount||intent.currency!==o.currency||typeof charge!=='object'||!charge?.id)throw new BillingError('BILLING_PAYMENT_MISMATCH',403);
  // Current Stripe state wins even if a refund/dispute arrived before completion.
  const reversal=charge?.refunded?'refunded':charge?.disputed?'disputed':null;
  const result=await rpc('billing_complete_order',{p_order:o.id,p_session:s.id,p_intent:intent.id,p_amount:s.amount_total,p_currency:s.currency,p_live:s.livemode,p_receipt:charge?.receipt_url||null,p_reversed:reversal});
  if(reversal){await rpc('billing_reverse_order',{p_intent:intent.id,p_status:reversal});return {status:reversal};}
  return result;
 }
 async function verify(request,body){assertReady();const user=await authenticate(request);return complete(body.sessionId,user.id);}
 async function webhook(raw,signature){
  assertReady();if(!verifyStripeSignature(raw,signature,webhookSecret,now()))throw new BillingError('BILLING_INVALID_SIGNATURE',400);
  let event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw new BillingError('BILLING_INVALID');}
  if(event.livemode!==live)throw new BillingError('BILLING_MODE_MISMATCH',400);
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))await complete(event.data?.object?.id);
  if(['charge.refunded','charge.dispute.created'].includes(event.type)){
   const id=event.type==='charge.refunded'?event.data?.object?.id:event.data?.object?.charge;
   if(typeof id!=='string'||!/^ch_[A-Za-z0-9_]+$/.test(id))throw new BillingError('BILLING_INVALID');
   const charge=await stripe('charges/'+id);if(charge.refunded||charge.disputed)await rpc('billing_reverse_order',{p_intent:charge.payment_intent,p_status:charge.refunded?'refunded':'disputed'});
  }
  return {received:true};
 }
 return {ready,live,origin,create,verify,webhook};
}
export const billingService=createBillingService({key:process.env.STRIPE_SECRET_KEY||'',webhookSecret:process.env.STRIPE_WEBHOOK_SECRET||'',serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY||'',siteUrl:process.env.PUBLIC_SITE_URL||'',liveEnabled:process.env.STRIPE_LIVE_PAYMENTS_ENABLED==='true'});
