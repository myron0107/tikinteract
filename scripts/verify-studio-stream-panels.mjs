import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-stream-panels-review'),run=e=>b.evaluate(e);
const ready='document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractStudioPersonalization&&!!window.TikInteractWidgetDesktop&&!document.querySelector("[data-sle=edit]").disabled';
const ids=['stats','streamer','controls','audience','games','audio','animations','preview','feed'];
const rect=s=>run(`document.querySelector(${JSON.stringify(s)}).getBoundingClientRect().toJSON()`);
const waitFrame=()=>run('new Promise(requestAnimationFrame)');
async function drag(selector,dx,dy,touch=false){
 const r=await rect(selector),x=r.x+Math.min(r.width/2,50),y=r.y+r.height/2;
 if(touch)await b.page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 else await b.page('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
 for(let i=1;i<=6;i++){
  if(touch)await b.page('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6,id:1}]});
  else await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx*i/6,y:y+dy*i/6,buttons:1});
  await waitFrame();
 }
 if(touch)await b.page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 else await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left'});
 await run('new Promise(r=>setTimeout(r,140))');
}
async function show(id){
 await run(`(async()=>{await TikInteractWidgetDesktop.open('studio');for(const id of TikInteractWidgetDesktop.get())await TikInteractWidgetDesktop.choose(id,false);await TikInteractWidgetDesktop.choose(${JSON.stringify(id)},true);document.querySelector('.studio-widget-config header button').click();window.scrollTo(0,0)})()`);
 // Move with keyboard first, so every panel is reachable regardless of a saved layout.
 await run(`(()=>{const n=document.querySelector('[data-layout-panel="${id}"]');n.scrollIntoView({block:'start',behavior:'instant'});})()`);await waitFrame();
}
async function grip(id){
 await waitFrame();assert(await run(`(()=>{const n=document.querySelector('[data-layout-panel="${id}"]'),r=n.getBoundingClientRect(),h=document.querySelector('[data-sle-resize="${id}"]'),b=h.getBoundingClientRect();return document.querySelectorAll('[data-sle-resize="${id}"]').length===1&&h.parentElement===document.body&&h.classList.contains('studio-window-resize')&&h.querySelector('svg path').getAttribute('d')==='m3 13 10-10m-5 10 5-5'&&!h.hidden&&Math.abs(r.right-b.right)<1&&Math.abs(r.bottom-b.bottom)<1&&getComputedStyle(n).resize==='none'&&n.scrollWidth<=n.clientWidth+1})()`),id+': single shared corner grip, no horizontal overflow');
}
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor(ready);
 await run('TikInteractLanguage.set("en",{persist:false});TikInteractAppearance.set({mode:"dark"});window.qaGameFrame=document.getElementById("live-game-frame");TikInteractFloatingDock.collapse(true)');
 await drag('.studio-topbar-grip',-900,800);
 fs.mkdirSync('.tools/stream-panels-review',{recursive:true});
 for(const id of ids){
  await show(id);
  const panel=`[data-layout-panel="${id}"]`,header=`[data-sle-handle="${id}"]`;
  // The rendered header is a single row: grip, colored icon, title and close.
  assert(await run(`(()=>{const n=document.querySelector('${panel}'),h=n.querySelector('.sle-panel-tools'),g=h.querySelector('.sle-panel-grip').getBoundingClientRect(),i=h.querySelector('.sle-panel-icon').getBoundingClientRect(),t=h.querySelector('[data-sle-label]').getBoundingClientRect(),x=h.querySelector('[data-sle-hide]').getBoundingClientRect();return n.firstElementChild===h&&h.getBoundingClientRect().height===44&&g.right<=i.left&&i.right<=t.left&&t.right<=x.left&&getComputedStyle(document.querySelector('${panel} [data-sle-hide]')).backgroundColor==='rgba(0, 0, 0, 0)'})()`),id+': header parts do not overlap');
  const before=await rect(panel),dx=before.x>700?-30:30;await drag(header,dx,30);const moved=await rect(panel);assert(Math.abs(moved.x-before.x)>15||Math.abs(moved.y-before.y)>15,id+': movable');
  // Scroll the canvas so the bottom-right is in the viewport before resizing.
  await run(`document.querySelector('${panel}').scrollIntoView({block:'center',behavior:'instant'})`);await waitFrame();await grip(id);
  const size=await rect(panel);await drag(`[data-sle-resize="${id}"]`,-35,40);const after=await rect(panel);assert(after.height>size.height+25,id+': resizes');await grip(id);
  const layout=await run(`TikInteractStudioPersonalization.getLayout().desktop.find(p=>p.id==='${id}')`);assert(layout.h>0&&layout.w>=160);
  await run(`document.querySelector('${panel} [data-sle-hide]').click()`);assert(await run(`!document.querySelector('${panel}').getClientRects().length&&document.querySelector('[data-sle-resize="${id}"]').hidden`),id+': closes with no ghost grip');
  await run(`TikInteractWidgetDesktop.choose('${id}',true)`);await waitFrame();assert(await run(`document.querySelector('${panel}').getClientRects().length>0`),id+': reopens');
  await run(`document.querySelector('${panel}').scrollIntoView({block:'center',behavior:'instant'})`);await grip(id);
  if(id==='stats')await b.screenshot('.tools/stream-panels-review/stats-dark.webp');
 }
 await show('audience');
 await run('document.querySelector("[data-sle-handle=audience]").remove()');await waitFrame();assert.equal(await run('document.querySelectorAll("[data-sle-handle=audience]").length'),1,'LIVE repaint restores the same header');
 await run('TikInteractAppearance.set({mode:"light"})');await b.screenshot('.tools/stream-panels-review/audience-light.webp');
 assert(await run('window.qaGameFrame===document.getElementById("live-game-frame")'),'Original game iframe preserved');
 await run('TikInteractWidgetDesktop.open("games")');await waitFrame();assert(await run('[...document.querySelectorAll("[data-sle-resize]")].every(h=>h.hidden)'),'No STREAM grips leak into other pages');
 // Native wallpaper pairs preserve cover and change images with the theme.
 for(const id of ['arcade-hub','crystal-world','stardust']){
  const images=[];
  for(const mode of ['light','dark']){
   await run(`TikInteractStudioBackgrounds.set('${id}');TikInteractAppearance.set({mode:'${mode}'})`);await waitFrame();
   const result=await run('(()=>{const s=getComputedStyle(document.body,"::before");return{filter:s.filter,size:s.backgroundSize,image:s.backgroundImage,mode:document.documentElement.dataset.mode}})()');
   assert.equal(result.size,'cover');assert(result.image.includes(id));assert.equal(result.filter,'none');assert(result.image.includes(id+'-'+mode+'.webp'));images.push(result.image);
   if(id==='crystal-world')await b.screenshot(`.tools/stream-panels-review/wallpaper-${mode}.webp`);
  }
  assert.notEqual(images[0],images[1]);
 }
 assert(await run('!document.querySelector(".studio-app-rail .cp-rail-brand,.studio-app-rail .ti-symbol")'),'Dock logo removed');
 const dockBefore=await rect('[data-dock-handle]');await drag('[data-dock-handle]',50,50);const dockAfter=await rect('[data-dock-handle]');assert(dockAfter.x>dockBefore.x+20,'Minimized dock still draggable without logo');
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await b.page('Emulation.setTouchEmulationEnabled',{enabled:true});await run('dispatchEvent(new Event("resize"));TikInteractFloatingDock.reset()');
 await show('stats');await run('document.querySelector("[data-layout-panel=stats]").scrollIntoView({block:"center",behavior:"instant"})');await grip('stats');const beforeTouch=await rect('[data-layout-panel=stats]');await drag('[data-sle-resize=stats]',-30,50,true);const afterTouch=await rect('[data-layout-panel=stats]');assert(afterTouch.height>beforeTouch.height+30);await grip('stats');
 assert(await run('document.documentElement.scrollWidth<=innerWidth+1'),'Mobile has no page horizontal scrollbar');
 await b.screenshot('.tools/stream-panels-review/mobile.webp');
 assert(await run('(()=>{const f=document.querySelector(".studio-page-signature"),s=getComputedStyle(f);return f.textContent.trim()==="TikInteractSTUDIO"&&!f.querySelector(".ti-brand-tagline")&&s.backgroundColor==="rgba(0, 0, 0, 0)"})()'),'Homepage wordmark plus STUDIO, transparent, no year or tagline');
 assert(await run('getComputedStyle(document.querySelector("[data-layout-panel=stats]")).boxShadow!=="none"'),'Fine panel shadows remain visible');
 const persisted=await run('TikInteractStudioPersonalization.getLayout().mobile.find(p=>p.id==="stats")');await run('new Promise(r=>setTimeout(r,1200))');await b.page('Page.reload');await b.waitFor(ready);
 const restored=await run('TikInteractStudioPersonalization.getLayout().mobile.find(p=>p.id==="stats")');assert.deepEqual(restored,persisted,'Latest dimensions survive save and refresh');
 assert.deepEqual(b.errors,[]);console.log('PASS: 9 STREAM panels, separated sticky headers, move/resize/close/reopen, shared portal grips, preserved iframe, LIVE repaint, light/dark wallpapers, logo-free dock, mobile touch resize; no JS errors.');
}finally{await b.close()}
