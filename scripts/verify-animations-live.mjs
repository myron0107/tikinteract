import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createAnimationFixture} from '../tests/helpers/animations-fixture.mjs';
import {createAnimationService} from '../lib/animations-service.js';
import {handleAnimationRequest} from '../lib/animations-http.js';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
import {DEFAULT_CONFIG} from '../assets/platform-schema.js';
const origin='http://127.0.0.1:3031',folder='.tools/animations-live-review',f=await createAnimationFixture({origin});await f.grant(300);
const service=createAnimationService({store:f.store,provider:f.provider,approved:true,siteUrl:origin,stripe:{ready:true,create:async()=>({status:'pending'})}});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,origin);if(u.pathname==='/__upload'){const chunks=[];for await(const chunk of req)chunks.push(chunk);f.files.set(u.searchParams.get('path'),Buffer.concat(chunks));res.writeHead(200,{'Content-Type':'application/json'}).end('{}');return;}
  if(u.pathname==='/__media'){const bytes=f.files.get(u.searchParams.get('path'));if(!bytes){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':u.searchParams.get('path').endsWith('.mp4')?'video/mp4':'image/jpeg'}).end(bytes);return;}
  if(u.pathname.startsWith('/api/animations')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const r=await handleAnimationRequest(new Request(u,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),{service,store:f.store});res.writeHead(r.status,Object.fromEntries(r.headers)).end(await r.text());return;}
  const file=path.resolve('.','.'+decodeURIComponent(u.pathname));if(!file.startsWith(path.resolve('.')+path.sep)){res.writeHead(403).end();return;}const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);
 }catch(e){res.writeHead(500).end(String(e.message));}
});await new Promise(r=>server.listen(3031,'127.0.0.1',r));await mkdir(folder,{recursive:true});
const b=await openSkyShiftBrowser('animations-live-review'),run=e=>b.evaluate(e),click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);let overlayUrl;
try{
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);'+`
 const c=window.supabase.createClient(),r=c.rpc.bind(c);c.auth.getUser=async()=>({data:{user:{id:'local-layout-test',email:'fixture@example.invalid'}},error:null});
 c.rpc=async(n,...a)=>n==='get_my_account_status'?{data:{allowed:true,state:'active'},error:null}:n==='get_my_access'?{data:{plan:'free',periods:[],serverNow:new Date().toISOString()},error:null}:n==='get_site_admin_state'?{data:{role:'owner',draft:${JSON.stringify(DEFAULT_CONFIG)},revision:0,publishedRevision:0,history:[]},error:null}:r(n,...a);
 c.storage={from:()=>({uploadToSignedUrl:async(path,token,file)=>{await fetch('/__upload?path='+encodeURIComponent(path),{method:'POST',body:file});return {error:null};}})};
 const fetchOriginal=window.fetch.bind(window);window.fetch=(u,o)=>String(u).includes('/rpc/get_site_public_config')?Promise.resolve(Response.json({})):fetchOriginal(u,o);
 `});
 for(const [width,mode,theme,language] of [[1440,'dark','burgundy','ro'],[1440,'light','blue','en'],[390,'dark','blue','en'],[390,'light','burgundy','ro']]){
  const seed=await b.page('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('tikinteract_mode',${JSON.stringify(mode)});localStorage.setItem('tikinteract_brand',${JSON.stringify(theme)});localStorage.setItem('tikinteract_language',${JSON.stringify(language)});`});
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});await b.page('Page.navigate',{url:origin+'/live-studio.html?workspace=ai'});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"');await run('setLiveStudioTab("animations")');await b.waitFor('!!document.querySelector("#an-prompt")');
  assert.equal(await run('document.getElementById("live-game-frame").getAttribute("src")'),null);assert.equal(await run('document.documentElement.scrollWidth<=innerWidth+1'),true);
  await b.screenshot(`${folder}/generator-${width}-${mode}-${theme}.webp`);
  await click('[data-an-tab=universes]');assert.equal(await run('document.querySelectorAll("[data-an-world]").length'),8);await click('[data-an-world=cyberpunk]');await click('[data-an-action=use-world]');
  if(width===1440&&mode==='dark'){
   const doc=await b.page('DOM.getDocument'),el=await b.page('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#an-photo'});await b.page('DOM.setFileInputFiles',{nodeId:el.nodeId,files:[path.resolve('assets/animations-demo/vampire.jpg')]});await b.waitFor('!!document.querySelector(".an-upload img")');
   await run(`document.getElementById('an-prompt').value='The character waves to the live audience';document.getElementById('an-prompt').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('an-consent').click();document.querySelector('[data-an-form=generate]').requestSubmit()`);await b.waitFor('document.querySelector(".an-preview-meta")?.textContent.includes("Așteaptă aprobarea")');
   assert.equal(f.calls.length,0);const job=(await f.store.list('animation_jobs',{},1))[0];await service.command(f.user,{action:'moderate',id:job.id,approve:true});
   for(let i=0;i<3;i++){await f.db.exec('update public.animation_jobs set next_poll_at=now()');await service.processOne();}
   await click('[data-an-action=refresh]');await b.waitFor('!!document.querySelector("#an-generator-video")');assert.equal(f.calls.length,2);
  }
  await click('[data-an-tab=library]');await b.waitFor('!!document.querySelector("[data-an-action=preview]")');await click('[data-an-action=preview]');await b.waitFor('document.querySelector(".an-dialog video")?.readyState>=2');await click('[data-an-close]');
  await click('[data-an-action=fan]');await run(`document.querySelector('.an-dialog input[name=fan]').value='@local_fan';document.querySelector('.an-dialog form').requestSubmit()`);await b.waitFor('!document.querySelector(".an-dialog").open');
  await run('TikInteractWorkspaces.open("live",{tab:"animations"})');await b.waitFor('!!document.querySelector("[data-an-tab=events]")');await click('[data-an-tab=events]');await click('[data-an-action=new-rule]');await run(`document.querySelector('.an-dialog input[name=gift]').value='5655';document.querySelector('.an-dialog form').requestSubmit()`);await b.waitFor('!document.querySelector(".an-dialog").open');assert(await run('!!document.querySelector(".an-rule")'));
  await b.screenshot(`${folder}/events-${width}-${mode}-${theme}.webp`);await click('[data-an-action=overlay]');await b.waitFor('!!document.getElementById("an-overlay-url")');overlayUrl=await run('document.getElementById("an-overlay-url").value');assert(overlayUrl.includes('animation-overlay.html#'));await click('[data-an-close]');
  assert.equal(await run('document.documentElement.scrollWidth<=innerWidth+1'),true);await b.page('Page.removeScriptToEvaluateOnNewDocument',{identifier:seed.identifier});
 }
 const clip=(await service.command(f.user,{action:'state'})).library.find(c=>c.mime==='video/mp4');await service.command(f.user,{action:'event',manual:true,clip:clip.id,requestId:crypto.randomUUID()});
 await b.page('Page.navigate',{url:overlayUrl});await b.waitFor('!!document.getElementById("animation")?.dataset.playing||document.getElementById("animation")?.dataset.playing===""');
 await run('document.getElementById("animation").dispatchEvent(new Event("ended"))');await new Promise(r=>setTimeout(r,500));assert.equal((await f.store.list('animation_playback',{},1))[0].status,'done');
 await b.page('Page.navigate',{url:origin+'/admin.html'});await b.waitFor('!!document.getElementById("admin-app")&&!document.getElementById("admin-app").hidden');await click('[data-admin-tab=animations]');await b.waitFor('!!document.querySelector("[data-animation-config]")');await b.screenshot(folder+'/admin.webp');
 await run('document.querySelector("input[name=enabled]").checked=false;document.querySelector("[data-animation-config]").requestSubmit()');await b.waitFor('!!document.querySelector("[data-animation-config]")&&!document.querySelector("input[name=enabled]").checked');
 for(let i=0;i<30&&(await f.store.one('animation_settings',{singleton:true})).revision===0;i++)await new Promise(r=>setTimeout(r,100));assert.equal((await f.store.one('animation_settings',{singleton:true})).config.enabled,false);
 assert.deepEqual(b.errors,[]);console.log('Real animations UI + local PostgreSQL/storage/provider fixture passed: shared AI/LIVE workspaces, RO/EN, four theme combinations, desktop/mobile, photo consent/upload, moderation→image→video→private library, playback/fan/rules/OBS link and Admin settings. No real AI, payments, Supabase or LIVE connection used.');
}catch(e){await b.screenshot(folder+'/failure.webp');console.log(b.errors);throw e;}finally{await b.close();await new Promise(r=>server.close(r));await f.db.close();}
