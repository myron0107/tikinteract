import {randomUUID,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {AnimationError,requireUUID,createAnimationStore} from './animations-store.js';
import {createAnimationProvider} from './animations-provider.js';
import {IMAGE_MODEL,VIDEO_MODELS,WORLD_PROMPTS,validateGeneration,profitability} from './animations-models.js';
import {matchesAnimationRule} from '../assets/animations-live-rules.js';
import {effectiveAnimationConfig,validateCommerce,testGenerationProfitable} from './animations-finance.js';
import {createFinanceService} from './animations-finance-service.js';
export const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=(code,status=400)=>{throw new AnimationError(code,status);};
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export function validMedia(bytes,mime){return mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':mime==='video/mp4'&&bytes.toString('ascii',4,8)==='ftyp';}
export function validateAnimationConfig(cfg){
 if(cfg?.testCommerce)validateCommerce(cfg.testCommerce);
 if(!cfg||typeof cfg.enabled!=='boolean'||typeof cfg.testMode!=='boolean'||!Number.isInteger(cfg.maxConcurrent)||cfg.maxConcurrent<1||cfg.maxConcurrent>3)fail('ANIM_CONFIG_INVALID');
 for(const key of ['standardCredits','premiumCredits','standardUsdMicros','premiumUsdMicros','dailyUsdMicros','userMonthlyUsdMicros'])if(cfg[key]!==null&&(!Number.isSafeInteger(cfg[key])||cfg[key]<=0||cfg[key]>1000000000))fail('ANIM_CONFIG_INVALID');
 for(const key of ['play_pass','play_pass_pro'])if(!Number.isSafeInteger(cfg.monthlyCredits?.[key])||cfg.monthlyCredits[key]<0||cfg.monthlyCredits[key]>1000000)fail('ANIM_CONFIG_INVALID');
 if(cfg.monthlyCredits.play_pass_pro<cfg.monthlyCredits.play_pass)fail('ANIM_CONFIG_INVALID');
 const f=cfg.finance;if(!f)fail('ANIM_CONFIG_INVALID');
 for(const key of ['taxBps','stripeBps','affiliateBps'])if(!Number.isInteger(f[key])||f[key]<0||f[key]>10000)fail('ANIM_CONFIG_INVALID');
 for(const key of ['stripeFixedCents','infrastructureCents'])if(!Number.isInteger(f[key])||f[key]<0||f[key]>100000)fail('ANIM_CONFIG_INVALID');
 if(f.usdToCurrency!==null&&(!Number.isFinite(f.usdToCurrency)||f.usdToCurrency<=0||f.usdToCurrency>1000))fail('ANIM_CONFIG_INVALID');
 if(f.minimumMarginBps!==null&&(!Number.isInteger(f.minimumMarginBps)||f.minimumMarginBps<0||f.minimumMarginBps>=10000))fail('ANIM_CONFIG_INVALID');
 if(!Array.isArray(cfg.packages)||cfg.packages.length>12)fail('ANIM_CONFIG_INVALID');
 const ids=new Set();for(const p of cfg.packages){if(!p||typeof p.id!=='string'||!/^\w[\w-]{0,39}$/.test(p.id)||ids.has(p.id)||typeof p.enabled!=='boolean'||!Number.isSafeInteger(p.credits)||p.credits<1||p.credits>1000000||!Number.isSafeInteger(p.amount)||p.amount<100||p.amount>10000000||!['ron','eur','usd'].includes(p.currency))fail('ANIM_CONFIG_INVALID');ids.add(p.id);}
 if(cfg.enabled&&['standardCredits','premiumCredits','standardUsdMicros','premiumUsdMicros','dailyUsdMicros','userMonthlyUsdMicros'].some(k=>!effectiveAnimationConfig(cfg)[k]))fail('ANIM_PRICING_REQUIRED');
 return cfg;
}
export function createAnimationService({store=createAnimationStore(),provider=createAnimationProvider(),approved=process.env.ANIMATIONS_PAID_AI_APPROVED==='true',siteUrl=process.env.PUBLIC_SITE_URL||'',cronSecret=process.env.CRON_SECRET||'',stripe=null}={}){
 let origin;try{origin=new URL(siteUrl).origin;}catch{}
 const finance=createFinanceService({store,stripe});
 const config=async()=>(await store.one('animation_settings',{singleton:true}))||fail('ANIM_SETUP_REQUIRED',503);
 const owned=async(table,id,user)=>{const row=await store.one(table,{id:requireUUID(id),user_id:user.id});return row||fail('ANIM_NOT_FOUND',404);};
 const safeJob=j=>({id:j.id,title:j.title,world:j.world,tier:j.tier,format:j.format,status:j.status,credits:j.credits,test:j.test,result_id:j.result_id,error:j.error,created_at:j.created_at});
 async function state(user){
  const settings=await config(),cfg=effectiveAnimationConfig(settings.config),[wallet,media,jobs,rules,worlds,transactions,orders]=await Promise.all([
   store.rpc('animation_wallet',{p_user:user.id,p_test:cfg.testMode}),store.list('animation_media',{user_id:user.id,deleted:false,ready:true},160),store.list('animation_jobs',{user_id:user.id},40),store.list('animation_rules',{user_id:user.id},40),store.worlds?store.worlds(user.id):store.list('animation_universes',{},1000),store.list('animation_transactions',{user_id:user.id},40),store.list('animation_orders',{user_id:user.id},30)
  ]);
  const library=await Promise.all(media.filter(m=>m.mime==='video/mp4'||m.kind==='character').map(async m=>({id:m.id,title:m.title,world:m.world,format:m.format,fan:m.fan,kind:m.kind,mime:m.mime,created_at:m.created_at,url:await store.sign(m.path)})));
  const usage=store.usage?await store.usage(user.id,cfg.testMode):null;
  const commerce=cfg.testMode&&cfg.testCommerce;
  const extraOrders=commerce?await store.list('animation_commerce_orders',{user_id:user.id},30):[];
  return {wallet,usage,library,jobs:jobs.map(safeJob),rules,worlds:worlds.filter(w=>!w.user_id||w.user_id===user.id).map(({id,name,description,base})=>({id,name,description,base})),transactions:transactions.map(({id,kind,amount,test,created_at})=>({id,kind,amount,test,created_at})),orders:[...orders,...extraOrders].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,40).map(({id,credits,amount,currency,test,status,created_at,kind,offer})=>({id,credits,amount,currency,test,status,created_at,kind,offer})),config:{enabled:cfg.enabled&&approved&&provider.ready&&testGenerationProfitable(cfg),standardCredits:cfg.standardCredits,premiumCredits:cfg.premiumCredits,monthlyCredits:cfg.monthlyCredits,testMode:cfg.testMode,commerce:!!commerce,plans:commerce?Object.entries(commerce.plans).map(([id,p])=>({id,credits:p.credits,amount:p.amount,currency:'eur',available:!!p.priceId&&!!stripe?.commerce?.available})):[],packages:cfg.packages.filter(p=>p.enabled).map(({id,credits,amount,currency,priceId})=>({id,credits,amount,currency,available:commerce?!!priceId&&!!stripe?.commerce?.available:!!stripe?.ready})),checkout:commerce?!!stripe?.commerce?.available:!!stripe?.ready}};
 }
 async function upload(user,body){
  const mime=body.mime,photo=['image/jpeg','image/png','image/webp'].includes(mime),limit=photo?10485760:104857600;
  if(body.consent!==true||!photo&&mime!=='video/mp4'||!Number.isInteger(body.bytes)||body.bytes<12||body.bytes>limit||!['9:16','16:9'].includes(body.format))fail('ANIM_INVALID_FILE');
  const worlds=await store.one('animation_universes',{id:body.world});if(!worlds||worlds.user_id&&worlds.user_id!==user.id)fail('ANIM_INVALID');
  const recent=await store.list('animation_media',{user_id:user.id},200);if(recent.filter(m=>Date.parse(m.created_at)>Date.now()-3600000).length>=30||recent.filter(m=>!m.deleted).length>=160)fail('ANIM_UPLOAD_LIMIT',429);
  const id=randomUUID(),path=`${user.id}/${id}.${({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4'})[mime]}`;
  await store.insert('animation_media',{id,user_id:user.id,path,mime,bytes:body.bytes,title:clean(body.title,80)||'Upload',world:body.world,format:body.format,kind:photo?'photo':'upload'});
  const ticket=store.check(await store.bucket.createSignedUploadUrl(path,{upsert:false}));return {id,path,token:ticket.token};
 }
 async function confirmUpload(user,body){
  const media=await owned('animation_media',body.id,user);if(media.deleted)fail('ANIM_NOT_FOUND');if(media.ready)return {id:media.id};
    const result=store.check(await store.bucket.download(media.path)),bytes=Buffer.from(await result.arrayBuffer());
  if(bytes.length!==Number(media.bytes)||!validMedia(bytes,media.mime)){await store.bucket.remove([media.path]);await store.update('animation_media',{id:media.id},{deleted:true});fail('ANIM_INVALID_FILE');}
  await store.update('animation_media',{id:media.id,user_id:user.id},{ready:true});return {id:media.id};
 }
 async function generate(user,body){
  if(!approved||!provider.ready)fail('ANIM_ACTIVATION_REQUIRED',503);
  if(!testGenerationProfitable((await config()).config))fail('ANIM_MARGIN_TOO_LOW');
  let input;try{input=validateGeneration(body);}catch(e){fail(e.message);}
  requireUUID(body.requestId);requireUUID(body.photoId);
  const job=await store.rpc('animation_reserve',{p_user:user.id,p_request:body.requestId,p_input:input,p_image_model:IMAGE_MODEL,p_video_model:VIDEO_MODELS[input.tier]});return safeJob(job);
 }
 async function processOne(userId=null){
  if(userId===null){for(const object of await store.list('animation_storage_cleanup',{},10)){store.check(await store.bucket.remove([object.path]));await store.remove('animation_storage_cleanup',{path:object.path});}}
  if(!approved||!provider.ready)return {disabled:true};
  const {config:cfg}=await config();if(!cfg.enabled)return {disabled:true};
  const j=await store.rpc('animation_claim',{p_user:userId});if(!j)return {idle:true};
  const patch=async values=>{const rows=await store.update('animation_jobs',{id:j.id,lease:j.lease},{...values,updated_at:new Date().toISOString()});if(!rows?.length)fail('ANIM_LEASE_LOST',409);};
  const release=async values=>patch({...values,lease:null,lease_until:null});
  try{
   if(Date.now()-Date.parse(j.created_at)>24*3600000){await release({status:'review',error:'ANIM_PROVIDER_TIMEOUT'});return {review:true};}
   const photo=await store.one('animation_media',{id:j.photo_id,user_id:j.user_id,deleted:false});if(!photo)throw new AnimationError('ANIM_PHOTO_REMOVED');
   const world=await store.one('animation_universes',{id:j.world});const setting=WORLD_PROMPTS[world.base]+(world.user_id?' '+world.description:'');
   if(j.status==='queued'){
    await patch({status:'submitting_image'});
    let submitted;try{submitted=await provider.submitImage(j,await store.sign(photo.path,1800),setting);}catch{await release({status:'review',error:'ANIM_SUBMISSION_UNCERTAIN'});return {review:true};}
    await release({status:'image_queued',image_request:submitted.request_id});return {status:'processing'};
   }
   if(['image_queued','video_queued'].includes(j.status)){
    const image=j.status==='image_queued',model=image?j.image_model:j.video_model,id=image?j.image_request:j.video_request;
    const status=await provider.status(model,id);if(status.status!=='COMPLETED'){await release({});return {status:status.status};}
    const data=await provider.result(model,id);
    if(data?.has_nsfw_concepts?.some(Boolean))throw new AnimationError('ANIM_CONTENT_REJECTED');
    if(image){
     const bytes=await provider.download(data.images?.[0]?.url,'image/',10485760),path=`${j.user_id}/${j.id}-character.jpg`;
     if(!validMedia(bytes,'image/jpeg'))throw new AnimationError('ANIM_INVALID_PROVIDER_FILE');
     store.check(await store.bucket.upload(path,bytes,{contentType:'image/jpeg',upsert:true}));
     await patch({status:'submitting_video',character_path:path});
     if(!await store.one('animation_media',{path}))await store.insert('animation_media',{user_id:j.user_id,path,mime:'image/jpeg',bytes:bytes.length,title:j.title,world:j.world,format:j.format,kind:'character',ready:true});
     let submitted;try{submitted=await provider.submitVideo(j,await store.sign(path,1800),await store.sign(photo.path,1800),setting);}catch{await release({status:'review',error:'ANIM_SUBMISSION_UNCERTAIN'});return {review:true};}
     await release({status:'video_queued',video_request:submitted.request_id});return {status:'processing'};
    }
    // Saving is retryable without a second provider generation.
    await patch({status:'saving'});j.status='saving';
   }
   if(j.status==='saving'){
    const data=await provider.result(j.video_model,j.video_request),bytes=await provider.download(data.video?.url,'video/mp4',104857600);
    if(!validMedia(bytes,'video/mp4'))throw new AnimationError('ANIM_INVALID_PROVIDER_FILE');
    const path=`${j.user_id}/${j.id}.mp4`;store.check(await store.bucket.upload(path,bytes,{contentType:'video/mp4',upsert:true}));
    let media=await store.one('animation_media',{path});if(!media)media=await store.insert('animation_media',{user_id:j.user_id,path,mime:'video/mp4',bytes:bytes.length,title:j.title,world:j.world,format:j.format,kind:'generated',ready:true});
    await store.rpc('animation_settle',{p_job:j.id,p_success:true,p_result:media.id});return {status:'completed'};
   }
  }catch(e){
   if(e instanceof AnimationError&&['ANIM_CONTENT_REJECTED','ANIM_PHOTO_REMOVED','ANIM_INVALID_PROVIDER_FILE'].includes(e.code)||[400,422].includes(e.status)){
    await store.rpc('animation_settle',{p_job:j.id,p_success:false,p_error:e.code||'ANIM_PROVIDER_REJECTED'});return {status:'failed'};
   }
   // Transient status/storage errors retain the same provider request and credits.
   await release({error:'ANIM_TEMPORARY_ERROR',next_poll_at:new Date(Date.now()+30000).toISOString()});return {retry:true};
  }
  return {idle:true};
 }
 async function saveRule(user,body){
  const clip=await owned('animation_media',body.clip,user);if(!clip.ready||clip.deleted||clip.mime!=='video/mp4'||!['gift','user','threshold','manual'].includes(body.type)||!Number.isSafeInteger(body.threshold)||body.threshold<1||body.threshold>1000000)fail('ANIM_INVALID');
  const username=clean(body.username,30).replace(/^@/,'');if(body.type==='user'&&!/^[\w.]{2,30}$/.test(username))fail('ANIM_INVALID');
  const row={clip:clip.id,type:body.type,gift:clean(body.gift,100),username,threshold:body.threshold,enabled:body.enabled!==false};if(body.type==='gift'&&!row.gift)fail('ANIM_INVALID');
  if(body.id){await owned('animation_rules',body.id,user);await store.update('animation_rules',{id:body.id,user_id:user.id},row);}else{if((await store.list('animation_rules',{user_id:user.id},40)).length>=40)fail('ANIM_RULE_LIMIT');await store.insert('animation_rules',{...row,user_id:user.id});}return {saved:true};
 }
 async function events(user,body,activeRules=null){
  if(body.manual){const clip=await owned('animation_media',body.clip,user);return {queued:await store.rpc('animation_enqueue',{p_user:user.id,p_event:'manual:'+requireUUID(body.requestId),p_clips:[clip.id]})};}
  const event=body.event;if(!event||event.type!=='gift'||event.demo===true||!event.eventId||!Number.isFinite(event.timestamp)||Math.abs(Date.now()-event.timestamp)>120000)fail('ANIM_INVALID_EVENT');
  const rules=activeRules||await store.list('animation_rules',{user_id:user.id,enabled:true},40);
  const clips=rules.filter(r=>matchesAnimationRule(r,event)).map(r=>r.clip);
  return {queued:clips.length?await store.rpc('animation_enqueue',{p_user:user.id,p_event:'live:'+clean(event.eventId,120),p_clips:[...new Set(clips)]}):0};
 }
 async function overlay(body){
  if(typeof body.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.token))fail('ANIM_OVERLAY_UNAUTHORIZED',401);
  const token=await store.one('animation_overlay_tokens',{token_hash:digest(body.token)});if(!token||Date.parse(token.expires_at)<=Date.now())fail('ANIM_OVERLAY_UNAUTHORIZED',401);
  if(!await store.rpc('animation_rate_limit',{p_key:'overlay:'+token.user_id,p_limit:100}))fail('ANIM_RATE_LIMIT',429);
  const q=await store.rpc('animation_overlay_next',{p_user:token.user_id,p_ack:body.ack??null,p_lease:body.lease??null,p_error:body.error===true});
  if(!q)return {clip:null};const media=await store.one('animation_media',{id:q.clip,user_id:token.user_id,deleted:false,ready:true});if(!media)return {clip:null};
  return {clip:{id:q.id,lease:q.lease,url:await store.sign(media.path,240),title:media.title,format:media.format}};
 }
 async function adminState(user){
  await store.admin(user);const settings=await config(),jobs=(await store.list('animation_jobs',{},100)).filter(j=>['moderation','review','failed'].includes(j.status));
  return {settings,jobs:await Promise.all(jobs.map(async j=>{const photo=await store.one('animation_media',{id:j.photo_id}),world=await store.one('animation_universes',{id:j.world});return {id:j.id,user:j.user_id,prompt:j.prompt,world:world?.description,tier:j.tier,consent_at:j.consent_at,title:j.title,status:j.status,error:j.error,photo:photo&&!photo.deleted?await store.sign(photo.path):null};})),approved,providerReady:provider.ready};
 }
 async function adminSave(user,body){
  await store.admin(user);const cfg=validateAnimationConfig(body.config);
  // Saving cannot itself authorize spending or switch Stripe into live mode.
  if(cfg.enabled){
   if(cfg.testMode&&cfg.testCommerce){
    if(!testGenerationProfitable(cfg))fail('ANIM_MARGIN_TOO_LOW');
   }else{
   const cost=Math.max(cfg.standardUsdMicros/cfg.standardCredits,cfg.premiumUsdMicros/cfg.premiumCredits),f=cfg.finance;
   if(!f.usdToCurrency||f.minimumMarginBps===null)fail('ANIM_PRICING_REQUIRED');
   const settings=await store.one('site_settings',{singleton:true});
   const currencies=new Set([...cfg.packages.filter(p=>p.enabled).map(p=>p.currency),...(settings?.published?.plans||[]).filter(p=>p.id!=='free'&&cfg.monthlyCredits[p.id]>0).map(p=>p.currency?.toLowerCase())]);if(currencies.size>1)fail('ANIM_CURRENCY_MISMATCH');
   const offers=[...cfg.packages.filter(p=>p.enabled).map(p=>({grossCents:p.amount,creditCount:p.credits})),...(settings?.published?.plans||[]).filter(p=>p.id!=='free'&&cfg.monthlyCredits[p.id]>0).map(p=>({grossCents:p.priceCents,creditCount:cfg.monthlyCredits[p.id]}))];
   for(const offer of offers)if(!profitability({...f,...offer,costUsdMicros:cost}).acceptable)fail('ANIM_MARGIN_TOO_LOW');
   }
  }
  const rows=await store.update('animation_settings',{singleton:true,revision:body.revision},{config:cfg,revision:body.revision+1,updated_at:new Date().toISOString()});if(!rows.length)fail('ANIM_CONFIG_CONFLICT',409);return {saved:true};
 }
 async function command(user,body){
  switch(body.action){
   case 'state':return state(user);
   case 'upload':return upload(user,body);
   case 'confirmUpload':return confirmUpload(user,body);
   case 'generate':return generate(user,body);
   case 'cancelJob':{await store.rpc('animation_review_job',{p_job:requireUUID(body.id),p_user:user.id,p_approve:false,p_actor:null});return {cancelled:true};}
   case 'tick':return processOne(user.id);
   case 'saveRule':return saveRule(user,body);
   case 'deleteRule':await owned('animation_rules',body.id,user);await store.remove('animation_rules',{id:body.id,user_id:user.id});return {deleted:true};
   case 'event':return events(user,body);
   case 'eventConfig':return {rules:await store.list('animation_rules',{user_id:user.id,enabled:true},40)};
   case 'eventBatch':{
    if(!Array.isArray(body.events)||body.events.length>20)fail('ANIM_INVALID');const rules=await store.list('animation_rules',{user_id:user.id,enabled:true},40);let queued=0;
    for(const event of body.events){try{queued+=(await events(user,{event},rules)).queued;}catch(e){if((e.code||e.message)?.includes('ANIM_QUEUE_FULL'))break;throw e;}}
    return {queued};
   }
   case 'download':{const media=await owned('animation_media',body.id,user);if(media.deleted||!media.ready)fail('ANIM_NOT_FOUND');const ext=media.mime==='video/mp4'?'mp4':media.mime==='image/jpeg'?'jpg':media.mime==='image/png'?'png':'webp';return {url:await store.sign(media.path,120,media.title+'.'+ext)};}
   case 'fan':{await owned('animation_media',body.id,user);const fan=clean(body.fan,30).replace(/^@/,'');if(fan&&!/^[\w.]{2,30}$/.test(fan))fail('ANIM_INVALID');await store.update('animation_media',{id:body.id,user_id:user.id},{fan});return {saved:true};}
   case 'deleteMedia':{
    const media=await owned('animation_media',body.id,user),jobs=await store.list('animation_jobs',{user_id:user.id,photo_id:media.id},40);if(jobs.some(j=>!j.settled))fail('ANIM_MEDIA_IN_USE');
    if(media.kind==='character'&&(await store.list('animation_jobs',{user_id:user.id,character_path:media.path},40)).some(j=>!j.settled))fail('ANIM_MEDIA_IN_USE');
    store.check(await store.bucket.remove([media.path]));await store.update('animation_media',{id:media.id,user_id:user.id},{deleted:true});await store.remove('animation_rules',{clip:media.id,user_id:user.id});return {deleted:true};
   }
   case 'createWorld':{
    if(!WORLD_PROMPTS[body.base]||!clean(body.name,50)||!clean(body.description,400))fail('ANIM_INVALID');
    const worlds=await store.list('animation_universes',{user_id:user.id},16);if(worlds.length>=16)fail('ANIM_WORLD_LIMIT');return store.insert('animation_universes',{id:'custom-'+randomUUID(),user_id:user.id,name:clean(body.name,50),description:clean(body.description,400),base:body.base});
   }
   case 'overlayToken':{
    const token=randomBytes(32).toString('base64url');await store.remove('animation_overlay_tokens',{user_id:user.id});await store.insert('animation_overlay_tokens',{user_id:user.id,token_hash:digest(token),expires_at:new Date(Date.now()+30*86400000).toISOString()});return {url:origin+'/animation-overlay.html#'+token};
   }
   case 'revokeOverlay':await store.remove('animation_overlay_tokens',{user_id:user.id});return {revoked:true};
   case 'clearQueue':await store.update('animation_playback',{user_id:user.id,status:'queued'},{status:'done'});return {cleared:true};
   case 'deleteData':{
    if(body.confirm!==true)fail('ANIM_INVALID');const paths=await store.rpc('animation_erase_data',{p_user:user.id});let pendingCleanup=false;
    for(let i=0;i<paths.length;i+=100){try{store.check(await store.bucket.remove(paths.slice(i,i+100)));}catch{pendingCleanup=true;}}
    return {deleted:true,pendingCleanup};
   }
   case 'checkout':{
    const {config:cfg}=await config();if(!stripe)fail('ANIM_CHECKOUT_UNAVAILABLE',503);
    if(cfg.testMode&&cfg.testCommerce)return stripe.commerce.create(user,{...body,kind:'topup',offer:body.packageId});
    return stripe.create(user,body);
   }
   case 'testSubscription':if(!stripe?.commerce)fail('ANIM_CHECKOUT_UNAVAILABLE');return stripe.commerce.create(user,{...body,kind:'subscription',offer:body.plan});
   case 'financeState':return finance.state(user,body);
   case 'financeSave':return finance.save(user,body);
   case 'financeValidatePrices':return finance.validatePrices(user,body);
   case 'financeSyncCosts':return finance.syncCosts(user,body);
   case 'adminState':return adminState(user);
   case 'adminSave':return adminSave(user,body);
   case 'moderate':{
    await store.admin(user);const job=await store.one('animation_jobs',{id:requireUUID(body.id)});if(!job||job.status!=='moderation')fail('ANIM_INVALID');
    await store.rpc('animation_review_job',{p_job:job.id,p_user:job.user_id,p_approve:body.approve===true,p_actor:user.id});return {saved:true};
   }
   case 'resolve':{
    await store.admin(user);const job=await store.one('animation_jobs',{id:requireUUID(body.id)});if(!job||job.status!=='review')fail('ANIM_INVALID');
    // Reconcile an uncertain submit against fal dashboard; never retry it here.
    await store.rpc('animation_settle',{p_job:job.id,p_success:false,p_error:'ANIM_ADMIN_REFUNDED'});return {saved:true};
   }
   default:fail('ANIM_INVALID');
  }
 }
 function verifyCron(header){if(!cronSecret||!header)return false;const supplied=Buffer.from(header),expected=Buffer.from('Bearer '+cronSecret);return supplied.length===expected.length&&timingSafeEqual(supplied,expected);}
 return {ready:store.ready,origin,authenticate:store.authenticate,command,overlay,processOne,verifyCron};
}
