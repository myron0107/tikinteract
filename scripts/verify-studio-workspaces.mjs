// Local browser + PostgreSQL fixtures only: no real account, LIVE or paid AI.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createAnimationFixture} from '../tests/helpers/animations-fixture.mjs';
import {createAnimationService} from '../lib/animations-service.js';
import {handleAnimationRequest} from '../lib/animations-http.js';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {studioFixtureBootstrap} from './studio-preview-bootstrap.mjs';
const runId=crypto.randomUUID(),localPreview=process.env.QA_STUDIO_PREVIEW==='1';
const origin='http://127.0.0.1:3033',folder='.tools/studio-workspaces-review',f=await createAnimationFixture({origin});
await f.db.exec(await readFile('supabase/studio-workspaces.sql','utf8'));
await f.db.exec(await readFile('supabase/animations-studios.sql','utf8'));
const other='10000000-0000-0000-0000-000000000002';await f.db.exec(`insert into auth.users values('${other}')`);await f.grant(500);
await f.db.exec(`create function public.site_admin_role() returns text language sql stable as $$select case when auth.uid()='${f.user.id}' then 'owner' else null end$$`);
const video=crypto.randomUUID(),image=crypto.randomUUID();
for(const [id,mime,kind,bytes]of [[video,'video/mp4','upload',f.video],[image,'image/jpeg','character',f.image]]){
 const file=`${f.user.id}/${id}.${mime==='video/mp4'?'mp4':'jpg'}`;f.files.set(file,bytes);
 await f.store.insert('animation_media',{id,user_id:f.user.id,path:file,mime,bytes:bytes.length,title:kind==='upload'?'Shared video':'AI character',world:'cyberpunk',format:'9:16',kind,ready:true});
}
f.store.usage=(u,test)=>f.store.rpc('animation_account_usage',{p_user:u,p_test:test});
f.store.authenticate=async r=>({id:r.headers.get('x-qa-user')||f.user.id,email:'fixture@example.invalid'});
const service=createAnimationService({store:f.store,provider:f.provider,approved:false,siteUrl:process.env.QA_PUBLIC_SITE_URL||origin});
const authSource=studioFixtureBootstrap(f.user,runId,{preview:localPreview});
let queue=Promise.resolve();const serial=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.ttf':'font/ttf','.webp':'image/webp','.avif':'image/avif','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.json':'application/json'};
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,origin);
 if(u.pathname==='/__layout'){
  const chunks=[];for await(const c of req)chunks.push(c);const {name,args,user}=JSON.parse(Buffer.concat(chunks));
  assert(['studio_layout_list','studio_layout_save','studio_layout_select','studio_layout_delete','studio_layout_context','studio_layout_publish_default'].includes(name));assert([f.user.id,other].includes(user));
  const result=await serial(()=>f.db.transaction(async db=>{await db.exec(`set local role authenticated;set local request.jwt.claim.sub='${user}'`);const keys=Object.keys(args);return(await db.query(`select public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) as data`,Object.values(args).map(v=>typeof v==='object'?JSON.stringify(v):v))).rows[0];}));
  res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(result));return;
 }
 if(u.pathname==='/__media'){const file=u.searchParams.get('path'),bytes=f.files.get(file);res.writeHead(bytes?200:404,{'Content-Type':file.endsWith('.mp4')?'video/mp4':'image/jpeg'}).end(bytes);return;}
 if(u.pathname.startsWith('/api/animations')){
  const chunks=[];for await(const c of req)chunks.push(c);
  const r=await serial(()=>handleAnimationRequest(new Request(u,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),{service,store:f.store}));
  res.writeHead(r.status,Object.fromEntries(r.headers)).end(await r.text());return;
 }
 const file=path.resolve('.','.'+decodeURIComponent(u.pathname));if(!file.startsWith(path.resolve('.')+path.sep)){res.writeHead(403).end();return;}
 if(localPreview&&(!mime[path.extname(file)]||u.pathname.split('/').some(p=>p.startsWith('.')))){res.writeHead(404).end();return;}
 let bytes=await readFile(file);if(localPreview&&u.pathname==='/live-studio.html')bytes=Buffer.from(bytes.toString('utf8').replace('<head>','<head><script>'+authSource+'</script>'));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);
}catch(e){res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:{message:e.message}}));}});
await new Promise(r=>server.listen(3033,'127.0.0.1',r));await mkdir(folder,{recursive:true});
if(localPreview){console.log('LOCAL DESIGN PREVIEW: '+origin+'/live-studio.html');console.log('Isolated test data only. No production account, real LIVE, Stripe or paid AI.');await new Promise(resolve=>process.once('SIGINT',resolve));await new Promise(resolve=>server.close(resolve));await f.db.close();process.exit(0);}
const b=await openSkyShiftBrowser('studio-workspaces-review'),run=e=>b.evaluate(e),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
const rect=s=>run(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.scrollIntoView({block:'center',behavior:'instant'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height*(n.matches(".live-favorite-card")?.8:.5),w:r.width,h:r.height};})()`);
async function drag(selector,dx,dy,check){const r=await rect(selector);await b.page('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',clickCount:1});for(let i=1;i<=12;i++)await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+dx*i/12,y:r.y+dy*i/12,buttons:1});await run('new Promise(requestAnimationFrame)');if(check)await check();await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+dx,y:r.y+dy,button:'left',clickCount:1});}
async function pointerClick(selector){const r=await rect(selector);await b.page('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',clickCount:1});await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x,y:r.y,button:'left',clickCount:1});await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function checkLiveNavigation(){
 for(const [tab,panel] of [['home','studio-home-panel'],['games','game-center-panel'],['audio','audio-center-panel'],['animations','studio-animations-panel'],['studio','live-studio-panel']]){
  await pointerClick(`.studio-app-nav [data-studio-tab="${tab}"]`);
  assert.equal(await run(`document.getElementById('${panel}').classList.contains('hidden')`),false,`Native ${tab} click must keep its panel open`);
  assert.equal(await run(`document.querySelector('.studio-app-nav [data-studio-tab="${tab}"]').getAttribute('aria-selected')`),'true',`Native ${tab} selection must persist`);
  assert.equal(await run('TikInteractWorkspaces.getMode()'),'live');
 }
}
try{
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:authSource});
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await b.page('Page.navigate',{url:origin+'/live-studio.html?workspace=ai'});
 await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!!document.querySelector("#an-prompt")');
 assert.equal(await run('document.querySelectorAll("[data-ai-tab]").length'),5);
 assert.equal(await run('document.querySelector("[data-credit-balance]").textContent'),'500');assert.equal(await run('getComputedStyle(document.getElementById("studio-ai-nav")).display'),'flex');assert.equal(await run('getComputedStyle(document.querySelector(".studio-app-nav")).display'),'none');assert.equal(await run('window.__qaSockets.length'),0,'Direct AI entry must not start local LIVE transport');
 assert.equal(await run('document.getElementById("live-game-frame").getAttribute("src")'),null);
 await pointerClick('.studio-workspace-switch [data-workspace=live]');await checkLiveNavigation();
 await pointerClick('.studio-workspace-switch [data-workspace=ai]');await b.waitFor('!!document.querySelector("#an-prompt")');
 await click('[data-ai-tab=universes]');assert.equal(await run('document.querySelectorAll("[data-an-world]").length'),8);
 await click('[data-ai-tab=library]');assert.equal(await run('document.querySelectorAll(".an-media").length'),2);
 await click('[data-an-action=preview][data-id="'+image+'"]');assert(await run('!!document.querySelector(".an-dialog img.an-full-image")'));await click('[data-an-close]');
 await click('[data-ai-tab=credits]');assert(await run('document.querySelector("#an-pane-credits").textContent.includes("500")'));
 await click('[data-an-open-tab=history]');await click('[data-ai-tab=guide]');await b.waitFor('!!document.querySelector(".ai-guide-grid")');await click('[data-ai-tab=library]');await b.screenshot(folder+'/ai-library.webp');
 await click('[data-an-action=send-live][data-id="'+video+'"]');await b.waitFor('!!document.querySelector("#studio-animations-panel[data-workspace=live] .an-selected-clip")');
 assert.equal(await run('TikInteractWorkspaces.getMode()'),'live');assert.equal(await run('!!document.querySelector("#an-prompt")'),false,'LIVE library must never open AI generator');assert.equal(await run('document.querySelectorAll("[data-an-tab]").length'),2);
 await click('[data-an-action=live-rule][data-id="'+video+'"]');await b.waitFor('!!document.querySelector(".an-dialog[open] select[name=clip]")');assert.equal(await run('document.querySelector("select[name=clip]").value'),video);await click('[data-an-close]');
 await run('TikInteractWorkspaces.open("live")');await b.waitFor('!document.getElementById("live-studio-panel").classList.contains("hidden")');
 await b.waitFor('!document.querySelector("[data-sle=edit]").disabled');
 if(process.env.QA_DESIGN_REVIEW){const {reviewStudioDesign}=await import('./studio-design-review.mjs');await reviewStudioDesign({b,run,click});}
 await run('launchStudioGame("nova-vex")');await b.waitFor('document.getElementById("live-game-frame").contentDocument?.readyState==="complete"&&!!document.getElementById("live-game-frame").contentDocument?.querySelector("canvas")');
 await run('window.__frame=document.getElementById("live-game-frame");__frame.contentWindow.__layoutMarker=crypto.randomUUID();window.__marker=__frame.contentWindow.__layoutMarker;window.__loads=0;__frame.addEventListener("load",()=>__loads++);window.__plays=0;window.playSoundEffect=()=>__plays++;window.__socket=__qaSockets[0]');
 assert.equal(await run('document.getElementById("studio-favorite-animations").hidden'),false,'Favorite animations should be visible in Stream');const rail=await run('document.querySelector(".studio-app-rail").getBoundingClientRect().width');
 await click('[data-sle=edit]');await click('[data-sle=favorites]');await b.waitFor('!!document.querySelector("[data-favorite-kind=audio]")');
 const sounds=await run('Array.from(document.querySelectorAll("[data-favorite-kind=audio]")).slice(0,2).map(n=>n.value)');
 await run(`for(const n of document.querySelectorAll('[data-favorite-kind]')){const wanted=n.dataset.favoriteKind==='games'?n.value==='nova-vex':n.dataset.favoriteKind==='audio'?${JSON.stringify(sounds)}.includes(n.value):n.value==='${video}';if(n.checked!==wanted)n.click();}`);await click('[data-sle-close]');
 const first=await rect('[data-sound-id="'+sounds[0]+'"]'),second=await rect('[data-sound-id="'+sounds[1]+'"]');
 await drag('[data-sound-id="'+sounds[1]+'"]',first.x-second.x,first.y-second.y,async()=>assert.match(await run('document.querySelector("[data-sound-id=\\"'+sounds[1]+'\\"]").style.transform'),/translate3d/));
 assert.deepEqual(await run('TikInteractStudioPersonalization.getFavorites().audio'),sounds.toReversed());assert.equal(await run('__plays'),0);
 await drag('[data-sle-resize=preview]',-65,-70,async()=>assert.match(await run('document.querySelector(".studio-stage").style.width'),/px/));
 await drag('[data-sle-handle=streamer]>i',-200,70,async()=>assert.match(await run('document.querySelector(".studio-connection").style.transform'),/translate3d/));
 const previous=await run('TikInteractStudioPersonalization.getLayout().desktop.find(p=>p.id==="streamer")');assert(previous.x<900);
 await click('[data-sle-hide=controls]');assert(await run('document.getElementById("studio-test-panel").hidden'));
 await click('[data-sle=panels]');await click('[data-show-panel=controls]');await click('[data-sle-close]');assert.equal(await run('document.getElementById("studio-test-panel").hidden'),false);
 await click('[data-sle=save]');await b.waitFor('!TikInteractStudioPersonalization.isEditing()');
 assert.equal(await run('document.getElementById("live-game-frame")===__frame&&__frame.contentWindow.__layoutMarker===__marker&&__loads===0&&__socket.readyState===1'),true,'Layout must preserve iframe and LIVE connection');
 assert.equal(await run('document.querySelector(".studio-app-rail").getBoundingClientRect().width'),rail);
 await click('[data-sle-play="'+video+'"]');for(let i=0;i<30&&(await f.store.list('animation_playback')).length===0;i++)await new Promise(r=>setTimeout(r,100));assert.equal((await f.store.list('animation_playback')).length,1,'Favorite animation enters the existing playback queue');assert.equal(f.calls.length,0);
 const layout=await run('TikInteractStudioPersonalization.getLayout()');assert.equal((await f.db.query('select count(*)::int as n from public.studio_layout_profiles')).rows[0].n,1);
 await click('[data-sle=edit]');await click('[data-sle=publish]');await click('[data-publish-default]');await b.waitFor('!document.querySelector(".sle-dialog").open');await click('[data-sle=cancel]');
 const published=(await f.db.query('select layout,revision from public.studio_layout_default')).rows[0];assert.equal(published.revision,1);assert.deepEqual(published.layout.favorites,{games:[],audio:[],animations:[]});
 await b.screenshot(folder+'/custom-layout.webp');
 await click('[data-sle=edit]');await click('[data-sle=reset]');await click('[data-sle=cancel]');assert.deepEqual(await run('TikInteractStudioPersonalization.getLayout()'),layout);
 await click('[data-sle=new]');await run('document.querySelector("[data-sle-profile-form] input").value="Second layout";document.querySelector("[data-sle-profile-form]").requestSubmit()');await b.waitFor('document.querySelectorAll("[data-sle-profile] option").length===2&&!document.querySelector("[data-sle=edit]").disabled');
 assert.equal(await run('__loads'),0);
 await run(`localStorage.removeItem('tikinteract_layout_v1:${f.user.id}')`);await b.page('Page.reload');await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!document.querySelector("[data-sle=edit]").disabled');
 assert.deepEqual(await run('TikInteractStudioPersonalization.getFavorites().audio'),sounds.toReversed());assert.equal(await run('document.querySelectorAll("[data-sle-profile] option").length'),2);
 for(const width of (process.env.QA_VIEWPORTS?process.env.QA_VIEWPORTS.split(",").map(Number):[1440,768,390,320]))for(const [mode,theme,lang]of [['dark','burgundy','ro'],['light','burgundy','en'],['dark','blue','en'],['light','blue','ro']]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
  await run(`localStorage.setItem('tikinteract_mode','${mode}');localStorage.setItem('tikinteract_brand','${theme}');localStorage.setItem('tikinteract_language','${lang}')`);await b.page('Page.reload');await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!document.querySelector("[data-sle=edit]").disabled');
  assert.equal(await run('document.documentElement.scrollWidth<=innerWidth+1'),true,`STREAM overflow ${width}/${mode}/${theme}`);assert.equal(await run('document.querySelectorAll(".studio-app-nav [data-studio-tab]").length'),5);
  await checkLiveNavigation();
  await b.screenshot(`${folder}/stream-${width}-${mode}-${theme}.webp`);await run('TikInteractWorkspaces.open("ai")');await b.waitFor('!!document.querySelector("#an-prompt")');assert.equal(await run('document.documentElement.scrollWidth<=innerWidth+1'),true,'AI overflow');await b.screenshot(`${folder}/ai-${width}-${mode}-${theme}.webp`);await run('TikInteractWorkspaces.open("live")');
 }
 await run('TikInteractWorkspaces.open("ai",{tab:"generator"})');await b.waitFor('!!document.getElementById("an-prompt")');await run('window.__qaOffline=true');await click('[data-an-action=refresh]');await b.waitFor('!document.getElementById("an-prompt")');assert.equal(await run('document.querySelector("[data-credit-balance]").textContent'),'—');await click('[data-ai-tab=guide]');assert(await run('!!document.querySelector(".ai-guide-grid")'));assert.equal(await run('getComputedStyle(document.getElementById("studio-ai-nav")).display'),'flex');await run('window.__qaOffline=false');await click('[data-an-action=refresh]');await b.waitFor('document.querySelector("[data-credit-balance]").textContent==="500"');
 await run(`localStorage.setItem('qa-user','${other}');__qaSignIn()`);await b.waitFor('document.querySelectorAll("[data-sle-profile] option").length===1&&!document.querySelector("[data-sle=edit]").disabled');
 assert.deepEqual(await run('TikInteractStudioPersonalization.getFavorites()'),{games:[],audio:[],animations:[]});
 assert.deepEqual(await run('TikInteractStudioPersonalization.getLayout().desktop'),published.layout.desktop,'Fresh account inherits platform default');await click('[data-sle=edit]');assert.equal(await run('!!document.querySelector("[data-sle=publish]")'),false,'Normal account cannot publish');await click('[data-sle=cancel]');
 await run('TikInteractWorkspaces.open("ai",{tab:"library"})');await b.waitFor('!!document.querySelector("#an-pane-library")');assert.equal(await run('document.querySelectorAll(".an-media").length'),0,'No shared library across different users');
 assert.deepEqual(f.calls,[]);assert.deepEqual(b.errors,[]);
 console.log('Workspace/editor QA passed: continuous pointer movement/resizing, favorite reorder without playback, iframe/socket preservation, profile persistence, account isolation, 4 themes, RO/EN and desktop/mobile. No paid AI or real LIVE.');
}catch(e){await b.screenshot(folder+'/failure.webp');console.log(b.errors);throw e;}finally{await b.close();await new Promise(r=>server.close(r));await f.db.close();}
