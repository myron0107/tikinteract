import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';

// Local browser fixtures only: no real account, payment or LIVE connection.
const b=await openSkyShiftBrowser('control-states-review');
const run=e=>b.evaluate(e),origin='http://127.0.0.1:3010';
const settle=()=>run('document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,240)))');
async function click(selector){
 const rect=await run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 for(const type of ['mouseMoved','mousePressed','mouseReleased'])await b.page('Input.dispatchMouseEvent',{...rect,type,button:type==='mouseMoved'?'none':'left',clickCount:type==='mouseMoved'?0:1});
 await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:65});await settle();
}
const tabs=()=>run(`Array.from(document.querySelectorAll('#studio-test-tabs>button'),e=>{const s=getComputedStyle(e);return{id:e.id,selected:e.getAttribute('aria-selected'),background:s.background,color:s.color,shadow:s.boxShadow,outline:s.outlineStyle,after:getComputedStyle(e,'::after').display}})`);
try{
 await mkdir('.tools/control-states-review',{recursive:true});
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);const c=window.supabase.createClient(),r=c.rpc.bind(c);c.rpc=async(n,...a)=>n==="get_my_account_status"?{data:{allowed:true,state:"active"},error:null}:n==="get_my_access"?{data:{plan:"free",periods:[],serverNow:new Date().toISOString()},error:null}:r(n,...a);'});
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await b.page('Page.navigate',{url:origin+'/live-studio.html'});
 await b.waitFor('window.TikInteractAccount?.isAllowed()&&document.body.classList.contains("studio-modern")');
 assert.equal(await run('document.getElementById("live-game-frame").getAttribute("src")'),null);
 await run('["neon-race-2","moto-interact","nova-vex"].forEach(id=>{if(!document.querySelector(`.studio-game-option[data-live-game="${id}"]`))toggleGameFavorite(id)})');
 for(const game of ['nova-vex','moto-interact']){
  await click(`.studio-game-option[data-live-game="${game}"]`);
  await b.waitFor('document.querySelector("#studio-test-tab-audio")&&!document.getElementById("live-game-frame").hasAttribute("aria-busy")');
  assert.equal(await run('document.querySelectorAll(".studio-game-option[aria-pressed=true]").length'),1);
  assert.equal(await run('getComputedStyle(document.querySelector(".studio-game-option[aria-pressed=true]")).outlineStyle'),'none');
  for(const width of [1440,390]){
   await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
   for(const theme of ['burgundy','blue'])for(const mode of ['dark','light']){
    await run(`TikInteractAppearance.set(${JSON.stringify({theme,mode})})`);await settle();
    for(const key of ['teams','audio','teams','appearance','audio']){
     if(!await run(`!!document.getElementById('studio-test-tab-${key}')`))continue;
     await click('#studio-test-tab-'+key);
     const focused=await tabs();await run('document.activeElement.blur()');await settle();
     assert.deepEqual(await tabs(),focused,'Pointer focus must not change selection styling after blur');
     assert.equal(focused.filter(t=>t.selected==='true').length,1);
     for(const t of focused){assert.equal(t.shadow,'none');assert.equal(t.after,'none');assert.equal(t.outline,'none');}
     assert(await run(`Array.from(document.querySelectorAll('.studio-test-group')).every(e=>e.hidden===(e.dataset.studioTestCategory!==${JSON.stringify(key)}&&e.dataset.studioTestCategory!=='common'))`));
    }
    await run('document.querySelector("#studio-test-tabs>[aria-selected=true]").focus()');
    await b.page('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});
    await b.page('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft'});await settle();
    assert(await run('document.activeElement.matches("#studio-test-tabs>[aria-selected=true]:focus-visible")'),'Keyboard focus remains visible');
    await run('document.activeElement.blur()');
    assert.equal(await run('getComputedStyle(document.querySelector(".studio-app-nav .live-studio-tab.is-active"),"::before").width'),'2px','Keep Studio rail indicator');
   }
  }
 }
 await run('stopTikInteractStudio()');
 assert.equal(await run('document.querySelectorAll(".studio-game-option[aria-pressed=true],.studio-game-option.is-active").length'),0,'Stopping clears visual and ARIA selection');
 for(const path of ['index.html','admin.html','404.html']){
  await b.page('Page.navigate',{url:origin+'/'+path});await b.waitFor('document.readyState==="complete"');
  for(const mode of ['dark','light']){
   await run(`window.TikInteractAppearance?.set(${JSON.stringify(mode)})`);await settle();
   if(path==='index.html')for(const view of ['home','catalog','streams','leaderboard']){
    await run(`switchView(${JSON.stringify(view)})`);await settle();
    assert(await run('Array.from(document.querySelectorAll(".template-navigation>button"),e=>getComputedStyle(e,"::after").display).every(v=>v==="none")'),'Public navigation underline removed');
   }
   assert(await run('document.querySelector("link[href*=focus]")?.href.includes("focus.css?v=3")'),'Shared interaction styles loaded');
  }
 }
 assert.deepEqual(b.errors,[]);
 console.log('Passed: real pointer clicks, repeated Control game tabs, focus/blur stability, keyboard focus, game favorites, cleared selection, 2 games × 4 appearances × desktop/mobile; public sections, admin and 404 styles; Studio rail retained; no JS exceptions.');
}catch(error){await b.screenshot('.tools/control-states-review/failure.webp');console.log(b.errors);throw error;}finally{await b.close();}
