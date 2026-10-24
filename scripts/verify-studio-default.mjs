import assert from 'node:assert/strict';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('default-mobile-qa'),run=e=>b.evaluate(e.includes('await ')?`(async()=>{${e}})()`:e);
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1920,height:984,deviceScaleFactor:1,mobile:false});
 await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractWidgetDesktop');
 assert.equal(await run('typeof window.__qaSignIn'),'function','Use the isolated preview:studio server');
 await b.waitFor('TikInteractStudioPersonalization.getStatus().loaded&&!TikInteractStudioPersonalization.getStatus().busy');
 await run(`window.__priorProfiles=(await tikInteractSupabase.rpc('studio_layout_list')).data.profiles.filter(p=>p.name!=='DEFAULT');`);
 await run(`await TikInteractStudioPersonalization.selectProfile('default');TikInteractWidgetDesktop.open('studio');document.querySelector('.studio-widget-config:not([hidden])>header>button')?.click();`);
 await b.waitFor('!!document.querySelector(".sle-default-preset")');
 assert.equal(await run('TikInteractStudioPersonalization.getStatus().cloud'),'ready');
 await run(`window.__afterProfiles=(await tikInteractSupabase.rpc('studio_layout_list')).data.profiles;`);assert(await run('__priorProfiles.every(p=>JSON.stringify(p)===JSON.stringify(__afterProfiles.find(q=>q.id===p.id)))'));
 assert.equal(await run('document.querySelector("[data-layout-panel=preview] [data-sle-label]").textContent'),'Interface');
 assert.equal(await run('!!document.querySelector("[data-layout-panel=preview] svg.studio-interface-icon rect")'),true);
 const rects=await run(`[...document.querySelectorAll('[data-layout-panel][data-widget-enabled=true]')].map(n=>{const r=n.getBoundingClientRect();return{id:n.dataset.layoutPanel,x:r.x,y:r.y,w:r.width,h:r.height};})`);

 assert.equal(rects.length,7);assert(rects.find(p=>p.id==='preview').w>900);assert(rects.every(p=>p.x>=95&&p.x+p.w<=1920&&p.y>=0&&p.y+p.h<=984));
 await b.screenshot('.tools/default-desktop.webp');
 for(const width of [1024,700,390,320]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<=700});await run('new Promise(r=>setTimeout(r,150))');
  const data=await run(`(()=>{const n=document.querySelector('.sle-default-preset');return{width:document.documentElement.scrollWidth,rootWidth:n.scrollWidth,client:n.clientWidth,scroll:n.scrollHeight,height:n.clientHeight,panels:[...n.querySelectorAll('[data-layout-panel][data-widget-enabled=true]')].map(n=>{const r=n.getBoundingClientRect();return{x:r.x,w:r.width};})};})()`);
  assert(data.width<=width+1&&data.rootWidth<=data.client+1);assert(data.panels.every(p=>p.x>=65&&p.x+p.w<=width+1));assert(data.scroll>data.height);
  await run('document.querySelector(".sle-default-preset").scrollTop=0');await b.screenshot('.tools/default-'+width+'.webp');
  await run('document.querySelector(".sle-default-preset").scrollTop=10000');
  assert(await run('document.querySelector("#studio-live-session").getBoundingClientRect().bottom<=innerHeight+1'));
  await run('document.querySelector(".sle-default-preset").scrollTop=0');
 }
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await b.page('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await run('document.querySelector(".sle-default-preset").scrollTop=0;window.__hit=document.elementFromPoint(370,600)?.outerHTML.slice(0,100)');

 await b.page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:370,y:650}]});
 for(let i=1;i<=12;i++){await b.page('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:370,y:650-i*30}]});await run('new Promise(r=>setTimeout(r,16))');}
 await b.page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await run('new Promise(r=>setTimeout(r,200))');
 assert(await run('document.querySelector(".sle-default-preset").scrollTop>50'));
 // Every palette is selectable in both workspaces and has distinct real UI tokens.
 const colors=new Set();for(const workspace of ['live','ai']){
  assert.equal(await run(`TikInteractStudioDesign.palettes('${workspace}').length`),11);
  for(const mode of ['dark','light'])for(const id of ['ocean','mint','amethyst','rosewood','sage','steel','graphite','midnight']){
   await run(`document.documentElement.dataset.dockMenu='${workspace}';TikInteractAppearance.set('${mode}');TikInteractStudioDesign.setSkin('${id}','${workspace}');`);
   assert.equal(await run('document.documentElement.dataset.studioSkin'),id);
   colors.add(await run('getComputedStyle(document.body).getPropertyValue("--atmosphere-primary").trim()'));
  }
 }
 assert.equal(colors.size,8);
 await run(`TikInteractStudioDesign.setPaletteEnabled(false,'ai');`);assert.equal(await run('document.documentElement.dataset.studioPalette'),'off');
 await b.page('Page.reload');await b.waitFor('document.documentElement?.dataset.uiReady==="ready"');
 assert.equal(await run('TikInteractStudioDesign.get("ai").skin'),'midnight');
 assert.deepEqual(b.errors,[]);console.log('PASS: DEFAULT geometry, saved profile, desktop/tablet/phone bounds, touch scroll, 8 new palettes per workspace and persistence.');
}catch(error){await b.screenshot('.tools/default-failure.webp');console.log(b.errors);throw error;}finally{await b.close();}
