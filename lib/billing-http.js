import {billingService,BillingError} from './billing-service.js';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export async function handleBillingRequest(request,{service=billingService}={}){
 try{
  const url=new URL(request.url),webhook=url.pathname==='/api/billing/webhook';
  if(!webhook&&request.method==='GET'&&url.searchParams.get('action')==='config')return json({available:service.ready,test:!service.live});
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  if(!webhook&&request.headers.get('origin')!==service.origin)return json({error:'INVALID_ORIGIN'},403);
  const raw=Buffer.from(await request.arrayBuffer());if(raw.length>(webhook?262144:4096))return json({error:'BILLING_INVALID'},413);
  if(webhook)return json(await service.webhook(raw,request.headers.get('stripe-signature')));
  let body;try{body=JSON.parse(raw);}catch{return json({error:'BILLING_INVALID'},400);}
  if(!body||typeof body!=='object')return json({error:'BILLING_INVALID'},400);
  if(body.action==='create')return json(await service.create(request,body));
  if(body.action==='verify')return json(await service.verify(request,body));
  return json({error:'BILLING_INVALID'},400);
 }catch(e){return json({error:e instanceof BillingError?e.code:'BILLING_UNAVAILABLE'},e instanceof BillingError?e.status:503);}
}
export async function nodeBillingHandler(req,res,{service=billingService}={}){
 try{
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>262144){res.writeHead(413,headers).end('{"error":"BILLING_INVALID"}');return;}chunks.push(chunk);}
  const origin=(req.socket?.encrypted||process.env.VERCEL==='1'?'https://':'http://')+req.headers.host;
  const h=new Headers();for(const[k,v]of Object.entries(req.headers))if(v!==undefined)h.set(k,Array.isArray(v)?v.join(','):v);
  const request=new Request(new URL(req.url,origin),{method:req.method,headers:h,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
  const result=await handleBillingRequest(request,{service});res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());
 }catch{res.writeHead(503,headers).end('{"error":"BILLING_UNAVAILABLE"}');}
}
