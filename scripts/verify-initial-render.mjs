import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';

const origin='http://127.0.0.1:3018';
const server=spawn('python',['-m','http.server','3018','--bind','127.0.0.1'],{windowsHide:true,stdio:'ignore'});
await new Promise(r=>setTimeout(r,700));
const b=await openSkyShiftBrowser('initial-render-review'),run=e=>b.evaluate(e),results=[];
function monitor(){
 window.__bootFrames=[];window.__bootNodes={};
 const ids=['live-studio-tab','game-center-tab','audio-center-tab','creator-orientation','studio-test-panel','btn-connect'];
 new MutationObserver(()=>{for(const id of ids)if(!window.__bootNodes[id]){const node=document.getElementById(id);if(node)window.__bootNodes[id]=node;}}).observe(document,{childList:true,subtree:true});
 function sample(){
  const body=document.body,root=document.documentElement;
  if(body&&getComputedStyle(body).visibility==='visible'&&getComputedStyle(body).opacity!=='0'){
   const selectors=body.dataset.page==='studio'?['.app-topbar','.studio-app-rail','#creator-inbox-bell','.language-picker','#studio-account-avatar']:['.template-header','.open-studio-button','.language-picker','[data-mode-toggle]'];
   const boxes=Object.fromEntries(selectors.map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return[s,r?{x:r.x,y:r.y,width:r.width,height:r.height}:null]}));
   __bootFrames.push({ready:root.dataset.uiReady,language:root.lang,mode:root.dataset.mode,theme:root.dataset.theme,labels:[...document.querySelectorAll(body.dataset.page==='studio'?'.studio-app-nav [data-cp]':'.template-navigation>button>span')].map(e=>e.textContent.trim()),boxes});
  }
  if(__bootFrames.length<120)requestAnimationFrame(sample);
 }
 requestAnimationFrame(sample);
}
async function pointer(selector){
 const r=await run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 for(const type of ['mouseMoved','mousePressed','mouseReleased'])await b.page('Input.dispatchMouseEvent',{...r,type,button:type==='mouseMoved'?'none':'left',clickCount:type==='mouseMoved'?0:1});
}
try{
 await mkdir('.tools/initial-render-review',{recursive:true});
 await b.page('Network.enable');await b.page('Network.setCacheDisabled',{cacheDisabled:true});
 await b.page('Network.emulateNetworkConditions',{offline:false,latency:70,downloadThroughput:1200000,uploadThroughput:600000});
 await b.page('Emulation.setCPUThrottlingRate',{rate:2});
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);const c=window.supabase.createClient(),r=c.rpc.bind(c);c.rpc=async(n,...a)=>n==="get_my_account_status"?{data:{allowed:true,state:"active"},error:null}:n==="get_my_access"?{data:{plan:"free",periods:[],serverNow:new Date().toISOString()},error:null}:r(n,...a);const f=window.fetch.bind(window);window.fetch=(u,o)=>String(u).includes("/rest/v1/rpc/")?Promise.resolve(new Response("{}",{status:200,headers:{"Content-Type":"application/json"}})):f(u,o);('+monitor.toString()+')();'});
 const cases=[{language:'ro',mode:'dark',theme:'burgundy',width:1440},{language:'en',mode:'light',theme:'burgundy',width:390},{language:'ro',mode:'light',theme:'blue',width:390},{language:'en',mode:'dark',theme:'blue',width:1440}];
 for(const path of ['index.html','live-studio.html'])for(const pref of cases){
  const seed=await b.page('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('tikinteract_language',${JSON.stringify(pref.language)});localStorage.setItem('tikinteract_mode',${JSON.stringify(pref.mode)});localStorage.setItem('tikinteract_brand',${JSON.stringify(pref.theme)});`});
  await b.page('Emulation.setDeviceMetricsOverride',{width:pref.width,height:1000,deviceScaleFactor:1,mobile:pref.width<700});
  await b.page('Page.navigate',{url:origin+'/'+path});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"');
  await new Promise(r=>setTimeout(r,600));
  const frames=await run('__bootFrames'),final=frames.at(-1);assert(frames.length>0);
  for(const[selector,box]of Object.entries(final.boxes))assert(box&&box.width>0&&box.height>0,'Required header control: '+selector);
  for(const frame of frames){
   assert.equal(frame.ready,'ready','Never paint the intermediate UI');assert.equal(frame.language,pref.language);assert.equal(frame.mode,pref.mode);assert.equal(frame.theme,path==='index.html'?'burgundy':pref.theme);
   assert.deepEqual(frame.labels,final.labels,'No flash of another language');
   for(const [selector,box] of Object.entries(final.boxes))if(box)for(const axis of ['x','y','width','height'])assert(Math.abs(frame.boxes[selector]?.[axis]-box[axis])<1,'Header or rail shifted: '+selector+' '+axis);
  }
  if(path==='live-studio.html'){
   assert.deepEqual(final.labels,pref.language==='ro'?['TRANSMISIE','JOCURI','PANOU DE SUNETE']:['STREAM','GAMES','SOUND PAD']);
   assert(await run('Object.entries(__bootNodes).every(([id,node])=>document.getElementById(id)===node)'),'Do not rebuild static controls');
   assert.equal(await run('document.getElementById("live-game-frame").getAttribute("src")'),null);
   assert(await run('document.querySelector(".studio-game-sidebar")===document.querySelector(".studio-audio").parentElement'));
   await run('setLiveStudioTab("audio")');await b.waitFor('!!document.querySelector("#audio-center-master-volume")');
   for(const selector of ['#audio-center-master-volume','#audio-sound-search']){
    await pointer(selector);assert.equal(await run(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).boxShadow`),'none','No colored field focus glow');
   }
   await run('setLiveStudioTab("games")');
   assert(await run('getComputedStyle(document.querySelector(".game-center-search input")).backgroundColor==="rgba(0, 0, 0, 0)"'),'No inset game search background');
   await b.screenshot('.tools/initial-render-review/game-search-'+pref.mode+'-'+pref.theme+'.webp');
   await run('setLiveStudioTab("studio")');
  }else{
   assert(final.labels[0].startsWith(pref.language==='ro'?'JOCURI':'GAMES'));
   await run('switchView("leaderboard")');
   assert(await run('getComputedStyle(document.querySelector(".public-search input")).backgroundColor==="rgba(0, 0, 0, 0)"'),'No inset leaderboard search background');
   assert(await run('Array.from(document.querySelectorAll(".ranking-block")).every(e=>{const s=getComputedStyle(e);return s.backgroundImage==="none"&&s.backgroundColor==="rgba(0, 0, 0, 0)"})'),'No metallic bands behind ranking scores');
   await b.screenshot('.tools/initial-render-review/leaderboard-'+pref.mode+'.webp');
   await run('switchView("home")');
   await run('scrollTo({top:0,behavior:"instant"})');await new Promise(r=>setTimeout(r,250));
   const before=await run('(()=>{const e=document.querySelector("body>.template-header"),r=e.getBoundingClientRect();return{background:getComputedStyle(e).backgroundColor,width:r.width,height:r.height}})()');
   assert.equal(before.background,'rgba(0, 0, 0, 0)','Transparent public header at the top');
   await b.screenshot('.tools/initial-render-review/header-top-'+pref.width+'-'+pref.mode+'.webp');
   await run('scrollTo({top:550,behavior:"instant"})');await new Promise(r=>setTimeout(r,250));
   const after=await run('(()=>{const e=document.querySelector("body>.template-header"),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{scrolled:e.classList.contains("is-scrolled"),background:s.backgroundColor,blur:s.backdropFilter,width:r.width,height:r.height,top:r.top}})()');
   assert(after.scrolled&&after.background!=='rgba(0, 0, 0, 0)'&&after.blur.includes('blur'));
   assert.equal(after.width,before.width);assert.equal(after.height,before.height);assert(Math.abs(after.top)<1);
   await b.screenshot('.tools/initial-render-review/header-scrolled-'+pref.width+'-'+pref.mode+'.webp');
   await run('scrollTo({top:0,behavior:"instant"})');await new Promise(r=>setTimeout(r,250));
   assert.equal(await run('document.querySelector("body>.template-header").classList.contains("is-scrolled")'),false);
  }
  await b.screenshot('.tools/initial-render-review/'+path+'-'+pref.language+'-'+pref.mode+'-'+pref.theme+'.webp');
  results.push({path,...pref,visibleFrames:frames.length,passed:true});
  await b.page('Page.removeScriptToEvaluateOnNewDocument',{identifier:seed.identifier});
 }
 await run('loadLiveGame("nova-vex")');await b.waitFor('!!document.getElementById("studio-test-tab-audio")');await pointer('#studio-test-tab-audio');
 for(const selector of ['#studio-test-panel input[type=range]','#studio-test-panel input[type=checkbox]']){
  await pointer(selector);assert.equal(await run(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).boxShadow`),'none');
 }
 await pointer('#creator-orientation [data-format=landscape]');assert.equal(await run('TikInteractStudioLayout.getFormat()'),'landscape');
 await pointer('#studio-profile-more');assert.equal(await run('document.getElementById("studio-profile-details").hidden'),false);
 await pointer('#studio-profile-more');assert.equal(await run('document.getElementById("studio-profile-details").hidden'),true);
 assert.deepEqual(b.errors,[]);await writeFile('.tools/initial-render-review/result.json',JSON.stringify(results,null,2));
 console.log('Passed cold-cache/throttled first paint: saved RO/EN, Light/Dark, Burgundy/Blue, desktop/mobile; stable header/rail; original static nodes retained; no auto-start; volume/search/checkbox focus; native orientation and profile options; no JS exceptions.');
}catch(error){await b.screenshot('.tools/initial-render-review/failure.webp');console.log(b.errors);throw error;}finally{await b.close();server?.kill();}
