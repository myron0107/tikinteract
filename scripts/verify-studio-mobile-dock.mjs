import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-mobile-dock-review');const run=s=>b.evaluate(s);
const click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
const rect=s=>run(`(()=>{const r=document.querySelector(${JSON.stringify(s)}).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);
const ready='document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractFloatingDock&&!!window.TikInteractWidgetDesktop';
async function corner(selector){await run('new Promise(requestAnimationFrame)');assert(await run(`(()=>{const n=document.querySelector(${JSON.stringify(selector)}),r=n.getBoundingClientRect(),h=document.querySelector('[data-widget-resize="'+n.dataset.widgetWindowId+'"]').getBoundingClientRect();return r.right-h.right>=0&&r.right-h.right<=18&&r.bottom-h.bottom>=0&&r.bottom-h.bottom<=18&&getComputedStyle(n).resize==='none'&&document.querySelectorAll('[data-widget-resize="'+n.dataset.widgetWindowId+'"]').length===1})()`),'One resize handle stays inside the bottom-right corner');}
async function pointerDrag(selector,dx,dy){const r=await rect(selector),x=r.x+r.w/2,y=r.y+r.h/2;await b.page('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',x:Math.max(1,x+dx),y:Math.max(0,y+dy),buttons:1});await run('new Promise(requestAnimationFrame)');await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',x:Math.max(1,x+dx),y:Math.max(0,y+dy),button:'left',clickCount:1});}
async function touchDrag(selector,dx,dy){const r=await rect(selector),x=r.x+r.w/2,y=r.y+r.h/2;await b.page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await b.page('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy,id:1}]});await run('new Promise(requestAnimationFrame)');await b.page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await run('new Promise(requestAnimationFrame)');}
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor(ready);
 await run('TikInteractFloatingDock.collapse(false);TikInteractFloatingDock.reset()');if(await run('TikInteractFloatingDock.get().locked'))await click('[data-dock-lock]');
 await click('[data-studio-tab=home]');await b.waitFor('TikInteractWidgetDesktop.getActive()==="home"');
 await pointerDrag('#studio-home-panel>[data-widget-drag]',0,-900);assert((await rect('#studio-home-panel')).y<=5);
 await corner('#studio-home-panel');await pointerDrag('[data-widget-resize=home]',100,80);await corner('#studio-home-panel');await run('document.getElementById("studio-home-panel").scrollTop=150');await corner('#studio-home-panel');
 await click('[data-dock-collapse]');assert.equal(await run('TikInteractFloatingDock.get().collapsed'),true);
 const small=await rect('.studio-app-rail'),logo=await rect('.cp-rail-brand .ti-symbol'),arrow=await rect('[data-dock-collapse]');assert(small.h<90&&small.w<=65);assert(arrow.y>=logo.y+logo.h);
 assert.equal(await run('TikInteractWidgetDesktop.getActive()'),'home');
 await pointerDrag('.cp-rail-brand',150,100);assert.equal(await run('TikInteractFloatingDock.get().collapsed'),true);
 await b.page('Page.reload');await b.waitFor(ready);assert.equal(await run('TikInteractFloatingDock.get().collapsed'),true);
 await click('[data-dock-collapse]');assert.equal(await run('TikInteractFloatingDock.get().collapsed'),false);
 await run('TikInteractWidgetDesktop.open("studio")');assert(await run('!!document.querySelector(".studio-widget-config>header .fa-tower-broadcast")'));
 assert(await run('document.querySelector("[data-widget-options]>p").textContent.includes("LIVE")'));
 for(const mode of ['light','dark']){await run(`TikInteractAppearance.set({mode:${JSON.stringify(mode)}})`);assert.equal(await run('getComputedStyle(document.querySelector(".studio-widget-config>header>button")).backgroundColor'),'rgba(0, 0, 0, 0)');assert.equal(await run('getComputedStyle(document.querySelector(".studio-widget-config>header>button")).boxShadow'),'none');}
 fs.mkdirSync('.tools/mobile-dock-review',{recursive:true});await b.screenshot('.tools/mobile-dock-review/stream-config.webp');
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await b.page('Emulation.setTouchEmulationEnabled',{enabled:true});await run('dispatchEvent(new Event("resize"));TikInteractFloatingDock.reset()');
 assert(await run('Array.from(document.querySelectorAll(".studio-app-nav button>span,.studio-ai-nav button>span,.sw-rail-footer button>span")).every(n=>getComputedStyle(n).display==="none")'));
 await click('[data-studio-tab=games]');await b.waitFor('TikInteractWidgetDesktop.getActive()==="catalog"');
 assert(await run('document.querySelector("#game-center-panel>.widget-section-intro").textContent.length>10'));
 const before=await rect('#game-center-panel');await touchDrag('[data-widget-resize=catalog]',40,-60);const after=await rect('#game-center-panel');assert(after.w>before.w+20);assert(after.h<before.h-30);assert(after.x>=0&&after.x+after.w<=391);
 await corner('#game-center-panel');await run('document.getElementById("game-center-panel").scrollTop=120');await corner('#game-center-panel');
 await touchDrag('#game-center-panel>[data-widget-drag]',-10,-500);assert((await rect('#game-center-panel')).y<=5);
 await click('[data-dock-collapse]');await touchDrag('.cp-rail-brand',60,140);assert.equal(await run('TikInteractFloatingDock.get().collapsed'),true);await b.screenshot('.tools/mobile-dock-review/minimized.webp');
 await click('[data-dock-collapse]');assert.equal(await run('TikInteractFloatingDock.get().collapsed'),false);await b.screenshot('.tools/mobile-dock-review/games.webp');
 assert(await run('document.documentElement.scrollWidth<=innerWidth+1'));assert.deepEqual(b.errors,[]);
 console.log('PASS: all windows reach 4px; minimize to logo, arrow below, drag stays minimized, saved after reload; icon-only mobile menus, touch move/resize within screen; friendly Stream header, flat X, zero JS errors.');
}finally{await b.close()}
