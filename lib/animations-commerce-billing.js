// Test-only recurring subscriptions and one-off credit packs. Uses the same
// Stripe transport, signature verifier, customer mapping and wallet as Studio.
import {AnimationError,requireUUID} from './animations-store.js';
const fail=(code,status=400)=>{throw new AnimationError(code,status);};
const purpose='tikinteract_test_commerce';
export function createCommerceBilling({store,stripe,ready,test,origin,now=Date.now}){
 const available=ready&&test;
 async function validatePrice(o){
  const p=await stripe('prices/'+encodeURIComponent(o.price_id));
  if(p.id!==o.price_id||!p.active||p.livemode!==false||p.currency!=='eur'||p.unit_amount!==o.amount||p.billing_scheme!=='per_unit'||p.custom_unit_amount||p.transform_quantity||p.tiers_mode||
   (o.kind==='subscription'?(p.type!=='recurring'||p.recurring?.interval!=='month'||p.recurring.interval_count!==1||p.recurring.usage_type!=='licensed'):(p.type!=='one_time'||p.recurring)))fail('ANIM_PRICE_MISMATCH');
  return p;
 }
 function verifySession(s,o){
  if(!o||s.livemode!==false||s.metadata?.purpose!==purpose||s.metadata.order_id!==o.id||s.metadata.user_id!==o.user_id||s.client_reference_id!==o.id||s.mode!==(o.kind==='subscription'?'subscription':'payment')||s.amount_total!==o.amount||s.currency!==o.currency||o.session_id&&o.session_id!==s.id||o.customer_id&&o.customer_id!==s.customer)fail('ANIM_PAYMENT_MISMATCH',403);
 }
 async function create(user,body){
  if(!available)fail('ANIM_TEST_ONLY',503);requireUUID(body.requestId);
  if(!['subscription','topup'].includes(body.kind)||typeof body.offer!=='string'||body.offer.length>40)fail('ANIM_INVALID');
  const o=await store.rpc('animation_commerce_order',{p_user:user.id,p_request:body.requestId,p_kind:body.kind,p_offer:body.offer});
  if(o.status!=='pending')return {status:o.status,test:true};
  if(now()-Date.parse(o.created_at)>23*3600000)fail('ANIM_CHECKOUT_EXPIRED',409);
  try{await validatePrice(o);}catch(e){if(e.code==='ANIM_PRICE_MISMATCH')await store.update('animation_commerce_orders',{id:o.id,status:'pending'},{status:'failed'});throw e;}
  let s=o.session_id?await stripe('checkout/sessions/'+encodeURIComponent(o.session_id)):null;
  if(!s){
   const a=await store.one('animation_stripe_accounts',{user_id:user.id,test:true});
   const meta={'metadata[purpose]':purpose,'metadata[order_id]':o.id,'metadata[user_id]':user.id};
   const prefix=o.kind==='subscription'?'subscription_data':'payment_intent_data';
   s=await stripe('checkout/sessions',{mode:o.kind==='subscription'?'subscription':'payment',...(a?{customer:a.customer_id}:o.kind==='topup'?{customer_creation:'always',customer_email:user.email}:{customer_email:user.email}),
    client_reference_id:o.id,locale:body.locale==='en'?'en':'ro',...meta,
    [`${prefix}[metadata][purpose]`]:purpose,[`${prefix}[metadata][order_id]`]:o.id,[`${prefix}[metadata][user_id]`]:user.id,
    'line_items[0][quantity]':'1','line_items[0][price]':o.price_id,
    success_url:origin+'/live-studio.html?animations=payment-success',cancel_url:origin+'/live-studio.html?animations=payment-cancelled'},'tikinteract-test-commerce-'+o.id);
   await store.update('animation_commerce_orders',{id:o.id,user_id:user.id},{session_id:s.id});
  }
  verifySession(s,o);
  if(s.status==='complete')return {status:'pending',test:true};
  if(s.status!=='open')fail('ANIM_CHECKOUT_EXPIRED',409);
  const u=new URL(s.url);if(u.protocol!=='https:'||u.hostname!=='checkout.stripe.com')fail('ANIM_CHECKOUT_UNAVAILABLE',503);return {url:u.href,test:true};
 }
 async function account(o,customer){
  if(typeof customer!=='string'||!/^cus_\w+$/.test(customer))fail('ANIM_PAYMENT_MISMATCH');
  // A stable customer is reused across both existing and new checkout flows.
  const a=await store.one('animation_stripe_accounts',{user_id:o.user_id,test:true});
  if(!a)await store.insert('animation_stripe_accounts',{user_id:o.user_id,test:true,customer_id:customer});
 }
 async function chargeFacts(c){
  if(!c?.id)return {};
  const b=c.balance_transaction;
  return {charge_id:c.id,...(b&&typeof b==='object'&&b.currency==='eur'&&Number.isSafeInteger(b.fee)?{stripe_fee_cents:b.fee}:{})};
 }
 async function payment(sessionId){
  const s=await stripe('checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=payment_intent.latest_charge.balance_transaction');
  if(s.metadata?.purpose!==purpose)return false;
  const o=await store.one('animation_commerce_orders',{id:requireUUID(s.metadata.order_id)});verifySession(s,o);
  if(o.kind==='subscription')return attach(s.subscription);
  if(s.status!=='complete'||s.payment_status!=='paid')return true;
  const pi=s.payment_intent,c=pi?.latest_charge;
  if(pi?.status!=='succeeded'||pi.amount_received!==o.amount||pi.currency!=='eur'||!c?.id||c.amount!==o.amount||c.livemode!==false)fail('ANIM_PAYMENT_MISMATCH');
  await store.rpc('animation_commerce_paid',{p_order:o.id,p_session:s.id,p_customer:s.customer,p_intent:pi.id,p_paid_at:new Date(c.created*1000).toISOString(),p_refunded:c.amount_refunded||0,p_disputed:c.disputed===true});
  const tax=s.total_details?.amount_tax;
  await account(o,s.customer);await store.update('animation_commerce_orders',{id:o.id},{...await chargeFacts(c),tax_cents:tax>0||s.automatic_tax?.enabled&&s.automatic_tax.status==='complete'?tax??0:null});return true;
 }
 async function attach(id){
  if(typeof id!=='string'||!/^sub_\w+$/.test(id))fail('ANIM_PAYMENT_MISMATCH');
  const sub=await stripe('subscriptions/'+id);
  if(sub.metadata?.purpose!==purpose)return false;
  const o=await store.one('animation_commerce_orders',{id:requireUUID(sub.metadata.order_id)});
  if(!o||o.kind!=='subscription'||sub.livemode!==false||sub.metadata.user_id!==o.user_id||o.subscription_id&&o.subscription_id!==id||sub.items?.data?.length!==1||sub.items.data[0].price?.id!==o.price_id||sub.items.data[0].quantity!==1)fail('ANIM_PAYMENT_MISMATCH');
  const sessions=await stripe('checkout/sessions?subscription='+id+'&limit=2');
  if(sessions.data?.length!==1)fail('ANIM_PAYMENT_MISMATCH');const s=sessions.data[0];verifySession(s,o);
  if(s.status!=='complete'||s.customer!==sub.customer)fail('ANIM_PAYMENT_MISMATCH');
  await store.update('animation_commerce_orders',{id:o.id},{session_id:s.id,subscription_id:id,customer_id:sub.customer,...(sub.status==='canceled'?{status:'cancelled'}:{})});
  await account(o,sub.customer);return {...o,subscription_id:id,customer_id:sub.customer};
 }
 async function invoice(id){
  const inv=await stripe('invoices/'+encodeURIComponent(id)+'?expand[]=charge.balance_transaction');
  const sub=typeof inv.subscription==='string'?inv.subscription:inv.subscription?.id;
  if(!sub)return false;
  const o=await attach(sub);if(!o)return false;
  if(inv.livemode!==false||inv.customer!==o.customer_id||inv.currency!=='eur'||inv.status!=='paid'||inv.amount_paid!==o.amount||inv.paid_out_of_band||inv.collection_method!=='charge_automatically'||!['subscription_create','subscription_cycle'].includes(inv.billing_reason)||inv.lines?.has_more||inv.lines?.data?.length!==1)fail('ANIM_INVOICE_REVIEW',409);
  const line=inv.lines.data[0],price=typeof line.price==='string'?line.price:line.price?.id;
  if(price!==o.price_id||line.proration||line.quantity!==1||line.amount!==o.amount||!line.period?.start||!line.period?.end)fail('ANIM_INVOICE_REVIEW',409);
  const c=inv.charge;
  if(typeof c!=='object'||!c?.id||c.status!=='succeeded'||c.livemode!==false||c.amount!==o.amount||c.currency!=='eur')fail('ANIM_INVOICE_REVIEW',409);
  await store.rpc('animation_commerce_invoice',{p_order:o.id,p_invoice:inv.id,p_subscription:sub,p_start:new Date(line.period.start*1000).toISOString(),p_end:new Date(line.period.end*1000).toISOString(),p_amount:inv.amount_paid,p_paid_at:new Date(inv.status_transitions.paid_at*1000).toISOString(),p_refunded:c.amount_refunded||0,p_disputed:c.disputed===true});
  const taxes=inv.total_tax_amounts||[];
  await store.update('animation_commerce_invoices',{id:inv.id},{...await chargeFacts(c),tax_cents:taxes.length||inv.automatic_tax?.enabled&&inv.automatic_tax.status==='complete'?taxes.reduce((n,x)=>n+x.amount,0):null});
  if(c.amount_refunded||c.disputed)await store.rpc('animation_commerce_reverse_invoice',{p_invoice:inv.id,p_refunded:c.amount_refunded||0,p_disputed:c.disputed===true});return true;
 }
 // Signature + event-mode verification happens in the existing webhook wrapper.
 async function handle(event){
  if(!available)return false;const obj=event.data?.object;
  if(event.type.startsWith('checkout.')&&obj?.metadata?.purpose===purpose){
   if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)){
    const s=await stripe('checkout/sessions/'+encodeURIComponent(obj.id));const o=await store.one('animation_commerce_orders',{id:requireUUID(s.metadata?.order_id)});verifySession(s,o);
    await store.update('animation_commerce_orders',{id:o.id,status:'pending'},{status:event.type.endsWith('expired')?'expired':'failed'});return true;
   }return payment(obj.id);
  }
  if(event.type==='invoice.paid')return invoice(obj.id);
  if(event.type==='customer.subscription.deleted'){
   const o=await attach(obj.id);if(!o)return false;await store.update('animation_commerce_orders',{id:o.id},{status:'cancelled'});return true;
  }
  if(['charge.refunded','charge.dispute.created'].includes(event.type)){
   const id=event.type==='charge.refunded'?obj.id:obj.charge;if(typeof id!=='string'||!/^ch_\w+$/.test(id))fail('ANIM_INVALID');
   const c=await stripe('charges/'+id+'?expand[]=payment_intent');
   if(c.payment_intent?.metadata?.purpose===purpose){
    if(c.livemode!==false)fail('ANIM_PAYMENT_MODE_MISMATCH');
    const sessions=await stripe('checkout/sessions?payment_intent='+encodeURIComponent(c.payment_intent.id)+'&limit=1');return sessions.data?.[0]?payment(sessions.data[0].id):false;
   }
   const inv=typeof c.invoice==='string'?c.invoice:c.invoice?.id;if(inv)return invoice(inv);
  }return false;
 }
 return {available,create,handle,validatePrice};
}
