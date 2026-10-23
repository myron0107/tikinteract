import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createAnimationFixture} from './helpers/animations-fixture.mjs';
import {createAnimationService,validateAnimationConfig} from '../lib/animations-service.js';
import {createAnimationBilling} from '../lib/animations-billing.js';
import {handleAnimationRequest} from '../lib/animations-http.js';
import {imageInput,videoInput,profitability} from '../lib/animations-models.js';
import {createAnimationStore} from '../lib/animations-store.js';
const input=photoId=>({action:'generate',requestId:crypto.randomUUID(),photoId,tier:'standard',format:'9:16',duration:5,world:'vampire',prompt:'The character waves to the audience',title:'Arrival',consent:true});
test('Real async pipeline: private photo → moderation → image queue → video queue → saved MP4, credits charged once',async()=>{
 const f=await createAnimationFixture();try{
  await f.grant();const service=createAnimationService({store:f.store,provider:f.provider,approved:true,siteUrl:'http://127.0.0.1:3031'}),photo=await f.addPhoto(),body=input(photo);
  const job=await service.command(f.user,body);assert.equal(job.status,'moderation');assert.equal(f.calls.length,0);
  assert.equal((await service.command(f.user,body)).id,job.id);await assert.rejects(service.command(f.user,{...body,prompt:'An entirely different action'}),/ANIM_REQUEST_MISMATCH/);
  await service.command(f.user,{action:'moderate',id:job.id,approve:true});await service.processOne();
  assert.equal((await f.store.one('animation_jobs',{id:job.id})).status,'image_queued');await f.db.exec("update public.animation_jobs set next_poll_at=now()");await service.processOne();
  assert.equal((await f.store.one('animation_jobs',{id:job.id})).status,'video_queued');await f.db.exec("update public.animation_jobs set next_poll_at=now()");await service.processOne();
  const state=await service.command(f.user,{action:'state'});assert.equal(state.library.length,2);assert.equal(state.library[0].kind,'generated');assert(state.library.some(m=>m.kind==='character'&&m.mime==='image/jpeg'));assert.equal(state.jobs[0].status,'completed');assert.equal(state.wallet.purchased,90);assert.equal(f.calls.length,2);
  const json=JSON.stringify(state);assert(!json.includes('estimated_usd_micros'));assert(!json.includes('character_path'));assert(!json.includes('fixture.fal.media'));assert.equal(state.library[0].url.includes('/__media'),true);
  await service.processOne();assert.equal(f.calls.length,2);const download=await service.command(f.user,{action:'download',id:state.library[0].id});assert(download.url);assert.equal((await service.command(f.user,{action:'state'})).wallet.purchased,90);
 }finally{await f.db.close();}
});
test('Server authentication validates Supabase Auth and account permission, rejecting preview and suspended users',async()=>{
 let preview=false,allowed=true,authCalls=0;
 const store=createAnimationStore({key:'service-fixture',url:'https://db.invalid',anonKey:'anon-fixture',fetchImpl:async url=>{
  if(String(url).includes('/auth/v1/user')){authCalls++;return Response.json({id:'10000000-0000-0000-0000-000000000001',email_confirmed_at:new Date().toISOString(),app_metadata:preview?{site_preview:true}:{}});}
  return Response.json({allowed});
 }}),request=new Request('https://site.invalid/api/animations',{headers:{Authorization:'Bearer '+('a'.repeat(30))}});
 assert.equal((await store.authenticate(request)).id,'10000000-0000-0000-0000-000000000001');assert.equal(authCalls,1);
 preview=true;await assert.rejects(store.authenticate(request),/ANIM_ACCOUNT_REQUIRED/);preview=false;allowed=false;await assert.rejects(store.authenticate(request),/ANIM_ACCOUNT_REQUIRED/);
});
test('Optional animations migration cannot intercept legacy plan reversals or invoices without a subscription map',async()=>{
 const stamp=Math.floor(Date.now()/1000),secret='whsec_fixture';let dbCalls=0;
 const billing=createAnimationBilling({store:{ready:true,one:async()=>{dbCalls++;throw Error('Migration not installed');}},key:'sk_test_fixture',secret,siteUrl:'https://site.invalid',fetchImpl:async url=>Response.json(String(url).includes('/charges/')?{id:'ch_fixture',payment_intent:'pi_fixture',refunded:true}:{metadata:{order_id:'legacy-plan-order'}})});
 for(const event of [{type:'invoice.paid',livemode:false,data:{object:{id:'in_legacy'}}},{type:'charge.refunded',livemode:false,data:{object:{id:'ch_fixture'}}}]){
  const raw=Buffer.from(JSON.stringify(event)),signature='t='+stamp+',v1='+createHmac('sha256',secret).update(stamp+'.').update(raw).digest('hex');assert.equal(await billing.webhook(raw,signature),false);
 }assert.equal(dbCalls,0);
});
test('Paid-call gates, moderation and ambiguous network submissions never auto-regenerate or spend again',async()=>{
 const f=await createAnimationFixture();try{
  await f.grant();const photo=await f.addPhoto(),off=createAnimationService({store:f.store,provider:f.provider,approved:false});await assert.rejects(off.command(f.user,input(photo)),/ANIM_ACTIVATION_REQUIRED/);assert.deepEqual(f.calls,[]);
  const service=createAnimationService({store:f.store,provider:{...f.provider,submitImage:async()=>{f.calls.push('uncertain');throw Error('timeout');}},approved:true});
  await assert.rejects(service.command(f.user,{...input(photo),consent:false}),/ANIM_INVALID/);await assert.rejects(service.command(f.user,{...input(photo),prompt:'Create a nude character'}),/ANIM_CONTENT_REJECTED/);
  const job=await service.command(f.user,input(photo));await service.processOne();assert.equal(f.calls.length,0);await service.command(f.user,{action:'moderate',id:job.id,approve:true});await service.processOne();assert.equal(f.calls.length,1);
  assert.equal((await f.store.one('animation_jobs',{id:job.id})).status,'review');await service.processOne();assert.equal(f.calls.length,1);
  await service.command(f.user,{action:'resolve',id:job.id});assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).purchased,100);
 }finally{await f.db.close();}
});
test('Library ownership, real event matching, duplicate queueing, overlay rotation and scoped capabilities',async()=>{
 const f=await createAnimationFixture();try{
  const s=createAnimationService({store:f.store,provider:f.provider,approved:false,siteUrl:'http://127.0.0.1:3031'}),path=f.user.id+'/video.mp4';f.files.set(path,f.video);
  const media=await f.store.insert('animation_media',{user_id:f.user.id,path,mime:'video/mp4',bytes:f.video.length,title:'Video',world:'vampire',format:'9:16',kind:'upload',ready:true});
  const other={id:crypto.randomUUID()};await assert.rejects(s.command(other,{action:'download',id:media.id}),/ANIM_NOT_FOUND/);
  await s.command(f.user,{action:'saveRule',clip:media.id,type:'gift',gift:'5655',threshold:2,enabled:true});
  const event={type:'gift',eventId:'one',timestamp:Date.now(),username:'viewer',giftId:'5655',repeatCount:2,coins:2};
  assert.equal((await s.command(f.user,{action:'event',event})).queued,1);assert.equal((await s.command(f.user,{action:'event',event})).queued,0);await assert.rejects(s.command(f.user,{action:'event',event:{...event,demo:true}}),/ANIM_INVALID_EVENT/);assert.equal(f.calls.length,0);
  const url=await s.command(f.user,{action:'overlayToken'}),token=new URL(url.url).hash.slice(1),clip=await s.overlay({token});assert.equal(clip.clip.title,'Video');assert(!('user_id' in clip.clip));
  await s.command(f.user,{action:'revokeOverlay'});await assert.rejects(s.overlay({token}),/ANIM_OVERLAY_UNAUTHORIZED/);
 }finally{await f.db.close();}
});
test('Stripe credit Checkout uses only server package price; grants only on canonical signed paid webhook and reverses partial refunds',async()=>{
 const f=await createAnimationFixture();try{
  const secret='whsec_local_fixture',stamp=Math.floor(Date.now()/1000),sign=raw=>'t='+stamp+',v1='+createHmac('sha256',secret).update(stamp+'.').update(raw).digest('hex');let session,checkoutCalls=0;
  const billing=createAnimationBilling({store:f.store,key:'sk_test_fixture',secret,siteUrl:'http://127.0.0.1:3031',fetchImpl:async(url,options)=>{
   if(url==='https://api.stripe.com/v1/checkout/sessions'){
    checkoutCalls++;const p=new URLSearchParams(options.body);assert.equal(p.get('line_items[0][price_data][unit_amount]'),'2500');assert.equal(p.get('mode'),'payment');
    session={id:'cs_test_animation_fixture',status:'open',url:'https://checkout.stripe.com/c/pay/test',mode:'payment',metadata:{purpose:'animation_credits',animation_order:p.get('metadata[animation_order]'),user_id:f.user.id},client_reference_id:p.get('client_reference_id'),livemode:false,amount_total:2500,currency:'ron',customer:'cus_fixture',payment_intent:{id:'pi_animation_fixture',status:'succeeded',amount_received:2500,currency:'ron',latest_charge:{id:'ch_fixture',amount_refunded:0,disputed:false}}};
   }
   return Response.json(session);
  }});
  const body={packageId:'credits-100',requestId:crypto.randomUUID(),amount:1,credits:999999};await billing.create(f.user,body);await billing.create(f.user,body);assert.equal(checkoutCalls,1);assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).purchased,0);
  session.status='complete';session.payment_status='paid';const raw=Buffer.from(JSON.stringify({type:'checkout.session.completed',livemode:false,data:{object:session}}));
  await assert.rejects(billing.webhook(raw,'invalid'),/ANIM_INVALID_SIGNATURE/);assert.equal(await billing.webhook(raw,sign(raw)),true);await billing.webhook(raw,sign(raw));assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).purchased,100);
  session.payment_intent.latest_charge.amount_refunded=1250;await billing.webhook(raw,sign(raw));assert.equal((await f.store.rpc('animation_wallet',{p_user:f.user.id,p_test:true})).purchased,50);
  assert.equal(createAnimationBilling({store:f.store,key:'sk_live_fixture',secret,siteUrl:'https://site.invalid'}).ready,false);
 }finally{await f.db.close();}
});
test('HTTP rejects unauthenticated, cross-origin, oversized and forged worker requests; no client-controlled model endpoint',async()=>{
 const f=await createAnimationFixture();try{
  const service=createAnimationService({store:f.store,provider:f.provider,approved:false,siteUrl:'http://127.0.0.1:3031',cronSecret:'local-cron'});
  const call=(body,headers={},path='')=>handleAnimationRequest(new Request('http://127.0.0.1:3031/api/animations'+path,{method:'POST',headers:{Origin:'http://127.0.0.1:3031',...headers},body:JSON.stringify(body)}),{service,store:f.store});
  assert.equal((await call({action:'state'})).status,401);assert.equal((await call({action:'state'},{Origin:'https://evil.invalid'})).status,403);assert.equal((await call({padding:'x'.repeat(33000)})).status,413);
  // PUBLIC_SITE_URL may be absent or point to the production domain while a
  // user is on its preview/custom domain. Same-origin requests still work;
  // missing, opaque and cross-site origins remain forbidden before auth/data.
  for(const configured of ['', 'https://another-owned-domain.invalid']){
   const alternate=createAnimationService({store:f.store,provider:f.provider,approved:false,siteUrl:configured});
   const post=origin=>handleAnimationRequest(new Request('https://tikinteract.vercel.app/api/animations',{method:'POST',headers:{'Content-Type':'application/json',...(origin===null?{}:{Origin:origin}),Authorization:'Bearer local-fixture'},body:'{"action":"state"}'}),{service:alternate,store:f.store});
   const accepted=await post('https://tikinteract.vercel.app');assert.equal(accepted.status,200);assert.equal((await accepted.json()).worlds.length,8);
   for(const origin of [null,'null','https://evil.invalid','http://tikinteract.vercel.app','https://tikinteract.vercel.app.evil.invalid']){const denied=await post(origin);assert.equal(denied.status,403);assert.equal((await denied.json()).error,'INVALID_ORIGIN');}
  }
  assert.equal(f.calls.length,0,'Loading Studio must never start paid generation');
  assert.equal((await call({},{},'/worker')).status,401);assert.equal((await call({},{Authorization:'Bearer local-cron'},'/worker')).status,200);
  const photo=await f.addPhoto();const p=imageInput({format:'9:16'},'https://private/photo','original knight');assert.equal(p.safety_tolerance,'1');assert.equal(p.aspect_ratio,'9:16');const v=videoInput({tier:'premium',prompt:'waves',format:'9:16'},'image','photo','original knight');assert.equal(v.duration,'5');assert.equal(v.elements[0].frontal_image_url,'photo');assert.equal(v.enable_safety_checker,true);
  const config=(await f.store.one('animation_settings',{singleton:true})).config;assert.doesNotThrow(()=>validateAnimationConfig(config));assert.throws(()=>validateAnimationConfig({...config,standardCredits:-1}),/ANIM_CONFIG_INVALID/);
  assert(profitability({grossCents:2900,taxBps:2000,stripeBps:200,stripeFixedCents:100,affiliateBps:1000,infrastructureCents:100,creditCount:20,costUsdMicros:2000,usdToCurrency:5,minimumMarginBps:3000}).acceptable);
 }finally{await f.db.close();}
});
