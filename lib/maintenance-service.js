// Server-only. Never import this module from browser code.
import publicConfig from '../assets/supabase-config.json' with {type:'json'};

export const PREVIEW_COOKIE='__Host-tikinteract-preview';
export const DEV_PREVIEW_COOKIE='tikinteract-preview';
export class MaintenanceError extends Error {
 constructor(code,status=400){super(code);this.code=code;this.status=status;}
}
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export function randomToken(bytes=32){return Array.from(crypto.getRandomValues(new Uint8Array(bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
export function readPreviewCookie(request){
 const secure=new URL(request.url).protocol==='https:',name=secure?PREVIEW_COOKIE:DEV_PREVIEW_COOKIE;
 const values=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));
 if(values.length!==1)return null;
 const token=values[0].slice(name.length+1);return /^[a-f0-9]{64}$/.test(token)?token:null;
}
export function previewCookie(request,token,expiresAt){
 const secure=new URL(request.url).protocol==='https:',age=token?Math.max(0,Math.floor((Date.parse(expiresAt)-Date.now())/1000)):0;
 return `${secure?PREVIEW_COOKIE:DEV_PREVIEW_COOKIE}=${token||''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
}
export function createMaintenanceService({url=publicConfig.url,anonKey=publicConfig.anonKey,serviceKey='',production=false,fetchImpl=fetch}={}){
 const ready=!!serviceKey;
 async function call(path,body,{token=serviceKey,admin=false,method='POST'}={}){
  if(!ready)throw new MaintenanceError('SETUP_REQUIRED',503);
  let response;
  try{response=await fetchImpl(url+path,{method,headers:{apikey:admin?serviceKey:anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000),cache:'no-store'});}
  catch{throw new MaintenanceError('SERVICE_UNAVAILABLE',503);}
  let data;try{data=await response.json();}catch{data=null;}
  if(!response.ok){
   const message=String(data?.message||data?.msg||'');
   if(message.includes('OWNER_REQUIRED')||response.status===401||response.status===403)throw new MaintenanceError('OWNER_REQUIRED',403);
   if(message.includes('INVALID_INVITE'))throw new MaintenanceError('INVALID_INVITE',400);
   if(message.includes('GENERATION_LIMIT'))throw new MaintenanceError('RATE_LIMIT',429);
   if(message.includes('INVALID_OPTIONS'))throw new MaintenanceError('INVALID_OPTIONS',400);
   throw new MaintenanceError('SERVICE_UNAVAILABLE',503);
  }
  return data;
 }
 const rpc=(name,args={},token)=>call('/rest/v1/rpc/'+name,args,{token:token||serviceKey,admin:!token});
 async function gate(request){
  if(!ready)return {ready:false,enabled:production,allowed:!production,valid:false,kind:null,expiresAt:null};
  const cookie=readPreviewCookie(request);
  const data=await rpc('get_site_preview_gate',{p_token_hash:cookie?await digest(cookie):null});
  if(typeof data?.enabled!=='boolean'||typeof data?.valid!=='boolean')throw new MaintenanceError('SERVICE_UNAVAILABLE',503);
  return {...data,ready:true};
 }
 async function ownerSession(token){
  const cookie=randomToken();
  const data=await rpc('create_site_owner_session',{p_token_hash:await digest(cookie)},token);
  return {...data,cookie};
 }
 async function redeem(code,clientId){
  const claim=randomToken(),claimHash=await digest(claim);
  const reservation=await rpc('reserve_site_preview',{p_code_hash:await digest(String(code).trim().toUpperCase()),p_claim_hash:claimHash,p_client_hash:await digest(clientId)});
  if(!reservation?.ok)throw new MaintenanceError(reservation?.code==='RATE_LIMIT'?'RATE_LIMIT':'INVALID_INVITE',reservation?.code==='RATE_LIMIT'?429:400);
  let userId;
  try{
   const email=`preview.${crypto.randomUUID()}@preview.tikinteract.invalid`;
   const user=await call('/auth/v1/admin/users',{email,email_confirm:true,user_metadata:{display_name:reservation.label},app_metadata:{site_preview:true}},{admin:true});
   userId=user.id||user.user?.id;
   if(!userId)throw new MaintenanceError('SERVICE_UNAVAILABLE',503);
   // Generate and verify a server-side magic token. No email or password is sent.
   const link=await call('/auth/v1/admin/generate_link',{type:'magiclink',email},{admin:true});
   const tokenHash=link.hashed_token||link.properties?.hashed_token;
   if(!tokenHash)throw new MaintenanceError('SERVICE_UNAVAILABLE',503);
   const session=await call('/auth/v1/verify',{type:'magiclink',token_hash:tokenHash},{token:anonKey});
   if(!session?.access_token||!session?.refresh_token||session.user?.id!==userId)throw new MaintenanceError('SERVICE_UNAVAILABLE',503);
   const cookie=randomToken();
   const lease=await rpc('complete_site_preview',{p_invite:reservation.id,p_claim_hash:claimHash,p_user:userId,p_token_hash:await digest(cookie)});
   return {...lease,cookie,session:{access_token:session.access_token,refresh_token:session.refresh_token}};
  }catch(error){
   // Only the identity just created by this request is eligible for cleanup.
   if(userId)try{await call('/auth/v1/admin/users/'+encodeURIComponent(userId),undefined,{admin:true,method:'DELETE'});}catch{}
   try{await rpc('abort_site_preview',{p_invite:reservation.id,p_claim_hash:claimHash});}catch{}
   throw error;
  }
 }
 return {ready,gate,rpc,ownerSession,redeem};
}
export const maintenanceService=createMaintenanceService({serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY||'',production:process.env.VERCEL==='1'||process.env.TIKINTERACT_MAINTENANCE==='1'});
