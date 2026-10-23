import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-popover-review'),run=s=>b.evaluate(s),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
const entries=[['#studio-account-avatar','#studio-profile-dropdown'],['.language-trigger','#language-menu'],['#creator-inbox-bell','#studio-notifications-panel'],['[data-design-palette-toggle]','[data-design-palette-panel]']];
async function settled(){await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function anchored(button,panel){await settled();const state=await run(`(()=>{const a=document.querySelector(${JSON.stringify(button)}).getBoundingClientRect(),bar=document.getElementById('studio-dock-utilities').getBoundingClientRect(),p=document.querySelector(${JSON.stringify(panel)}),r=p.getBoundingClientRect(),x=Math.max(8,Math.min(a.left+a.width/2-r.width/2,innerWidth-r.width-8));return {ok:!p.hidden&&Math.abs(r.top-bar.bottom-8)<2&&Math.abs(r.left-x)<2&&r.left>=7&&r.right<=innerWidth-7&&r.bottom<=innerHeight-7,button:${JSON.stringify(button)},anchor:a.toJSON(),panel:r.toJSON(),hidden:p.hidden,styles:p.getAttribute('style')}})()`);assert(state.ok,JSON.stringify(state));}
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractWidgetDesktop');
 if(await run('document.getElementById("studio-dock-utilities").dataset.utilitiesCollapsed==="true"'))await click('[data-utilities-collapse]');
 for(const [button,panel]of entries){
  await run('var bar=document.getElementById("studio-dock-utilities");bar.style.setProperty("left","500px","important");bar.style.setProperty("top","110px","important")');await click(button);await anchored(button,panel);
  await run('var bar=document.getElementById("studio-dock-utilities");bar.style.setProperty("left","320px","important");bar.style.setProperty("top","200px","important")');await anchored(button,panel);
  fs.mkdirSync('.tools/popover-review',{recursive:true});await b.screenshot('.tools/popover-review/'+panel.replaceAll(/[^a-z-]/g,'')+'-centered.webp');
 }
 await click('[data-utilities-collapse]');assert(await run('getComputedStyle(document.querySelector(".studio-topbar-grip")).display!=="none"'));
 await click('#studio-account-avatar');await anchored(...entries[0]);
 const before=await run('document.getElementById("studio-dock-utilities").getBoundingClientRect().toJSON()'),h=await run('document.querySelector(".studio-topbar-grip").getBoundingClientRect().toJSON()');
 await b.page('Input.dispatchMouseEvent',{type:'mousePressed',x:h.x+h.width/2,y:h.y+h.height/2,button:'left',clickCount:1});await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x+h.width/2+80,y:h.y+h.height/2+40,buttons:1});await settled();await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',x:h.x+h.width/2+80,y:h.y+h.height/2+40,button:'left',clickCount:1});assert(await run('document.getElementById("studio-dock-utilities").getBoundingClientRect().x')>before.x+40);
 await click('[data-utilities-collapse]');
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await run('dispatchEvent(new Event("resize"));var bar=document.getElementById("studio-dock-utilities");bar.style.setProperty("left","8px","important");bar.style.setProperty("top","20px","important")');
 for(const [button,panel]of entries){await click(button);await anchored(button,panel);}
 await run('var bar=document.getElementById("studio-dock-utilities");bar.style.setProperty("top","740px","important")');await settled();
 assert(await run('(()=>{const p=document.querySelector("[data-design-palette-panel]"),r=p.getBoundingClientRect();return p.dataset.popoverSide==="above"&&r.top>=7&&r.bottom<=innerHeight-7})()'));
 await run('var bar=document.getElementById("studio-dock-utilities");bar.style.setProperty("top","20px","important")');await anchored(...entries[3]);
 fs.mkdirSync('.tools/popover-review',{recursive:true});await b.screenshot('.tools/popover-review/mobile.webp');assert.deepEqual(b.errors,[]);
 console.log('PASS: all four menus center under their triggers with a uniform 8px gap below the bar, follow bar movement, fit desktop/mobile, flip safely near the bottom; compact mode stays draggable; zero JS errors.');
}finally{await b.close()}
