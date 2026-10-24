import assert from 'node:assert/strict';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-corners-and-profiles-review'),run=e=>b.evaluate(e);
const frame=()=>run('new Promise(requestAnimationFrame)');
async function dragAt(point,dx,dy){
 await b.page('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
 for(let i=1;i<=8;i++){await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:point.x+dx*i/8,y:point.y+dy*i/8});await frame();}
 await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',x:point.x+dx,y:point.y+dy});await frame();
}
async function corners(node,selector,reset){
 for(const corner of ['nw','ne','sw','se']){
  if(reset)await run(reset);await frame();
  const before=await run(`document.querySelector(${JSON.stringify(node)}).getBoundingClientRect().toJSON()`);
  const point=await run(`(()=>{const g=document.querySelector(${JSON.stringify(selector+'[data-resize-corner='+corner+']')});const r=g.getBoundingClientRect();return{x:${corner.includes('w')?'r.left+5':'r.right-5'},y:${corner.includes('n')?'r.top+5':'r.bottom-5'}}})()`);
  await dragAt(point,corner.includes('w')?-32:32,corner.includes('n')?-24:24);
  const after=await run(`document.querySelector(${JSON.stringify(node)}).getBoundingClientRect().toJSON()`);
  assert(after.width>before.width+25&&after.height>before.height+18,node+' grows from '+corner);
  assert(Math.abs((corner.includes('w')?after.right:after.left)-(corner.includes('w')?before.right:before.left))<1.5,'Opposite horizontal edge fixed');
  assert(Math.abs((corner.includes('n')?after.bottom:after.top)-(corner.includes('n')?before.bottom:before.top))<1.5,'Opposite vertical edge fixed');
 }
 console.log(node+': all four resize corners preserve their opposite edges');
}
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractWidgetDesktop&&window.TikInteractStudioPersonalization?.getStatus().loaded');
 await run('TikInteractWidgetDesktop.open("home")');
 const resetHome='(()=>{const n=document.getElementById("studio-home-panel");for(const[k,v]of Object.entries({left:"300px",top:"200px",width:"600px",height:"380px"}))n.style.setProperty(k,v,"important");TikInteractWidgetDesktop.positionResize(n)})()';
 await corners('#studio-home-panel','[data-widget-resize=home]',resetHome);
 await run(resetHome);
 let point=await run('(()=>{const r=document.querySelector("#studio-home-panel [data-widget-drag]").getBoundingClientRect();return{x:r.left+140,y:r.top+r.height/2}})()');
 await dragAt(point,-await run('document.getElementById("studio-home-panel").getBoundingClientRect().left'),0);assert.equal(await run('document.getElementById("studio-home-panel").getBoundingClientRect().left'),0);
 point=await run('(()=>{const r=document.querySelector("#studio-home-panel [data-widget-drag]").getBoundingClientRect();return{x:r.left+140,y:r.top+r.height/2}})()');
 await dragAt(point,await run("document.documentElement.clientWidth")-await run('document.getElementById("studio-home-panel").getBoundingClientRect().right'),0);assert.equal(await run('document.getElementById("studio-home-panel").getBoundingClientRect().right'),await run('document.documentElement.clientWidth'));
 console.log('Page window reaches both viewport edges');
 await run('(async()=>{for(const id of TikInteractWidgetDesktop.get())await TikInteractWidgetDesktop.choose(id,false);TikInteractWidgetDesktop.open("studio");await TikInteractWidgetDesktop.choose("stats",true);document.querySelector(".studio-widget-config header button").click()})()');
 // The first move converts the default layout without moving the other panels.
 point=await run('(()=>{const r=document.querySelector(".studio-stats [data-sle-handle]").getBoundingClientRect();return{x:r.left+100,y:r.top+r.height/2}})()');await dragAt(point,60,150);
 const canvas=await run('document.querySelector(".studio-workspace").getBoundingClientRect().toJSON()');assert(Math.abs(canvas.left)<1);assert(Math.abs(canvas.right-await run("document.documentElement.clientWidth"))<1);
 const resetStream='(()=>{const v=TikInteractStudioPersonalization.getLayout();v.custom=true;Object.assign(v.desktop.find(p=>p.id==="stats"),{x:240,y:240,w:400,h:240});TikInteractStudioPersonalization.restoreLayout(v)})()';
 await corners('.studio-stats','body > [data-sle-resize=stats]',resetStream);
 point=await run('(()=>{const r=document.querySelector(".studio-stats [data-sle-handle]").getBoundingClientRect();return{x:r.left+100,y:r.top+r.height/2}})()');await dragAt(point,-await run('document.querySelector(".studio-stats").getBoundingClientRect().left'),0);assert(Math.abs(await run('document.querySelector(".studio-stats").getBoundingClientRect().left'))<1.5);
 point=await run('(()=>{const r=document.querySelector(".studio-stats [data-sle-handle]").getBoundingClientRect();return{x:r.left+100,y:r.top+r.height/2}})()');await dragAt(point,await run("document.documentElement.clientWidth")-await run('document.querySelector(".studio-stats").getBoundingClientRect().right'),0);assert(Math.abs(await run('document.querySelector(".studio-stats").getBoundingClientRect().right')-await run('document.documentElement.clientWidth'))<1.5);
 console.log('STREAM canvas and panels reach both viewport edges');
 await b.waitFor('!TikInteractStudioPersonalization.getStatus().busy');
 await run('TikInteractWidgetDesktop.open("studio");document.querySelector("[data-widget-layout]").click()');
 assert.equal(await run('document.querySelector("[data-widget-layout] span").textContent'),'Profiles');assert.equal(await run('document.querySelector("[data-layout-load]").textContent'),'Load');
 // Create a genuine local-fixture profile, change the layout, then Load the saved one.
 await run('(async()=>{const api=TikInteractStudioPersonalization,p=api.getStatus().profiles.find(p=>p.name==="Corner QA saved");if(p){await api.selectProfile(p.id);await api.saveLayout();}else{api.openProfiles();document.querySelector("[data-sle-profile-form] input").value="Corner QA saved";document.querySelector("[data-sle-profile-form]").requestSubmit()}})()');
 await b.waitFor('!TikInteractStudioPersonalization.getStatus().busy&&TikInteractStudioPersonalization.getStatus().profiles.some(p=>p.name==="Corner QA saved")');
 await run('window.qaSavedLayout=TikInteractStudioPersonalization.getLayout();window.qaSavedId=TikInteractStudioPersonalization.getStatus().active;const changed=structuredClone(qaSavedLayout);changed.desktop.find(p=>p.id==="stats").x=30;TikInteractStudioPersonalization.restoreLayout(changed)');
 await run('(()=>{const s=document.querySelector("[data-layout-profile]");s.value=qaSavedId;s.dispatchEvent(new Event("change",{bubbles:true}));})()');
 assert.equal(await run('TikInteractStudioPersonalization.getLayout().desktop.find(p=>p.id==="stats").x'),30,'Selecting only must not apply a layout');
 await run('document.querySelector("[data-layout-load]").click()');await b.waitFor('document.querySelector("[data-layout-feedback]").textContent==="Profile loaded."');
 assert.equal(await run('TikInteractStudioPersonalization.getLayout().desktop.find(p=>p.id==="stats").x'),await run('qaSavedLayout.desktop.find(p=>p.id==="stats").x'));
 console.log('Profiles: explicit Load restores the saved panel layout');
 await b.screenshot('.tools/window-corners-profiles.webp');assert.deepEqual(b.errors,[]);
}finally{await b.close();}
