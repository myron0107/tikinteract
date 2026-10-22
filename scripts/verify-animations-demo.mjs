import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
const origin='http://127.0.0.1:3024';
const server=spawn('python',['-m','http.server','3024','--bind','127.0.0.1'],{windowsHide:true,stdio:'ignore'});
await new Promise(r=>setTimeout(r,600));
const browser=await openSkyShiftBrowser('animations-demo-review'),run=e=>browser.evaluate(e),folder='.tools/animations-demo-review';
const ready=()=>browser.waitFor('document.documentElement?.dataset.uiReady==="ready"');
const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
const fill=(selector,value)=>run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
async function tab(id){await click(`[data-an-tab=${id}]`);assert.equal(await run('document.querySelector(".an-tabs [aria-selected=true]").dataset.anTab'),id);}
async function upload(selector,file){const {root}=await browser.page('DOM.getDocument',{});const {nodeId}=await browser.page('DOM.querySelector',{nodeId:root.nodeId,selector});await browser.page('DOM.setFileInputFiles',{nodeId,files:[path.resolve(file)]});}
const noOverflow=async label=>assert(await run('document.documentElement.scrollWidth<=innerWidth'),label+' overflows');
try{
 await mkdir(folder,{recursive:true});
 await browser.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);const c=window.supabase.createClient(),r=c.rpc.bind(c);c.rpc=async(n,...a)=>n==="get_my_account_status"?{data:{allowed:true,state:"active"},error:null}:n==="get_my_access"?{data:{plan:"free",periods:[],serverNow:new Date().toISOString()},error:null}:r(n,...a);'});
 await browser.page('Page.navigate',{url:origin+'/live-studio.html'});await ready();
 await run('localStorage.removeItem("tikinteract_animations_demo_v1:local-layout-test")');
 assert.equal(await run('!!document.querySelector(".an-heading")'),false,'DEMO loads lazily');
 await run('loadLiveGame("nova-vex")');await browser.waitFor('!!document.getElementById("live-game-frame").getAttribute("src")');
 const game=await run('document.getElementById("live-game-frame").src');
 await click('#studio-animations-tab');await browser.waitFor('!!document.querySelector(".an-heading")');
 assert.equal(await run('document.getElementById("live-game-frame").src'),game);
 assert.equal(await run('document.querySelectorAll(".studio-app-nav [data-studio-tab]")[3].dataset.studioTab'),'animations');

 // Photo stays in a blob URL, generation is a clearly labelled prepared clip.
 await upload('#an-photo','assets/animations-demo/vampire-thumb.jpg');
 assert(await run('document.querySelector(".an-upload img").src.startsWith("blob:")'));
 await fill('#an-character','DEMO Hero');await fill('#an-prompt','A purely local test scene.');
 await fill('#an-universe','cyberpunk');await click('[data-an-duration="10"]');await click('[data-an-format="9:16"]');
 await run('document.querySelector("[data-an-form=generate]").requestSubmit()');
 await browser.waitFor('document.querySelector("#an-progress")?.value>0');
 assert.equal(await run('document.querySelector("[data-an-form=generate] fieldset").disabled'),true);
 await click('[data-an-action=cancel]');assert.equal(await run('document.querySelector("[data-an-form=generate] fieldset").disabled'),false);
 await run('document.querySelector("[data-an-form=generate]").requestSubmit()');
 await browser.waitFor('document.querySelector(".an-result")?.hidden===false');
 assert(await run('document.getElementById("an-generator-video").src.endsWith("cyberpunk.webm")'));
 await click('[data-an-action=save-result]');assert.equal(await run('document.querySelector("[data-an-action=save-result]").disabled'),true);
 await tab('library');assert.equal(await run('document.querySelectorAll(".an-media").length'),4);
 await fill('#an-library-search','DEMO Hero');assert.equal(await run('document.querySelectorAll(".an-media").length'),1);
 await click('.an-media [data-an-action=preview]');
 const played=await run(`(async()=>{const v=document.querySelector('.an-dialog video');await v.play();await new Promise(r=>setTimeout(r,300));return v.currentTime>0&&!v.error;})()`);assert(played,'Prepared video plays');
 await click('.an-dialog [data-an-close]');await click('.an-media [data-an-action=fan]');
 await fill('.an-dialog [name=fan]','@demo_fan');await run('document.querySelector("[data-an-dialog-form=fan]").requestSubmit()');
 assert.equal(await run('document.querySelector(".an-fan").textContent'),'@demo_fan');
 await fill('#an-library-search','');await upload('#an-video-file','assets/animations-demo/knights.webm');
 await fill('#an-library-filter','local');assert.equal(await run('document.querySelectorAll(".an-media").length'),1);
 await click('.an-media [data-an-action=preview]');assert(await run('document.querySelector(".an-dialog video").src.startsWith("blob:")'));await click('.an-dialog [data-an-close]');
 await fill('#an-library-filter','all');
 await tab('universes');assert.equal(await run('document.querySelectorAll(".an-world").length'),8);
 await click('[data-an-action=new-world]');await fill('.an-dialog [name=name]','Custom DEMO');await fill('.an-dialog [name=description]','Local custom universe');await fill('.an-dialog [name=base]','anime');await run('document.querySelector("[data-an-dialog-form=world]").requestSubmit()');
 assert.equal(await run('document.querySelectorAll(".an-world").length'),9);
 assert.equal(await run('document.querySelector("[data-an-world][aria-pressed=true] strong").textContent'),'Custom DEMO');
 await tab('events');
 await click('[data-an-action=new-rule]');await fill('.an-dialog [name=type]','manual');await run('document.querySelector("[data-an-dialog-form=rule]").requestSubmit()');
 assert.equal(await run('document.querySelectorAll(".an-rule").length'),4);
 await run('document.querySelectorAll("[data-an-action=test-rule]")[3].click()');
 await browser.waitFor('document.getElementById("an-event-video").currentTime>0');
 await click('[data-an-action=stop-queue]');
 await run('document.querySelector("[data-an-form=simulate]").requestSubmit()');
 assert(await run('document.querySelector("[data-an-now]").textContent.includes("Throne")'));
 assert.equal(await run('document.querySelectorAll("[data-an-queue] li").length'),1);
 await click('[data-an-action=stop-queue]');
 await click('[data-an-action=toggle-rule]');assert.equal(await run('document.querySelector("[data-an-action=toggle-rule]").getAttribute("aria-pressed")'),'false');
 await click('[data-an-action=edit-rule]');await fill('.an-dialog [name=threshold]','3');await run('document.querySelector("[data-an-dialog-form=rule]").requestSubmit()');
 const persisted=await run('JSON.parse(localStorage.getItem("tikinteract_animations_demo_v1:local-layout-test"))');
 assert.equal(persisted.custom.length,1);assert.equal(persisted.library.length,4);assert(!JSON.stringify(persisted).includes('blob:'));
 await browser.page('Page.navigate',{url:origin+'/live-studio.html'});await ready();await click('#studio-animations-tab');await browser.waitFor('!!document.querySelector(".an-heading")');
 assert.equal(await run('!!document.querySelector(".an-upload img")'),false);
 await tab('library');assert.equal(await run('document.querySelectorAll(".an-media").length'),4);
 assert(await run('Array.from(document.querySelectorAll(".an-fan")).some(e=>e.textContent==="@demo_fan")'));

 // Every local example decodes and advances. No AI or remote video is involved.
 for(const id of ['vampire','knights','superhero','galactic','military','fantasy','cyberpunk','anime']){
  assert(await run(`(async()=>{const v=document.createElement('video');v.muted=true;v.src='assets/animations-demo/${id}.webm';document.body.append(v);try{await v.play();await new Promise(r=>setTimeout(r,120));return v.videoWidth===960&&v.currentTime>0&&!v.error;}finally{v.pause();v.remove();}})()`),'Video '+id);
 }
 for(const width of [1366,390])for(const mode of ['dark','light'])for(const brand of ['burgundy','blue'])for(const language of ['ro','en']){
  await browser.page('Emulation.setDeviceMetricsOverride',{width,height:width<700?844:900,deviceScaleFactor:1,mobile:width<700});
  await run(`TikInteractLanguage.set(${JSON.stringify(language)});document.querySelector('[data-studio-theme=${brand}]').click();if(document.documentElement.dataset.mode!==${JSON.stringify(mode)})document.querySelector('[data-mode-toggle]').click();`);
  for(const id of ['generator','universes','library','events']){await tab(id);await noOverflow(width+' '+mode+' '+brand+' '+id);}
  assert.equal(await run('document.querySelector("[data-an-nav-label]").textContent'),language==='en'?'ANIMATIONS':'ANIMAȚII');
  assert.equal(await run('getComputedStyle(document.querySelector(".an-heading")).backgroundColor'),'rgba(0, 0, 0, 0)');
  if(language==='ro'){await run('document.activeElement?.blur()');await browser.screenshot(`${folder}/events-${width}-${mode}-${brand}.webp`);await tab('generator');await run('document.activeElement?.blur()');await browser.screenshot(`${folder}/generator-${width}-${mode}-${brand}.webp`);}
 }
 // Local state is cleared from the displayed module on sign-out.
 await run('__qaSignOut()');assert.equal(await run('document.querySelectorAll(".an-upload img").length'),0);
 assert.deepEqual(browser.errors,[]);
 console.log('Animations DEMO: lazy Studio tab; local photo/video import; cancel/progress/result; actual example playback for all 8 universes; library search/filter/fan assignment; custom universe; rule create/edit/enable/manual test/gift simulation/FIFO queue; account-scoped persistence, reload and sign-out; active game retained. Four themes, RO/EN, desktop/mobile with no overflow or JS errors. No real AI, payment, account or LIVE calls.');
}catch(error){await browser.screenshot(folder+'/failure.webp');console.log(browser.errors);throw error;}
finally{await browser.close();server.kill();}
