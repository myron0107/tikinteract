import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-appearance-review');
const run=expression=>b.evaluate(expression);
const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
const background=()=>run('getComputedStyle(document.body,"::before").backgroundImage');
const ready='document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractStudioBackgrounds&&!!window.TikInteractWidgetDesktop';
async function drag(selector,dy){
 const p=await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.left+35,y:r.top+r.height/2}})()`);
 await b.page('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
 await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+10,y:Math.max(0,p.y+dy),buttons:1});
 await run('new Promise(requestAnimationFrame)');
 await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+10,y:Math.max(0,p.y+dy),button:'left',clickCount:1});
 await run('new Promise(requestAnimationFrame)');
}
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor(ready);
 await run('document.querySelector(".studio-workspace-switch [data-workspace=live]").click();TikInteractStudioBackgrounds.set("neutral");TikInteractAppearance.set({mode:"dark"})');
 const dark=await background();assert(!dark.includes('url('));
 await click('[data-design-palette-toggle]');
 assert.equal(await run('document.querySelectorAll("button[data-studio-background]").length'),12);
 await click('[data-studio-appearance-mode=light]');const light=await background();assert.notEqual(light,dark);assert(!light.includes('url('));
 for(const id of ['navy','plum','sage']){await click(`button[data-studio-background=${id}]`);assert.notEqual(await background(),light);}
 for(const id of ['arcade-hub','crystal-world','stardust']){
  await click(`button[data-studio-background=${id}]`);assert((await background()).includes(id+'-light.webp'));
  assert(await run(`(async()=>{const image=new Image();image.src=new URL('assets/studio-backgrounds/${id}-light.webp',location.href).href;await image.decode();return image.naturalWidth>=1600})()`));
 }
 await run('TikInteractStudioDesign.setPaletteEnabled(false)');const image=await background();assert(image.includes('stardust-light.webp'));
 await run('TikInteractStudioDesign.setSkin("ice")');assert.equal(await background(),image);
 await click('button[data-studio-background=arcade-hub]');
 await click('.studio-workspace-switch [data-workspace=ai]');assert.equal(await run('TikInteractStudioBackgrounds.get().id'),'neutral');
 await click('[data-design-palette-toggle]');await click('button[data-studio-background=plum]');
 await click('.studio-workspace-switch [data-workspace=live]');assert.equal(await run('TikInteractStudioBackgrounds.get().id'),'arcade-hub');
 await b.page('Page.reload');await b.waitFor(ready);assert.equal(await run('TikInteractStudioBackgrounds.get().id'),'arcade-hub');
 await click('[data-design-palette-toggle]');
 assert(await run('Array.from(document.querySelectorAll(".sd-background-landscapes img")).every(i=>i.src.endsWith("-thumb.webp"))'));
 await run('document.getElementById("studio-background-color").value="#324354"');await click('[data-studio-custom-color]');
 assert.equal(await run('TikInteractStudioBackgrounds.get().color'),'#324354');assert.equal(await run('getComputedStyle(document.body,"::before").backgroundColor'),'rgb(50, 67, 84)');
 await click('button[data-studio-background=neutral]');await click('[data-studio-appearance-mode=dark]');
 fs.mkdirSync('.tools/appearance-review',{recursive:true});await b.screenshot('.tools/appearance-review/simple-dark.webp');
 await click('[data-studio-appearance-mode=light]');await b.screenshot('.tools/appearance-review/simple-light.webp');
 await click('[data-design-palette-toggle]');await run('TikInteractWidgetDesktop.choose("preview",true)');
 await b.waitFor('!document.querySelector("[data-sle=edit]").disabled');
 await run('window.__sameStage=document.querySelector(".studio-stage")');
 await drag('[data-sle-handle=preview]',220);await drag('[data-sle-handle=preview]',-900);
 assert(await run('(()=>{const r=document.querySelector(".studio-stage").getBoundingClientRect();return r.top>=3&&r.top<=6})()'),'STREAM panel can reach the 4px top boundary');
 assert(await run('document.querySelector(".studio-stage")===__sameStage'));
 await b.screenshot('.tools/appearance-review/canvas-top.webp');
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await run('dispatchEvent(new Event("resize"))');
 await click('[data-design-palette-toggle]');await click('button[data-studio-background=crystal-world]');
 assert(await run('(()=>{const r=document.querySelector("[data-design-palette-panel]").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1})()'));
 assert(await run('document.documentElement.scrollWidth<=innerWidth+1'));
 await b.screenshot('.tools/appearance-review/mobile.webp');
 assert.deepEqual(b.errors,[]);
 console.log('PASS: 12 wallpapers, Light/Dark controls and neutral defaults, images load, custom color, LIVE/AI persistence, independent palette, mobile bounds, STREAM drag to 4px, original panel retained, zero JS errors.');
}finally{await b.close()}
