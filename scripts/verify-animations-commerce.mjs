// UI verification against local PostgreSQL and controlled payment/provider
// fixtures only. No external checkout, Supabase writes or paid AI requests.
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
const origin='http://127.0.0.1:3032',folder='.tools/animations-commerce-review',f=await createAnimationFixture({origin}),checkouts=[];
await f.db.exec(await readFile('supabase/animations-commerce.sql','utf8'));
const stripe={ready:true,commerce:{available:true,create:async(user,body)=>{checkouts.push(body);return {status:'pending',test:true};},validatePrice:async()=>({})}};
const service=createAnimationService({store:f.store,provider:f.provider,approved:false,siteUrl:origin,stripe});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.json':'application/json'};
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,origin);
 if(u.pathname.startsWith('/api/animations')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const r=await handleAnimationRequest(new Request(u,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),{service,store:f.store});res.writeHead(r.status,Object.fromEntries(r.headers)).end(await r.text());return;}
 const file=path.resolve('.','.'+decodeURIComponent(u.pathname));if(!file.startsWith(path.resolve('.')+path.sep)){res.writeHead(403).end();return;}const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);
}catch(e){res.writeHead(500).end(String(e.message));}});await new Promise(r=>server.listen(3032,'127.0.0.1',r));await mkdir(folder,{recursive:true});
const b=await openSkyShiftBrowser('animations-commerce-review'),run=e=>b.evaluate(e),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
try{
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);'+`
 const c=window.supabase.createClient(),r=c.rpc.bind(c);c.auth.getUser=async()=>({data:{user:{id:'local-layout-test',email:'fixture@example.invalid'}},error:null});
 c.rpc=async(n,...a)=>n==='get_my_account_status'?{data:{allowed:true,state:'active'},error:null}:n==='get_my_access'?{data:{plan:'free',periods:[],serverNow:new Date().toISOString()},error:null}:n==='get_site_admin_state'?{data:{role:'owner',draft:${JSON.stringify(DEFAULT_CONFIG)},revision:0,publishedRevision:0,history:[]},error:null}:r(n,...a);
 const fetchOriginal=window.fetch.bind(window);window.fetch=(u,o)=>String(u).includes('/rpc/get_site_public_config')?Promise.resolve(Response.json({})):fetchOriginal(u,o);
 `});
 for(const width of [1440,390])for(const [mode,theme,language] of [['dark','burgundy','ro'],['light','burgundy','en'],['dark','blue','en'],['light','blue','ro']]){
  const seed=await b.page('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('tikinteract_mode','${mode}');localStorage.setItem('tikinteract_brand','${theme}');localStorage.setItem('tikinteract_language','${language}');`});
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
  await b.page('Page.navigate',{url:origin+'/admin.html'});await b.waitFor('!!document.getElementById("admin-app")&&!document.getElementById("admin-app").hidden');await click('[data-admin-tab=finance]');await b.waitFor('!!document.querySelector("[data-finance-form]")');
  assert.equal(await run('document.querySelector("[data-finance=\\"plans.play_pass.amount\\"]").value'),'7.99');
  assert.equal(await run('document.querySelector("[data-finance=\\"premiumCredits\\"]").value'),'200');
  assert.equal(await run('document.documentElement.scrollWidth<=innerWidth+1'),true,'Admin horizontal overflow');
  if(width===1440&&mode==='dark'&&theme==='burgundy'){
   const before=(await f.store.one('animation_settings',{singleton:true})).revision;
   await run(`document.querySelector('[data-finance="plans.play_pass.credits"]').value='301';document.querySelector('[data-finance-form]').requestSubmit()`);
   for(let i=0;i<50&&(await f.store.one('animation_settings',{singleton:true})).revision===before;i++)await new Promise(r=>setTimeout(r,100));
   assert.equal((await f.store.one('animation_settings',{singleton:true})).config.testCommerce.plans.play_pass.credits,301);
   await b.waitFor('!!document.querySelector("[data-finance=\\"plans.play_pass.credits\\"]")');
  }
  await b.screenshot(`${folder}/finance-${width}-${mode}-${theme}.webp`);
  await b.page('Page.navigate',{url:origin+'/live-studio.html?workspace=ai'});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"');await run('setLiveStudioTab("animations")');await b.waitFor('!!document.querySelector("#an-prompt")');
  assert.equal(await run('document.getElementById("live-game-frame").getAttribute("src")'),null,'No game auto-start');assert.equal(await run('document.querySelector("[data-an-form=generate] [type=submit]").disabled'),true,'No paid AI without approval');
  await click('[data-an-action=topup]');await b.waitFor('!!document.querySelector(".an-dialog[open] .an-purchase-options")');
  assert.equal(await run('document.querySelectorAll("[data-an-action=select-package]").length'),3);assert.equal(await run('document.querySelector("[data-an-action=buy-package]").disabled'),true,'Missing Stripe Price ID blocks checkout');
  await click('[data-an-action=select-package][data-id=credits-1100]');assert.equal(await run('document.querySelector("[data-an-action=buy-package]").dataset.id'),'credits-1100');
  await run('document.querySelector(".an-dialog details").open=true');assert.equal(await run('document.querySelectorAll("[data-an-action=buy-test-plan]").length'),2);
  assert.equal(await run('document.documentElement.scrollWidth<=innerWidth+1'),true,'Studio horizontal overflow');
  assert.equal(await run('document.querySelector(".an-dialog").scrollWidth<=document.querySelector(".an-dialog").clientWidth+1'),true,'Credit dialog overflow');
  await b.screenshot(`${folder}/credits-${width}-${mode}-${theme}.webp`);await click('[data-an-close]');await b.page('Page.removeScriptToEvaluateOnNewDocument',{identifier:seed.identifier});
 }
 assert.equal(f.calls.length,0);assert.equal(checkouts.length,0);assert.deepEqual(b.errors,[]);
 console.log('Finance + credit purchase UI passed: RO/EN, Burgundy/Blue × Light/Dark, 1440/390px, settings persistence, package selection, disabled unconfigured checkout, no auto-start and no paid AI.');
}catch(e){await b.screenshot(folder+'/failure.webp');console.log(b.errors);throw e;}finally{await b.close();await new Promise(r=>server.close(r));await f.db.close();}
