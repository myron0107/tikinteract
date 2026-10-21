import {next,rewrite} from '@vercel/functions';
import {maintenanceService} from './lib/maintenance-service.js';
import {isMaintenancePublic,PRIVATE_HEADERS,safePreviewDestination} from './lib/maintenance-http.js';

// No exclusions for games, Studio, static HTML or media: direct URLs are gated.
export const config={runtime:'nodejs',matcher:'/:path*'};
export default async function middleware(request){
 const url=new URL(request.url);
 if(isMaintenancePublic(url.pathname))return next({headers:PRIVATE_HEADERS});
 try{
  const gate=await maintenanceService.gate(request);
  if(gate.allowed)return next({headers:gate.enabled?PRIVATE_HEADERS:{}});
 }catch{/* An unavailable access check must never expose the protected site. */}
 if(request.method==='GET'||request.method==='HEAD'){
  if(request.headers.get('accept')?.includes('text/html')){
   const destination=new URL('/maintenance.html',url);
   destination.searchParams.set('next',safePreviewDestination(url.pathname+url.search));
   return rewrite(destination,{status:503,headers:{...PRIVATE_HEADERS,'Retry-After':'3600'}});
  }
 }
 return new Response(JSON.stringify({error:'MAINTENANCE'}),{status:503,headers:{...PRIVATE_HEADERS,'Content-Type':'application/json','Retry-After':'3600'}});
}
