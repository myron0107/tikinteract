import {MaintenanceError,digest,randomToken,readPreviewCookie,previewCookie,maintenanceService} from './maintenance-service.js';

export const PRIVATE_HEADERS={'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
const publicAssets=new Set([
 '/maintenance.html','/api/maintenance','/api/maintenance/',
 '/assets/maintenance.js','/assets/maintenance.css','/assets/error-page.css',
 '/assets/appearance.js','/assets/appearance.css','/assets/brand.css','/assets/focus.css','/assets/carbon-metal.css',
 '/assets/supabase-config.json','/assets/language-ro.svg','/assets/language-en.svg',
 '/assets/tikinteract-app-icon.svg','/assets/tikinteract-favicon.svg','/assets/fonts/font-faces.css',
 // Payment notifications must arrive during maintenance; the handler verifies Stripe signatures.
 '/api/billing/webhook'
]);
export function isMaintenancePublic(path){return publicAssets.has(path)||/^\/assets\/fonts\/[a-z0-9-]+\.woff2$/.test(path);}
export function safePreviewDestination(value){
 try{const url=new URL(value||'/index.html','https://preview.invalid');if(url.origin!=='https://preview.invalid'||!/^\/(?:index\.html|live-studio\.html|admin\.html)$/.test(url.pathname))return '/index.html';return url.pathname+url.search;}catch{return '/index.html';}
}
function json(data,status=200,cookie){return new Response(JSON.stringify(data),{status,headers:{...PRIVATE_HEADERS,'Content-Type':'application/json; charset=utf-8',...(cookie?{'Set-Cookie':cookie}:{})}});}
export async function handleMaintenanceRequest(request,{service=maintenanceService,clientId='unknown'}={}){
 try{
  const url=new URL(request.url);
  if(request.method==='GET'&&url.searchParams.get('action')==='status'){
   const {userId,...status}=await service.gate(request);return json(status);
  }
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  // Cookie operations require a same-origin POST; public GET never consumes codes.
  if(request.headers.get('origin')!==url.origin)return json({error:'INVALID_ORIGIN'},403);
  const text=await request.text();if(text.length>8192)return json({error:'INVALID_REQUEST'},413);
  let body;try{body=JSON.parse(text);}catch{return json({error:'INVALID_REQUEST'},400);}
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,7000})$/)?.[1];
  if(body.action==='redeem'){
   if(typeof body.code!=='string'||body.code.length>100)return json({error:'INVALID_INVITE'},400);
   const {cookie,...result}=await service.redeem(body.code,clientId);
   return json(result,200,previewCookie(request,cookie,result.expiresAt));
  }
  if(body.action==='logout'){
   const cookie=readPreviewCookie(request);
   if(cookie&&service.ready)await service.rpc('close_site_preview_session',{p_token_hash:await digest(cookie)});
   return json({ok:true},200,previewCookie(request,null,null));
  }
  if(body.action==='resume')return json(await service.resume(request));
  if(!token)return json({error:'OWNER_REQUIRED'},403);
  if(body.action==='owner'){
   const {cookie,...result}=await service.ownerSession(token);
   return json(result,200,previewCookie(request,cookie,result.expiresAt));
  }
  if(body.action==='admin')return json(await service.rpc('get_site_maintenance_state',{},token));
  if(body.action==='toggle'){
   if(typeof body.enabled!=='boolean')return json({error:'INVALID_OPTIONS'},400);
   // Establish the owner's bypass BEFORE enabling maintenance to prevent lockout.
   const {cookie,expiresAt}=await service.ownerSession(token);
   return json(await service.rpc('set_site_maintenance',{p_enabled:body.enabled},token),200,previewCookie(request,cookie,expiresAt));
  }
  if(body.action==='create'){
   const raw=randomToken(16).toUpperCase(),code='TI-PREVIEW-'+raw.match(/.{8}/g).join('-');
   const id=await service.rpc('create_site_preview_invite',{p_code_hash:await digest(code),p_label:body.label,p_hours:body.hours,p_plan:body.plan,p_redeem_days:body.redeemDays},token);
   return json({id,code});
  }
  if(body.action==='revoke'){
   if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return json({error:'INVALID_OPTIONS'},400);
   await service.rpc('revoke_site_preview_invite',{p_invite:body.id},token);return json({ok:true});
  }
  return json({error:'INVALID_REQUEST'},400);
 }catch(error){return json({error:error instanceof MaintenanceError?error.code:'SERVICE_UNAVAILABLE'},error instanceof MaintenanceError?error.status:503);}
}

export async function nodeMaintenanceHandler(req,res,{service=maintenanceService}={}){
 try{
  const secure=process.env.VERCEL==='1'||req.socket?.encrypted;
  const origin=(secure?'https://':'http://')+req.headers.host;
  let body;
  if(req.method==='POST'){
   if(req.body!==undefined)body=typeof req.body==='string'?req.body:JSON.stringify(req.body);
   else{const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413,PRIVATE_HEADERS).end();return;}parts.push(chunk);}body=Buffer.concat(parts).toString('utf8');}
  }
  const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
  const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(body!==undefined?{body}:{})});
  const clientId=process.env.VERCEL==='1'?String(req.headers['x-vercel-forwarded-for']||req.headers['x-real-ip']||'shared'):req.socket?.remoteAddress||'local';
  const response=await handleMaintenanceRequest(request,{service,clientId});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
 }catch{res.writeHead(503,{...PRIVATE_HEADERS,'Content-Type':'application/json'}).end('{"error":"SERVICE_UNAVAILABLE"}');}
}
