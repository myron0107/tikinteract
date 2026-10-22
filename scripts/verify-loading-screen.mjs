import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
const origin='http://127.0.0.1:3026',folder='.tools/loading-screen-review';
const server=spawn('python',['-m','http.server','3026','--bind','127.0.0.1'],{windowsHide:true,stdio:'ignore'});await new Promise(r=>setTimeout(r,600));
const b=await openSkyShiftBrowser('loading-screen-review'),run=e=>b.evaluate(e);
try{
 await mkdir(folder,{recursive:true});
 // Delay readiness in the fixture, not the product: check the loading UI while
 // authentication/config/layout are genuinely still pending from its perspective.
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);'+`
  const c=window.supabase.createClient(),r=c.rpc.bind(c);c.rpc=async(n,...a)=>n==='get_my_account_status'?{data:{allowed:true,state:'active'},error:null}:n==='get_my_access'?{data:{plan:'free',periods:[],serverNow:new Date().toISOString()},error:null}:r(n,...a);
  const f=window.fetch.bind(window);window.fetch=(u,o)=>String(u).includes('/rpc/get_site_public_config')?Promise.resolve(Response.json({})):f(u,o);
  const began=performance.now();let startup;
  Object.defineProperty(window,'TikInteractStartup',{configurable:true,get:()=>startup,set:api=>{startup={...api,ready(part){setTimeout(()=>api.ready(part),Math.max(0,2000-(performance.now()-began)))}}}});
 `});
 for(const [width,height,mode,theme,language]of [[1366,768,'dark','burgundy','ro'],[1366,768,'light','burgundy','en'],[390,844,'dark','blue','en'],[390,844,'light','blue','ro']]){
  const seed=await b.page('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('tikinteract_mode',${JSON.stringify(mode)});localStorage.setItem('tikinteract_brand',${JSON.stringify(theme)});localStorage.setItem('tikinteract_language',${JSON.stringify(language)});`});
  await b.page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  for(const path of ['live-studio.html','index.html']){
   await b.page('Page.navigate',{url:origin+'/'+path});
   await b.waitFor('!!document.querySelector("#page-startup-screen")&&document.documentElement.dataset.uiPending!==undefined');
   const get=()=>run(`(()=>{const e=document.getElementById('page-startup-screen'),s=getComputedStyle(e),r=e.getBoundingClientRect();return{display:s.display,visibility:s.visibility,opacity:s.opacity,width:Math.round(r.width),height:Math.round(r.height),background:s.backgroundColor,brand:document.documentElement.dataset.loadingBrand,copy:[...e.querySelectorAll('p>[lang]')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.textContent).join('')}})()`);
   const loading=await get();assert.equal(loading.display,'grid');assert.equal(loading.visibility,'visible');assert.equal(loading.opacity,'1');assert.equal(loading.width,await run('document.documentElement.clientWidth'));assert.equal(loading.height,height);
   assert.equal(loading.background,mode==='light'?'rgb(255, 255, 255)':'rgb(17, 18, 20)');assert.equal(loading.brand,path==='live-studio.html'?'studio':'site');assert(loading.copy.startsWith(language==='en'?'Loading':'Se încarcă'));
   if(path==='live-studio.html')await b.waitFor(`Array.from(document.querySelectorAll('.ti-startup-studio img')).filter(e=>getComputedStyle(e).display!=='none').every(e=>e.complete&&e.naturalWidth>0)`);
   await b.screenshot(`${folder}/${path}-${width}-${mode}-${theme}.webp`);
   await b.waitFor('document.documentElement.dataset.uiReady==="ready"');assert.equal((await get()).display,'none');
   await b.page('Page.reload',{ignoreCache:true});
   await b.waitFor('!!document.getElementById("page-startup-screen")&&document.documentElement?.dataset.uiPending!==undefined&&getComputedStyle(document.getElementById("page-startup-screen")).display==="grid"');
   await b.waitFor('document.documentElement.dataset.uiReady==="ready"');assert.equal((await get()).display,'none');
   if(path==='live-studio.html'){await run('setLiveStudioTab("games");setLiveStudioTab("audio")');assert.equal((await get()).display,'none');assert.equal(await run('document.getElementById("live-game-frame").getAttribute("src")'),null);}
  }
  await b.page('Page.removeScriptToEvaluateOnNewDocument',{identifier:seed.identifier});
 }
 await b.page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert.equal(await run('getComputedStyle(document.querySelector(".ti-startup-track>span")).animationName'),'none');
 assert.deepEqual(b.errors,[]);
 console.log('Branded loading screens cover the viewport during actual pending state; correct site/Studio logo, saved language and Light/Dark/Blue/Burgundy colors; hidden immediately after readiness; reappear on real reload and stay hidden on tab changes. Desktop/mobile, reduced motion, no auto-start and no JS errors. Fixture delay only, no product delay.');
}catch(error){await b.screenshot(folder+'/failure.webp');console.log(b.errors);throw error;}finally{await b.close();server.kill();}
