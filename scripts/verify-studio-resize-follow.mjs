import assert from 'node:assert/strict';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-resize-follow-review'),run=e=>b.evaluate(e);
const frame=()=>run('new Promise(requestAnimationFrame)');
async function check(name,nodeSelector,handleSelector,gripSelector,{touch=false,dx=84,dy=48}={}){
 const geometry=await run(`(()=>{const n=document.querySelector(${JSON.stringify(nodeSelector)}),h=document.querySelector(${JSON.stringify(handleSelector)}),g=document.querySelector(${JSON.stringify(gripSelector)});window.qaWindow=n;window.qaGrip=g;const r=h.getBoundingClientRect(),s=getComputedStyle(g);return{x:r.left+Math.min(r.width/2,140),y:r.top+r.height/2,transition:s.transition,transform:s.transform,hidden:g.hidden,window:n.getBoundingClientRect().toJSON(),grip:g.getBoundingClientRect().toJSON()}})()`);
 const rows=[];
 if(touch)await b.page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:geometry.x,y:geometry.y,id:1}]});
 else await b.page('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:geometry.x,y:geometry.y});
 try{
  for(let i=1;i<=12;i++){
   if(touch)await b.page('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:geometry.x+dx*i/12,y:geometry.y+dy*i/12,id:1}]});
   else await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:geometry.x+dx*i/12,y:geometry.y+dy*i/12});await frame();
   rows.push(await run('(()=>{const n=qaWindow.getBoundingClientRect(),g=qaGrip.getBoundingClientRect();return{dx:g.right-n.right,dy:g.bottom-n.bottom,hidden:qaGrip.hidden,transform:getComputedStyle(qaGrip).transform}})()'));
  }
 }finally{
  if(touch)await b.page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  else await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',x:geometry.x+dx,y:geometry.y+dy});await frame();
 }
 const after=await run('qaWindow.getBoundingClientRect().toJSON()');
 assert(Math.hypot(after.x-geometry.window.x,after.y-geometry.window.y)>10,name+': window actually moved');
 assert(rows.every(r=>!r.hidden&&Math.abs(r.dx)<=1&&Math.abs(r.dy)<=1),name+': resize grip must stay in the corner while dragging');
 console.log(name+': grip aligned in all '+rows.length+' drag frames');
}
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractWidgetDesktop');
 await run('TikInteractWidgetDesktop.open("home")');await frame();
 await check('Home','#studio-home-panel','#studio-home-panel [data-widget-drag]','[data-widget-resize=home]');
 await run('TikInteractStudioWindows.open("subscription")');await b.waitFor('!!document.querySelector("#studio-user-dialog .ti-ticket")');await frame();
 await check('Subscription','#studio-user-dialog','#studio-user-dialog [data-widget-drag]','[data-widget-resize=account]');
 await run('TikInteractStudioWindows.close();TikInteractWidgetDesktop.open("studio")');await frame();
 await check('Stream menu','.studio-widget-config','.studio-widget-config [data-widget-drag]','[data-widget-resize=config]');
 await run('TikInteractWidgetDesktop.open("studio");TikInteractWidgetDesktop.choose("stats",true);document.querySelector(".studio-widget-config header button").click()');await frame();
 await check('Stream','.studio-stats','.studio-stats [data-sle-handle]','body > [data-sle-resize=stats]');
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await b.page('Emulation.setTouchEmulationEnabled',{enabled:true});
 await run('dispatchEvent(new Event("resize"));TikInteractWidgetDesktop.open("home")');await frame();
 const top=await run('document.getElementById("studio-home-panel").getBoundingClientRect().top');
 await check('Mobile Home','#studio-home-panel','#studio-home-panel [data-widget-drag]','[data-widget-resize=home]',{touch:true,dx:0,dy:top>45?-40:40});
 assert.deepEqual(b.errors,[]);
}finally{await b.close();}
