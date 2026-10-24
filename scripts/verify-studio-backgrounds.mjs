import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-metallic-backgrounds-review'),run=e=>b.evaluate(e);
const ready='document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractStudioBackgrounds';
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});await b.waitFor(ready);
 await run('document.querySelector(".studio-workspace-switch [data-workspace=live]").click();TikInteractWidgetDesktop.open("home")');
 fs.mkdirSync('.tools/soft-backgrounds-review',{recursive:true});
 await run('document.querySelector("[data-design-palette-toggle]").click()');
 assert.equal(await run('document.querySelectorAll("button[data-studio-background]").length'),12);
 assert.deepEqual(await run('TikInteractStudioBackgrounds.options().reduce((groups,c)=>(groups[c.kind]=(groups[c.kind]||0)+1,groups),{})'),{minimal:4,metallic:4,landscape:4});
 assert(await run('document.querySelector("[data-studio-appearance-backgrounds]").textContent.includes("Metallic")'));
 assert(await run('![...document.querySelectorAll("button[data-studio-background]")].some(b=>["neon-city","floating-islands","ruby-arena"].includes(b.dataset.studioBackground))'));
 for(const id of ['soft-graphite','metal-silver','soft-blue','soft-mint']){
  const values=[];
  for(const mode of ['light','dark']){
   await run(`document.querySelector('[data-studio-appearance-mode="${mode}"]').click();document.querySelector('button[data-studio-background="${id}"]').click()`);
   const style=await run('(()=>{const s=getComputedStyle(document.body,"::before");return{image:s.backgroundImage,size:s.backgroundSize,filter:s.filter,id:document.documentElement.dataset.studioBackground}})()');
   assert.equal(style.id,id);assert(style.image.includes('linear-gradient'));assert(!style.image.includes('url('));assert.equal(style.filter,'none');assert(style.size.split(',').every(s=>s.trim()==='cover'));values.push(style.image);
   assert(await run(`document.querySelector('button[data-studio-background="${id}"]').getAttribute('aria-pressed')==='true'`));
   if(id==='soft-blue')await b.screenshot(`.tools/soft-backgrounds-review/${mode}.webp`);
  }
  assert.notEqual(values[0],values[1]);
 }
 for(const id of ['arcade-hub','crystal-world','cosmic-orbit','stardust']){
  await run(`document.querySelector('button[data-studio-background="${id}"]').click()`);
  for(const mode of ['light','dark']){
  await run(`document.querySelector('[data-studio-appearance-mode="${mode}"]').click()`);
  assert.equal(await run('TikInteractStudioBackgrounds.get().id'),id,'Changing theme retains selected wallpaper');
  assert(await run(`getComputedStyle(document.body,'::before').backgroundImage.includes('${id}-${mode}.webp')`));
  assert.equal(await run('getComputedStyle(document.body,"::before").filter'),'none');
  assert(await run(`document.querySelector('button[data-studio-background="${id}"] img').src.endsWith('${id}-${mode}-thumb.webp')`));
  assert(await run(`(async()=>{const full=new Image(),thumb=new Image();full.src='assets/studio-backgrounds/${id}-${mode}.webp';thumb.src='assets/studio-backgrounds/${id}-${mode}-thumb.webp';await Promise.all([full.decode(),thumb.decode()]);return full.naturalWidth===1920&&full.naturalHeight===1080&&thumb.naturalWidth===360})()`));
  if(id==='cosmic-orbit')await b.screenshot(`.tools/soft-backgrounds-review/cosmic-${mode}.webp`);
  }
 }
 await run('TikInteractStudioDesign.setSkin("signal")');assert.equal(await run('document.querySelectorAll("button[data-studio-background]").length'),12,'Appearance rerender retains new choices');
 await run('localStorage.setItem("tikinteract_studio_background_v1_live",JSON.stringify({id:"moonlit-lake",color:"#112233"}));localStorage.setItem("tikinteract_studio_background_v1_ai",JSON.stringify({id:"alpine-valley",color:"#334455"}))');
 await b.page('Page.reload');await b.waitFor(ready);
 assert.equal(await run('TikInteractStudioBackgrounds.get("live").id'),'arcade-hub');assert.equal(await run('TikInteractStudioBackgrounds.get("ai").id'),'crystal-world');
 assert.equal(await run('TikInteractStudioBackgrounds.get("live").color'),'#112233');
 await run('localStorage.setItem("tikinteract_studio_background_v1_live",JSON.stringify({id:"ruby-arena"}));localStorage.setItem("tikinteract_studio_background_v1_ai",JSON.stringify({id:"neon-city"}))');
 await b.page('Page.reload');await b.waitFor(ready);
 assert.equal(await run('TikInteractStudioBackgrounds.get("live").id'),'stardust');assert.equal(await run('TikInteractStudioBackgrounds.get("ai").id'),'arcade-hub');
 for(const mode of ['light','dark']){
  await run(`TikInteractAppearance.set({mode:'${mode}'})`);
  const logo=await run('(()=>{const word=getComputedStyle(document.querySelector(".studio-page-signature .ti-brand-name")),caption=getComputedStyle(document.querySelector(".studio-signature-caption"));return{filter:word.filter,captionFilter:caption.filter,color:word.color,shadow:word.textShadow}})()');
  assert.equal(logo.color,mode==='light'?'rgb(16, 16, 20)':'rgb(244, 244, 247)');
  assert.equal(logo.shadow,'none');if(mode==='light'){assert.equal(logo.filter,'none');assert.equal(logo.captionFilter,'none');}else assert(!logo.filter.includes('255, 255, 255'));
 }
 await run('TikInteractStudioBackgrounds.set("cosmic-orbit");TikInteractStudioBackgrounds.set("stardust","ai")');await b.page('Page.reload');await b.waitFor(ready);assert.equal(await run('TikInteractStudioBackgrounds.get("live").id'),'cosmic-orbit');assert.equal(await run('TikInteractStudioBackgrounds.get("ai").id'),'stardust');
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await run('dispatchEvent(new Event("resize"));document.querySelector("[data-design-palette-toggle]").click()');
 assert(await run('(()=>{const r=document.querySelector("[data-design-palette-panel]").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1})()'));
 assert(await run('document.documentElement.scrollWidth<=innerWidth+1'));assert.deepEqual(b.errors,[]);
 console.log('PASS: 12 backgrounds, 4 cartoon/cosmic wallpapers with native Light/Dark images and thumbnails, no color filters on paired art, preserved legacy selections, metallic finishes, separate LIVE/AI persistence and mobile bounds.');
}finally{await b.close()}
