// Uses the existing Stripe secret, webhook endpoint and signature verifier.
import {verifyStripeSignature} from './billing-service.js';
import {AnimationError,requireUUID} from './animations-store.js';
import {createCommerceBilling} from './animations-commerce-billing.js';
export function createAnimationBilling({store,key=process.env.STRIPE_SECRET_KEY||'',secret=process.env.STRIPE_WEBHOOK_SECRET||'',siteUrl=process.env.PUBLIC_SITE_URL||'',liveApproved=process.env.ANIMATIONS_LIVE_PAYMENTS_APPROVED==='true',priceIds={play_pass:process.env.STRIPE_PLAY_PASS_MONTHLY_PRICE_ID,play_pass_pro:process.env.STRIPE_PLAY_PASS_PRO_MONTHLY_PRICE_ID},fetchImpl=fetch,now=Date.now}={}){
 const test=key.startsWith('sk_test_');let origin;try{const u=new URL(siteUrl);if(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))origin=u.origin;}catch{}
 const ready=!!(origin&&store.ready&&secret&&(test||key.startsWith('sk_live_')&&liveApproved&&origin.startsWith('https:')));
 const fail=(code,status=400)=>{throw new AnimationError(code,status);};
 async function stripe(path,params,idempotency,version){
  const r=await fetchImpl('https://api.stripe.com/v1/'+path,{method:params?'POST':'GET',headers:{Authorization:'Bearer '+key,...(version?{'Stripe-Version':version}:{}),...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},...(params?{body:new URLSearchParams(params).toString()}:{}),signal:AbortSignal.timeout(15000)});
  const data=await r.json();if(!r.ok)fail('ANIM_CHECKOUT_UNAVAILABLE',503);return data;
 }
 const commerce=createCommerceBilling({store,stripe:(path,params,id)=>stripe(path,params,id,'2024-06-20'),ready,test,origin,now});
 async function create(user,body){
  if(!ready)fail('ANIM_CHECKOUT_UNAVAILABLE',503);requireUUID(body.requestId);
  if(typeof body.packageId!=='string'||body.packageId.length>40)fail('ANIM_INVALID');
  const o=await store.rpc('animation_create_order',{p_user:user.id,p_request:body.requestId,p_package:body.packageId,p_test:test});
  if(o.status!=='pending')return {status:o.status};if(now()-Date.parse(o.created_at)>23*3600000)fail('ANIM_CHECKOUT_EXPIRED',409);
  let s=o.session_id?await stripe('checkout/sessions/'+encodeURIComponent(o.session_id)):null;
  if(!s){
   const account=await store.one('animation_stripe_accounts',{user_id:user.id,test});
   s=await stripe('checkout/sessions',{mode:'payment',...(account?{customer:account.customer_id}:{customer_creation:'always',customer_email:user.email}),client_reference_id:o.id,locale:body.locale==='en'?'en':'ro',
    'metadata[purpose]':'animation_credits','metadata[animation_order]':o.id,'metadata[user_id]':user.id,
    'payment_intent_data[metadata][purpose]':'animation_credits','payment_intent_data[metadata][animation_order]':o.id,
    'line_items[0][quantity]':'1','line_items[0][price_data][currency]':o.currency,'line_items[0][price_data][unit_amount]':String(o.amount),
    'line_items[0][price_data][product_data][name]':o.credits+' TikInteract AI credits',
    success_url:origin+'/live-studio.html?animations=payment-success',cancel_url:origin+'/live-studio.html?animations=payment-cancelled'},'tikinteract-ai-credits-'+o.id);
   await store.update('animation_orders',{id:o.id,user_id:user.id},{session_id:s.id});
  }
  if(s.status==='complete')return {status:'pending'}; // Only verified webhook grants.
  if(s.status!=='open')fail('ANIM_CHECKOUT_EXPIRED',409);
  const target=new URL(s.url);if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')fail('ANIM_CHECKOUT_UNAVAILABLE',503);return {url:target.href,test};
 }
 async function payment(sessionId){
  const s=await stripe('checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=payment_intent.latest_charge');
  if(s.metadata?.purpose!=='animation_credits')return false;
  const o=await store.one('animation_orders',{id:requireUUID(s.metadata.animation_order)});
  if(!o||s.metadata.user_id!==o.user_id||s.client_reference_id!==o.id||s.mode!=='payment'||s.livemode===o.test||s.livemode===test||s.amount_total!==o.amount||s.currency!==o.currency||o.session_id&&o.session_id!==s.id)fail('ANIM_PAYMENT_MISMATCH',403);
  if(s.status!=='complete'||s.payment_status!=='paid')return true;
  const pi=s.payment_intent,c=pi?.latest_charge;
  if(pi?.status!=='succeeded'||pi.amount_received!==o.amount||pi.currency!==o.currency||typeof c!=='object'||!c?.id)fail('ANIM_PAYMENT_MISMATCH',403);
  await store.rpc('animation_credit_payment',{p_order:o.id,p_session:s.id,p_intent:pi.id,p_customer:typeof s.customer==='string'?s.customer:null,p_refunded:c.amount_refunded||0,p_disputed:c.disputed===true});return true;
 }
 async function invoice(id){
  const inv=await stripe('invoices/'+encodeURIComponent(id)+'?expand[]=lines.data.price');
  if(inv.livemode===test||inv.status!=='paid'||inv.amount_paid<=0||!['ron','eur','usd'].includes(inv.currency))return false;
  const account=await store.one('animation_stripe_accounts',{customer_id:inv.customer,test});if(!account)return false;
  // Do not turn arbitrary subscription metadata into an entitlement. Only
  // explicit, existing monthly Price IDs and known paid customers qualify.
  const lines=inv.lines?.data||[];if(inv.lines?.has_more)fail('ANIM_INVOICE_REVIEW',409);
  for(const line of lines){
   const price=typeof line.price==='string'?line.price:line.price?.id||line.pricing?.price_details?.price;
   const plan=Object.keys(priceIds).find(p=>priceIds[p]&&priceIds[p]===price);if(!plan||line.proration||line.parent?.subscription_item_details?.proration||line.amount<=0)continue;
   const sub=inv.subscription||inv.parent?.subscription_details?.subscription;
   if(!sub||!line.period?.start||!line.period?.end)continue;
   await store.rpc('animation_invoice_grant',{p_user:account.user_id,p_source:'invoice:'+inv.id+':'+line.period.start,p_subscription:sub,p_plan:plan,p_start:new Date(line.period.start*1000).toISOString(),p_end:new Date(line.period.end*1000).toISOString(),p_test:test});
  }return true;
 }
 async function webhook(raw,signature){
  // False means this belongs to the original plan billing handler.
  let event;try{event=JSON.parse(raw.toString('utf8'));}catch{return false;}
  const supported=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired','invoice.paid','charge.refunded','charge.dispute.created','customer.subscription.deleted'];if(!supported.includes(event.type))return false;
  const object=event.data?.object;
  const tagged=['animation_credits','tikinteract_test_commerce'].includes(object?.metadata?.purpose);
  if(!store.ready)return false;
  // Ignore untagged checkout events, letting existing subscription access work
  // even before the optional animations migration/configuration is installed.
  if(event.type.startsWith('checkout.')&&!tagged)return false;
  if(!verifyStripeSignature(raw,signature,secret,now()))fail('ANIM_INVALID_SIGNATURE');
  if(!ready){if(tagged)fail('ANIM_CHECKOUT_UNAVAILABLE',503);return false;}
  if(event.livemode===test)fail('ANIM_PAYMENT_MODE_MISMATCH');
  if(await commerce.handle(event))return true;
  if(event.type==='customer.subscription.deleted')return false;
  if(event.type==='invoice.paid')return Object.values(priceIds).some(Boolean)?invoice(object.id):false;
  if(event.type==='charge.refunded'||event.type==='charge.dispute.created'){
   const id=event.type==='charge.refunded'?object.id:object.charge;if(typeof id!=='string'||!/^ch_\w+$/.test(id))fail('ANIM_INVALID');
   const charge=await stripe('charges/'+id),intent=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
   if(!intent)return false;
   const pi=await stripe('payment_intents/'+encodeURIComponent(intent));
   if(pi.metadata?.purpose!=='animation_credits'){
    // Optional module/migration must never block a legacy plan refund.
    if(!Object.values(priceIds).some(Boolean)||!charge.invoice)return false;
   }
   if(pi.metadata?.purpose==='animation_credits'){
   const order=await store.one('animation_orders',{intent});
   if(order){await payment(order.session_id);return true;}
   // A reversal may arrive before checkout.session.completed: resolve it from
   // Stripe's canonical Session instead of dropping the early reversal.
   const sessions=await stripe('checkout/sessions?payment_intent='+encodeURIComponent(intent)+'&limit=1');
   if(sessions.data?.[0]?.metadata?.purpose==='animation_credits')return payment(sessions.data[0].id);
   }
   const invoiceId=typeof charge.invoice==='string'?charge.invoice:charge.invoice?.id;
   if(invoiceId&&(charge.amount_refunded>0||charge.disputed)){
    const periods=await store.list('animation_stripe_periods',{},100);for(const p of periods.filter(p=>p.source.startsWith('invoice:'+invoiceId+':'))){const batch=await store.one('animation_credit_batches',{source:p.source});if(batch)await store.rpc('animation_reverse',{p_source:p.source,p_total:charge.disputed?batch.issued:Math.ceil(batch.issued*charge.amount_refunded/charge.amount)});}
   }return false;
  }
  if(event.type==='checkout.session.async_payment_failed'||event.type==='checkout.session.expired'){
   await store.update('animation_orders',{session_id:object.id,status:'pending'},{status:event.type.endsWith('expired')?'expired':'failed'});return true;
  }
  return payment(object.id);
 }
 return {ready,test,create,webhook,commerce};
}
