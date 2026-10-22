import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAdminQABridge} from '../scripts/qa-admin-database.mjs';
import {createMaintenanceService,digest,readPreviewCookie} from '../lib/maintenance-service.js';
import {handleMaintenanceRequest} from '../lib/maintenance-http.js';
import {routeMaintenance} from '../middleware.js';

test('concurrent gate checks share a request but never cache a previous allow decision',async()=>{
 let calls=0,enabled=false;
 const service=createMaintenanceService({serviceKey:'test-only',fetchImpl:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return Response.json({enabled,valid:false,allowed:!enabled});}});
 const request=new Request('https://site.example');
 await Promise.all([service.gate(request),service.gate(request),service.gate(request)]);assert.equal(calls,1);
 enabled=true;assert.equal((await service.gate(request)).allowed,false);assert.equal(calls,2);
});

test('maintenance invites use real temporary accounts, are single-use, expire and revoke without changing normal accounts',async()=>{
 const bridge=await createAdminQABridge('http://127.0.0.1');const {db,ids}=bridge;
 const users=new Map(),ownerToken='owner.'+'x'.repeat(30),visitorToken='visitor.'+'x'.repeat(30),key='server-only-key';
 let queue=Promise.resolve();
 async function as(role,user,fn){const run=async()=>{await db.exec(`reset role;set request.jwt.claim.sub='${user||''}';set role ${role}`);try{return await fn();}finally{await db.exec('reset role');}};const result=queue.then(run,run);queue=result.catch(()=>{});return result;}
 try{
  await db.exec('create role service_role;create table public.preview_rls_test(id integer);insert into public.preview_rls_test values(1);alter table public.preview_rls_test enable row level security;grant select on public.preview_rls_test to authenticated;create policy readable on public.preview_rls_test for select to authenticated using(true);');
  const sql=await readFile(new URL('../supabase/maintenance.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  assert.equal((await db.query('select enabled from public.site_maintenance_settings')).rows[0].enabled,false,'installation itself keeps the existing public site available');
  await as('authenticated',ids.owner,()=>db.query('select public.set_site_maintenance(true)'));
  const fetchImpl=async(url,options)=>{
   const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):{},token=options.headers.Authorization.slice(7);
   try{
    if(path.startsWith('/rest/v1/rpc/')){
     const name=path.split('/').pop();assert(/^[a-z_]+$/.test(name));
     if(![key,ownerToken,visitorToken].includes(token))return Response.json({message:'unauthorized'},{status:401});
     const args=Object.entries(body);for(const [name]of args)assert(/^p_[a-z_]+$/.test(name));
     const result=await as(token===key?'service_role':'authenticated',token===ownerToken?ids.owner:token===visitorToken?ids.visitor:'',()=>db.query(`select public.${name}(${args.map(([name],i)=>`${name}=>$${i+1}`).join(',')}) as value`,args.map(([,value])=>value)));
     return Response.json(result.rows[0].value??null);
    }
    if(path==='/auth/v1/admin/users'&&options.method==='POST'){
     assert.equal(token,key);const id=crypto.randomUUID();users.set(id,{id,email:body.email,app_metadata:body.app_metadata});
     await as('postgres','',()=>db.query('insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,now(),$3)',[id,body.email,JSON.stringify(body.app_metadata)]));
     return Response.json(users.get(id));
    }
    if(path.startsWith('/auth/v1/admin/users/')){
     assert.equal(token,key);const id=path.split('/').pop();
     if(options.method==='DELETE'){users.delete(id);await as('postgres','',()=>db.query('delete from auth.users where id=$1',[id]));return Response.json({});}
     return Response.json(users.get(id));
    }
    if(path==='/auth/v1/admin/generate_link'){assert.equal(token,key);const user=[...users.values()].find(u=>u.email===body.email);return Response.json({hashed_token:user.id});}
    if(path==='/auth/v1/verify'){assert.equal(body.type,'magiclink');const user=users.get(body.token_hash);return Response.json({access_token:'guest.'+'x'.repeat(32),refresh_token:'refresh.'+'x'.repeat(32),user});}
    throw Error('Unexpected URL '+path);
   }catch(error){return Response.json({message:error.message},{status:error.code==='42501'?403:400});}
  };
  const service=createMaintenanceService({url:'https://auth.example.invalid',anonKey:'anon',serviceKey:key,fetchImpl});
  const request=(action,body={},token,cookie,origin='https://site.example')=>new Request('https://site.example/api/maintenance',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({action,...body})});
  const call=(action,body={},token,cookie,origin)=>handleMaintenanceRequest(request(action,body,token,cookie,origin),{service,clientId:'test-client'});
  assert.equal((await call('admin',{},visitorToken)).status,403);
  assert.equal((await call('admin')).status,403);
  assert.equal((await call('redeem',{code:'anything'},null,null,'https://other.example')).status,403);
  let response=await call('owner',{},ownerToken);assert.equal(response.status,200);const ownerCookie=response.headers.get('set-cookie').split(';')[0];assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);assert.match(response.headers.get('set-cookie'),/; Secure/);
  assert.equal((await service.gate(new Request('https://site.example',{headers:{Cookie:ownerCookie}}))).valid,true);
  assert.equal((await service.gate(new Request('https://site.example'))).allowed,false);
  response=await call('create',{label:'Preview tester',hours:3,plan:'play_pass_pro',redeemDays:7},ownerToken);assert.equal(response.status,200);const invite=await response.json();assert.match(invite.code,/^TI-PREVIEW-[A-F0-9-]+$/);
  response=await call('redeem',{code:invite.code});assert.equal(response.status,200);const guestCookie=response.headers.get('set-cookie').split(';')[0],lease=await response.json();assert(lease.session.access_token);assert(!JSON.stringify(lease).includes(key));
  const guestId=[...users.keys()][0];assert.equal(users.get(guestId).app_metadata.site_preview,true);
  response=await call('redeem',{code:invite.code});assert.equal(response.status,400);assert.equal(users.size,1,'a used code must not create another account');
  assert.equal((await service.gate(new Request('https://site.example/live-studio.html',{headers:{Cookie:guestCookie}}))).valid,true);
  response=await call('resume',{},null,guestCookie);assert.equal(response.status,200);assert((await response.json()).session.access_token);
  assert.equal((await call('resume')).status,403);
  const access=await as('authenticated',guestId,()=>db.query('select public.get_my_access() as value'));assert.equal(access.rows[0].value.plan,'play_pass_pro');
  assert.equal((await as('authenticated',guestId,()=>db.query('select * from public.preview_rls_test'))).rows.length,1);
  await assert.rejects(as('authenticated',guestId,()=>db.query('select public.get_site_maintenance_state()')),/OWNER_REQUIRED/);
  await assert.rejects(as('anon','',()=>db.query("select public.reserve_site_preview('x','x','x')")),/permission denied/);
  const snapshot=await(await call('admin',{},ownerToken)).json();assert.equal(snapshot.invites.length,1);assert(!JSON.stringify(snapshot).includes(await digest(invite.code)));
  await as('postgres','',()=>db.query("update public.site_preview_guests set expires_at=now()-interval '1 second' where user_id=$1",[guestId]));
  assert.equal((await service.gate(new Request('https://site.example',{headers:{Cookie:guestCookie}}))).valid,false);
  await assert.rejects(as('authenticated',guestId,()=>db.query('select public.get_my_access()')),/ACCOUNT_UNAVAILABLE/);
  assert.equal((await as('authenticated',guestId,()=>db.query('select * from public.preview_rls_test'))).rows.length,0);
  await as('postgres','',()=>db.query("update public.site_preview_guests set expires_at=now()+interval '1 hour' where user_id=$1",[guestId]));
  response=await call('revoke',{id:invite.id},ownerToken);assert.equal(response.status,200);assert.equal((await service.gate(new Request('https://site.example',{headers:{Cookie:guestCookie}}))).valid,false);
  assert.equal((await call('resume',{},null,guestCookie)).status,403);
  const other=await(await call('create',{label:'Second tester',hours:1,plan:'free',redeemDays:1},ownerToken)).json();
  response=await call('redeem',{code:other.code});assert.equal(response.status,200);const otherCookie=response.headers.get('set-cookie').split(';')[0];
  response=await call('logout',{},null,otherCookie);assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await service.gate(new Request('https://site.example',{headers:{Cookie:otherCookie}}))).valid,false);
  const invalidHash='a'.repeat(64);let limit;
  for(let n=0;n<11;n++)limit=await service.rpc('reserve_site_preview',{p_code_hash:invalidHash,p_claim_hash:'b'.repeat(64),p_client_hash:'c'.repeat(64)});
  assert.equal(limit.code,'RATE_LIMIT');
  response=await call('toggle',{enabled:false},ownerToken);assert.equal(response.status,200);assert.equal((await service.gate(new Request('https://site.example'))).allowed,true);
  const normal=await as('authenticated',ids.visitor,()=>db.query('select public.get_my_access() as value'));assert.equal(normal.rows[0].value.plan,'free');
  assert.equal((await db.query('select count(*)::int as n from auth.users where id in($1,$2)',[ids.owner,ids.visitor])).rows[0].n,2);
 }finally{await bridge.close();}
});

