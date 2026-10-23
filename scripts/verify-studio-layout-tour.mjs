import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-layout-tour-review'),run=e=>b.evaluate(e);
const ready='document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractStudioTour&&!!window.TikInteractStudioPersonalization&&!document.querySelector("[data-sle=edit]").disabled';
const frame=()=>run('new Promise(requestAnimationFrame)');
async function drag(selector,dx,dy){const r=await run(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`),x=r.x+40,y=r.y+20;await b.page('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx,y:y+dy,buttons:1});await frame();await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left'});await frame();}
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor(ready);
 await run('TikInteractLanguage.set("en",{persist:false});TikInteractAppearance.set({mode:"light"});TikInteractWidgetDesktop.open("games")');
 await run('launchStudioGame("nova-vex")');await b.waitFor('TikInteractWidgetDesktop.getActive()==="studio"&&!document.querySelector(".studio-widget-config").hidden');
 assert(await run('document.querySelector("[data-widget-options]>p").textContent.includes("next LIVE")'));
 assert(await run('!document.querySelector("[data-widget-options]").textContent.includes("Arrange / resize panels")'));
 await run('window.qaFrame=document.getElementById("live-game-frame");document.querySelector("[data-widget-layout]").click()');
 assert(await run('!document.getElementById("studio-layout-manager").hidden&&!TikInteractStudioPersonalization.isEditing()'));
 const before=await run('document.getElementById("studio-layout-manager").getBoundingClientRect().toJSON()');await drag('#studio-layout-manager header',60,40);const after=await run('document.getElementById("studio-layout-manager").getBoundingClientRect().toJSON()');assert(after.x>before.x+30&&after.y>before.y+20);
 await run('document.querySelector("[data-layout-save]").click()');await b.waitFor('document.querySelector("[data-layout-feedback]").textContent.includes("saved")');
 fs.mkdirSync('.tools/layout-tour-review',{recursive:true});await b.screenshot('.tools/layout-tour-review/layout-manager.webp');
 await run('document.querySelector("[data-layout-close]").click();TikInteractWidgetDesktop.open("games")');
 const snapshot=await run('({desktop:TikInteractWidgetDesktop.snapshot(),layout:TikInteractStudioPersonalization.getLayout()})');
 await run('openStudioHelp()');assert(await run('TikInteractStudioTour.get().open'));
 const total=await run('TikInteractStudioTour.get().total');assert(total>=9);
 for(let i=0;i<total;i++){
  await b.waitFor(`TikInteractStudioTour.get().index===${i}&&!document.getElementById('studio-tour-next').disabled`);await frame();
  assert(await run('(()=>{const n=document.getElementById("studio-tour-highlight").getBoundingClientRect();return n.width>0&&n.height>0&&n.left>=0&&n.top>=0&&n.right<=innerWidth&&n.bottom<=innerHeight})()'),'Tour target is visible');
  assert.equal(await run('getComputedStyle(document.getElementById("studio-help-dialog"),"::backdrop").backgroundColor'),'rgba(0, 0, 0, 0)');
  if(i===0||i===6)await b.screenshot(`.tools/layout-tour-review/step-${i}.webp`);
  await run('document.getElementById("studio-tour-next").click()');
 }
 await b.waitFor('!document.documentElement.dataset.studioTourActive');
 assert.deepEqual(await run('TikInteractWidgetDesktop.snapshot()'),snapshot.desktop,'Tour restores the selected pages and panels');
 assert.deepEqual(await run('TikInteractStudioPersonalization.getLayout()'),snapshot.layout,'Tour preserves the user layout');
 assert(await run('window.qaFrame===document.getElementById("live-game-frame")'),'Tour preserves the game iframe');
 assert(await run('document.querySelector(".ti-startup-wordmark").textContent==="TikInteract"'),'Session headings cannot overwrite the loading logo');
 assert.deepEqual(b.errors,[]);console.log('PASS: game launch opens Stream picker; movable layout manager, manual save without legacy edit mode; all new tour steps visible, transparent backdrop, user layout restored and game iframe preserved.');
}finally{await b.close()}
