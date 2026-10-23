import {AnimationError} from './animations-store.js';
import {animationService,animationStore} from './animations-runtime.js';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
export async function handleAnimationRequest(request,{service=animationService,store=animationStore}={}){
 try{
  if(!service.ready)return json({error:'ANIM_SETUP_REQUIRED'},503);
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/animations/worker'){
   if(!['GET','POST'].includes(request.method)||!service.verifyCron(request.headers.get('authorization')))return json({error:'UNAUTHORIZED'},401);
   return json(await service.processOne());
  }
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  // Validate the page against the host actually serving this request. The
  // configured public URL is for canonical links (e.g. Checkout), not a gate
  // that should break Studio on a Vercel deployment or another owned domain.
  if(request.headers.get('origin')!==url.origin)return json({error:'INVALID_ORIGIN'},403);
  const raw=await request.text();if(raw.length>32768)return json({error:'ANIM_INVALID'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'ANIM_INVALID'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'ANIM_INVALID'},400);
  if(path==='/api/animations/overlay'){
   // The capability is scoped to playback, never to auth, credits or generation.
   if(typeof body.token!=='string'||body.token.length!==43)return json({error:'ANIM_OVERLAY_UNAUTHORIZED'},401);
   return json(await service.overlay(body));
  }
  const user=await service.authenticate(request);
  if(!await store.rpc('animation_rate_limit',{p_key:'api:'+user.id,p_limit:90}))return json({error:'ANIM_RATE_LIMIT'},429);
  return json(await service.command(user,body));
 }catch(e){return json({error:e instanceof AnimationError?e.code:'ANIM_UNAVAILABLE'},e instanceof AnimationError?e.status:503);}
}
export async function nodeAnimationHandler(req,res){
 try{
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32768){res.writeHead(413,headers).end('{"error":"ANIM_INVALID"}');return;}chunks.push(chunk);}
  const origin=(req.socket?.encrypted||process.env.VERCEL==='1'?'https://':'http://')+req.headers.host;
  const request=new Request(new URL(req.url,origin),{method:req.method,headers:Object.fromEntries(Object.entries(req.headers).filter(([,v])=>typeof v==='string')),...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
  const result=await handleAnimationRequest(request);res.writeHead(result.status,Object.fromEntries(result.headers)).end(await result.text());
 }catch{res.writeHead(503,headers).end('{"error":"ANIM_UNAVAILABLE"}');}
}