test('routing gate covers every page and game asset, rejects forged cookies and fails closed on outages',async()=>{
 const closed={gate:async()=>({enabled:true,allowed:false})},open={gate:async()=>({enabled:false,allowed:true})},authorized={gate:async()=>({enabled:true,allowed:true})};
 for(const path of['/','/index.html','/live-studio.html','/admin.html','/GAME/NOVA-VEX/Neon-Ascent.html','/GAME/MOTO-INTERACT/src/main.js','/assets/site-app.js']){
  const request=new Request('https://site.example'+path,{headers:{Accept:'text/html',Cookie:'__Host-tikinteract-preview=forged'}});
  const response=await routeMaintenance(request,closed);assert.equal(response.status,503);assert.match(response.headers.get('x-middleware-rewrite'),/maintenance.html/);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal((await routeMaintenance(request,open)).headers.get('x-middleware-next'),'1');
  assert.equal((await routeMaintenance(request,authorized)).headers.get('cache-control'),'private, no-store, max-age=0');
 }
 const asset=await routeMaintenance(new Request('https://site.example/assets/private.js'),closed);assert.equal(asset.status,503);assert.equal(asset.headers.get('x-middleware-rewrite'),null);
 const fail=await routeMaintenance(new Request('https://site.example/live-studio.html',{headers:{Accept:'text/html'}}),{gate:async()=>{throw Error('offline');}});assert.equal(fail.status,503);
 for(const path of['/maintenance.html','/assets/maintenance.js','/assets/fonts/inter-latin.woff2','/api/maintenance'])assert.equal((await routeMaintenance(new Request('https://site.example'+path),closed)).headers.get('x-middleware-next'),'1');
 assert.equal(readPreviewCookie(new Request('https://site.example',{headers:{Cookie:'tikinteract-preview='+'a'.repeat(64)}})),null);
 assert.equal(readPreviewCookie(new Request('https://site.example',{headers:{Cookie:'__Host-tikinteract-preview='+'a'.repeat(64)+'; __Host-tikinteract-preview='+'b'.repeat(64)}})),null);
 assert.equal((await createMaintenanceService({production:true}).gate(new Request('https://site.example'))).allowed,false);
});
