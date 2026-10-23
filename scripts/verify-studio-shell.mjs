import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-shell-final-review'),run=s=>b.evaluate(s);
const click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
const ready='document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractWidgetDesktop';
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor(ready);
 assert.equal(await run('TikInteractLanguage.get()'),'en');
 await run('TikInteractFloatingDock.collapse(false);TikInteractFloatingDock.reset()');
 let bar=await run('document.getElementById("studio-dock-utilities").dataset.utilitiesCollapsed');if(bar==='true')await click('[data-utilities-collapse]');
 assert(await run('(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();return r("[data-utilities-collapse]").right<=r("[data-credit-view]").left&&r(".studio-topbar-grip").left>=r("#studio-account-avatar").right})()'));
 const width=await run('document.getElementById("studio-dock-utilities").offsetWidth');await click('[data-utilities-collapse]');assert(await run('document.getElementById("studio-dock-utilities").offsetWidth<'+width));
 assert(await run('Array.from(document.querySelector("#studio-dock-utilities .header-account-actions").children).filter(n=>getComputedStyle(n).display!=="none").every(n=>n.matches(".studio-credit-balance,#studio-user-menu-wrap,#studio-account-avatar"))'));
 await b.page('Page.reload');await b.waitFor(ready);assert.equal(await run('document.getElementById("studio-dock-utilities").dataset.utilitiesCollapsed'),'true');await click('[data-utilities-collapse]');
 fs.mkdirSync('.tools/shell-final-review',{recursive:true});
 for(const id of ['neon-city','floating-islands','ruby-arena'])for(const mode of ['dark','light']){
  await run(`TikInteractStudioBackgrounds.set(${JSON.stringify(id)});TikInteractAppearance.set({mode:${JSON.stringify(mode)}})`);
  assert(await run('(()=>{const s=getComputedStyle(document.body,"::before");return s.backgroundSize==="cover"&&s.backgroundRepeat==="no-repeat"&&s.position==="fixed"&&s.top==="0px"&&s.bottom==="0px"&&s.left==="0px"&&s.right==="0px"})()'));
 }
 await b.screenshot('.tools/shell-final-review/background-wide.webp');
 for(const section of ['home','games','audio','animations']){
  await run(`TikInteractWidgetDesktop.open(${JSON.stringify(section)})`);
  await b.waitFor('!!document.querySelector(".studio-window-resize:not([hidden])")');
  assert(await run(`(()=>{const n=document.querySelector('.studio-widget-window[data-widget-enabled=true]'),b=document.querySelector('[data-widget-resize="'+n.dataset.widgetWindowId+'"]'),r=n.getBoundingClientRect(),h=b.getBoundingClientRect();return document.querySelectorAll('[data-widget-resize="'+n.dataset.widgetWindowId+'"]').length===1&&getComputedStyle(n).resize==='none'&&h.right<=r.right+1&&h.bottom<=r.bottom+1&&getComputedStyle(b).display!=='none'})()`));
 }
 await run('TikInteractWidgetDesktop.open("home")');await b.screenshot('.tools/shell-final-review/home.webp');
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await run('dispatchEvent(new Event("resize"))');
 assert(await run('getComputedStyle(document.body,"::before").backgroundSize==="cover"'));assert(await run('document.documentElement.scrollWidth<=innerWidth+1'));
 await click('[data-utilities-collapse]');await b.screenshot('.tools/shell-final-review/mobile-compact.webp');
 assert.deepEqual(b.errors,[]);console.log('PASS: English default, Studio refresh readiness, left collapse/right drag handle, compact profile/diamond survives refresh, all wallpapers cover viewport Light/Dark, resize handle on every main page, mobile fits, zero JS errors.');
}finally{await b.close()}
