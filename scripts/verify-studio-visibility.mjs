import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
import {DEFAULT_CONFIG} from '../assets/platform-schema.js';
const origin='http://127.0.0.1:3025',key='__qa_studio_visibility_config',dir='.tools/studio-visibility-review';
const server=spawn('python',['-m','http.server','3025','--bind','127.0.0.1'],{windowsHide:true,stdio:'ignore'});await new Promise(r=>setTimeout(r,600));
const b=await openSkyShiftBrowser('studio-visibility-review'),run=e=>b.evaluate(e);
const click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
async function admin(){await b.page('Page.navigate',{url:origin+'/admin.html'});await b.waitFor('document.getElementById("admin-app")?.hidden===false');await click('[data-admin-tab=studio]');}
async function studio(){await b.page('Page.navigate',{url:origin+'/live-studio.html'});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"');}
async function publish(){const revision=await run(`JSON.parse(localStorage.getItem('${key}')).publishedRevision`);await click('#admin-publish');await click('[data-confirm-publish]');await b.waitFor(`JSON.parse(localStorage.getItem('${key}')).publishedRevision>${revision}`);}
try{
 await mkdir(dir,{recursive:true});
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);'+`
  const initial=${JSON.stringify(DEFAULT_CONFIG)},key=${JSON.stringify(key)};
  const read=()=>JSON.parse(localStorage.getItem(key)||'null')||{role:'owner',draft:initial,published:initial,revision:0,publishedRevision:0,history:[]};
  const c=window.supabase.createClient(),base=c.rpc.bind(c);
  c.auth.getUser=async()=>({data:{user:(await c.auth.getSession()).data.session?.user},error:null});
  c.rpc=async(name,args={})=>{
   if(name==='get_site_admin_state')return{data:read(),error:null};
   if(name==='save_site_config'){const s=read();if(args.p_revision!==s.revision)return{error:{message:'CONFIG_CONFLICT'}};s.draft=args.p_config;s.revision++;if(args.p_publish){s.published=args.p_config;s.publishedRevision=s.revision;}localStorage.setItem(key,JSON.stringify(s));return{data:s,error:null};}
   if(name==='get_my_account_status')return{data:{allowed:true,state:'active'},error:null};
   if(name==='site_admin_role')return{data:'owner',error:null};
   if(name==='get_my_access')return{data:{plan:'free',periods:[],serverNow:new Date().toISOString()},error:null};
   if(name==='list_support_tickets')return{data:{items:[],total:0,stats:{unread:0,open:0,pending:0,resolved:0}},error:null};
   return base(name,args);
  };
  const fetchOriginal=window.fetch.bind(window);
  window.fetch=(url,options)=>String(url).includes('/rpc/get_site_public_config')?Promise.resolve(Response.json({config:read().published,revision:read().publishedRevision})):fetchOriginal(url,options);
 `});
 await b.page('Page.navigate',{url:origin+'/admin.html'});await b.waitFor('document.getElementById("admin-app")?.hidden===false');
 await run(`localStorage.removeItem('${key}')`);await admin();
 assert.equal(await run('document.querySelectorAll("[data-studio-visibility]").length'),6);
 await click('[data-studio-visibility=animations]');await click('#admin-save');
 await b.waitFor(`JSON.parse(localStorage.getItem('${key}'))?.draft.studio.visibility.animations===false`);
 await studio();assert(await run('!!document.getElementById("studio-animations-tab").getClientRects().length'),'Draft does not hide live tab');
 await admin();await publish();await studio();
 assert.equal(await run('document.getElementById("studio-animations-tab").getClientRects().length'),0);
 await run('setLiveStudioTab("animations")');assert.equal(await run('document.getElementById("studio-animations-tab").getAttribute("aria-selected")'),'false');
 assert.equal(await run('!!document.querySelector(".an-heading")'),false,'Hidden demo cannot lazy-load through navigation');
 await admin();await click('[data-studio-visibility=animations]');await publish();await studio();await click('#studio-animations-tab');
 await b.waitFor('!!document.querySelector(".an-heading")');

 // All sections can be hidden without locking the owner out of their account.
 await admin();await run('document.querySelectorAll("[data-studio-visibility]").forEach(e=>{if(e.checked)e.click()})');await publish();await studio();
 assert.equal(await run('document.getElementById("studio-navigation-empty").hidden'),false);
 assert.equal(await run('Array.from(document.querySelectorAll(".studio-app-nav [data-studio-tab],.sw-rail-footer>*")).filter(e=>e.getClientRects().length).length'),0);
 await run('TikInteractCreator.openAccountSection("profile")');await b.waitFor('window.TikInteractStudioWindows?.getView()==="account"');
 assert(await run('!!document.getElementById("studio-account-avatar").getClientRects().length'));
 await run(`(()=>{const s=JSON.parse(localStorage.getItem('${key}'));s.published.studio.visibility.games=true;s.revision++;s.publishedRevision=s.revision;localStorage.setItem('${key}',JSON.stringify(s));})()`);
 await run('TikInteractPlatform.refresh()');assert.equal(await run('TikInteractStudioWindows.getView()'),'account','Configuration refresh preserves account dialog');
 assert.equal(await run('document.getElementById("game-center-tab").getAttribute("aria-selected")'),'true');

 // Restore through Admin; layout reset must keep independent visibility choices.
 await admin();await click('[data-reset-studio]');assert.equal(await run('document.querySelector("[data-studio-visibility=animations]").checked'),false);
 await run('document.querySelectorAll("[data-studio-visibility]").forEach(e=>{if(!e.checked)e.click()})');await publish();
 for(const [width,mode,language]of [[1366,'dark','ro'],[390,'light','en']]){
  await run(`localStorage.setItem('tikinteract_mode',${JSON.stringify(mode)});localStorage.setItem('tikinteract_language',${JSON.stringify(language)})`);
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
  await admin();assert(await run('document.documentElement.scrollWidth<=innerWidth'));await b.screenshot(`${dir}/admin-${width}-${mode}.webp`);
  await studio();assert.equal(await run('document.querySelectorAll(".studio-app-nav [data-studio-nav-hidden]").length'),0);await b.screenshot(`${dir}/studio-${width}-${mode}.webp`);
  await run('loadLiveGame("nova-vex")');const game=await run('document.getElementById("live-game-frame").src');
  await run(`(()=>{const s=JSON.parse(localStorage.getItem('${key}'));s.published.studio.visibility.studio=false;s.revision++;s.publishedRevision=s.revision;localStorage.setItem('${key}',JSON.stringify(s));})()`);
  await run('TikInteractPlatform.refresh()');assert.equal(await run('document.getElementById("game-center-tab").getAttribute("aria-selected")'),'true');assert.equal(await run('document.getElementById("live-game-frame").src'),game);
  await run(`(()=>{const s=JSON.parse(localStorage.getItem('${key}'));s.published.studio.visibility.studio=true;s.revision++;s.publishedRevision=s.revision;localStorage.setItem('${key}',JSON.stringify(s));})()`);
 }
 assert.deepEqual(b.errors,[]);
 console.log('Passed: six independent switches; draft/save/publish; animations hide/re-enable and lazy-load guard; all-hidden fallback; account/admin access retained; active-game iframe preserved; live refresh, layout reset, RO/EN desktop/mobile and Dark/Light. Existing JSON RPC persistence, isolated local fixtures only.');
}catch(error){await b.screenshot(dir+'/failure.webp');console.log(b.errors);throw error;}finally{await b.close();server.kill();}
