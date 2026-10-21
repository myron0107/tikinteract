// Real native menus, with a disposable PostgreSQL backend. Never contacts a real LIVE.
import assert from'node:assert/strict';
import{mkdir,readFile,writeFile}from'node:fs/promises';
import{openSkyShiftBrowser}from'./skyshift-browser.mjs';
import{installQAAuth}from'./qa-auth-fixture.mjs';
import{createAdminQABridge}from'./qa-admin-database.mjs';
const origin=process.env.MEDIA_ROOT||'http://127.0.0.1:3010';if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local QA only');
const dir='.tools/overlay-themes';await mkdir(dir,{recursive:true});const bridge=await createAdminQABridge(origin,{creator:true});
const catalog=JSON.parse(await readFile('assets/tiktok-gifts-catalog.json','utf8')),gift=catalog.gifts[0];
await bridge.db.query("insert into public.streamer_profiles(user_id,tiktok_username,tiktok_display_name) values($1,'qa.theme','QA Theme')",[bridge.ids.owner]);
const session=(await bridge.db.query("insert into public.streamer_live_sessions(user_id,tiktok_username) values($1,'qa.theme') returning id",[bridge.ids.owner])).rows[0].id;
await bridge.db.query("insert into public.streamer_gift_collection_events(event_id,session_id,user_id,gift_id,gift_name,gift_image,quantity,unit_coins,coins,sender) values(gen_random_uuid(),$1,$2,$3,$4,$5,3,5,15,'QA viewer')",[session,bridge.ids.owner,String(gift.id),gift.name,gift.image]);
async function rpc(name,args={}){const r=await(await fetch(bridge.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,role:'owner'})})).json();if(r.error)throw Error(r.error.message);return r.data;}
const ticket=await rpc('create_support_ticket',{p_topic:'bug',p_subject:'Disposable theme verification',p_body:'This message only exists in the temporary local verification database.',p_area:'LIVE Studio',p_request_id:crypto.randomUUID()});
await rpc('send_support_message',{p_ticket:ticket.ticket.id,p_body:'A local test reply to check the private conversation colors.',p_internal:false,p_request_id:crypto.randomUUID()});
function hook(url){const c=window.supabase.createClient(),fetcher=fetch.bind(window);c.rpc=async(name,args={})=>(await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,role:'owner'})})).json();c.auth.getUser=async()=>({data:{user:(await c.auth.getSession()).data.session?.user},error:null});}
// Resolve actual text/background colors, including alpha-blended parent surfaces.
function audit(selector){
 const root=document.querySelector(selector),rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const blend=(front,back)=>{const a=front[3]??1;return front.slice(0,3).map((v,i)=>v*a+back[i]*(1-a));};
 function background(el){const parents=[];for(let p=el;p;p=p.parentElement)parents.unshift(p);let bg=[255,255,255];for(const p of parents){const css=getComputedStyle(p);if(css.backgroundImage!=='none')return null;bg=blend(rgb(css.backgroundColor),bg);}return bg;}
 return[...root.querySelectorAll('h1,h2,h3,h4,p,span,small,label,button,a,strong,time,dt,dd,code')].filter(el=>!el.childElementCount&&el.textContent.trim()&&el.getClientRects().length&&!el.closest('[hidden],:disabled,[aria-hidden=true]')).flatMap(el=>{const bg=background(el);if(!bg)return[];const fg=blend(rgb(getComputedStyle(el).color),bg),ratio=(Math.max(lum(bg),lum(fg))+.05)/(Math.min(lum(bg),lum(fg))+.05);return ratio<4.45?[{text:el.textContent.trim().slice(0,70),tag:el.tagName,class:el.className,color:getComputedStyle(el).color,background:bg,ratio:+ratio.toFixed(2)}]:[];});
}
const b=await openSkyShiftBrowser('overlay-theme-check'),report={};
const run=e=>b.evaluate(e),settle=()=>run('document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,100)))');
async function page(path){await b.page('Page.navigate',{url:origin+'/'+path});await b.waitFor('document.readyState==="complete"&&!!window.TikInteractAppearance');await settle();}
async function check(name,selector){await settle();report[name]=await run('('+audit.toString()+')('+JSON.stringify(selector)+')');await b.screenshot(dir+'/'+name+'.webp');}
try{
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);('+hook.toString()+')('+JSON.stringify(bridge.url)+');'});
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await page('index.html');
 for(const mode of['light','dark']){
  await run('TikInteractAppearance.set('+JSON.stringify(mode)+');document.querySelector(".resources-trigger").scrollIntoView({block:"center"});document.querySelector(".resources-trigger").click()');await check('resources-'+mode,'#resources-menu');
  await run('document.querySelector("[data-open-support]").click()');await b.waitFor('!!document.querySelector("#site-support .support-topic")');await check('support-topics-'+mode,'#site-support');
  await run('document.querySelector("[data-support-topic=bug]").click();document.getElementById("support-message").value="Keep this draft while switching appearances."');await check('support-form-'+mode,'#site-support');
  await run('TikInteractAppearance.set('+JSON.stringify(mode==='light'?'dark':'light')+')');assert.equal(await run('document.getElementById("support-message").value'),'Keep this draft while switching appearances.');await check('support-form-live-switch-'+mode,'#site-support');
  await run('TikInteractAppearance.set('+JSON.stringify(mode)+');document.querySelector("[data-support-view=inbox]").click()');await b.waitFor('!!document.querySelector(".si-ticket")');await run('document.querySelector(".si-ticket").click()');await b.waitFor('!!document.querySelector(".si-message")');await check('support-conversation-'+mode,'#site-support');
  await run('document.getElementById("site-support").close();TikInteractGifts.openCollection({tiktok_username:"qa.theme",tiktok_display_name:"QA Theme"})');await b.waitFor('!!document.querySelector(".gifts-dialog .gift-card")');await check('gift-collection-'+mode,'.gifts-dialog');
  await run('document.querySelector("[data-gift-dialog-view=recent]").click()');await check('gift-recent-'+mode,'.gifts-dialog');await run('document.querySelector(".gifts-dialog").close();openCookiePreferences()');await check('cookies-'+mode,'.cookie-preferences-dialog');await run('closeCookiePreferences()');
 }
 for(const width of[1440,390,320]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  for(const mode of['light','dark']){await run('TikInteractAppearance.set('+JSON.stringify(mode)+')');
   const separators=await run('[...document.querySelectorAll("#view-home .public-section")].map(el=>({id:el.id,top:getComputedStyle(el).borderTopWidth,bottom:getComputedStyle(el).borderBottomWidth}))');
   assert(separators.every(s=>s.id==='how-it-works'?s.top==='1px'&&s.bottom==='1px':s.top==='0px'&&s.bottom==='0px'));
   await run('window.scrollTo(0,document.body.scrollHeight)');await b.screenshot(dir+'/footer-'+width+'-'+mode+'.webp');
   const footer=await run('(()=>{const f=document.querySelector(".site-footer").getBoundingClientRect(),p=document.querySelector(".footer-copyright").getBoundingClientRect();return{left:f.left,text:p.left,height:f.height}})()');assert(Math.abs(footer.left-footer.text)<2,'Copyright aligned left');assert(footer.height<(width>600?85:125),'Compact footer');
   assert.equal(await run('document.documentElement.scrollWidth>innerWidth+1'),false);
  }
 }
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await page('live-studio.html');await b.waitFor('document.body.classList.contains("studio-modern")&&!document.body.classList.contains("studio-locked")');
 for(const theme of['burgundy','blue'])for(const mode of['light','dark']){
  await run('TikInteractAppearance.set('+JSON.stringify({theme,mode})+');setLiveStudioTab("gifts")');await b.waitFor('document.querySelectorAll("#tiktok-gifts-panel .gift-card").length>0');await check('studio-gifts-'+theme+'-'+mode,'#tiktok-gifts-panel');
  await run('TikInteractGifts.openCollection({tiktok_username:"qa.theme",tiktok_display_name:"QA Theme"})');await b.waitFor('!!document.querySelector(".gifts-dialog .gift-card")');await check('studio-collection-'+theme+'-'+mode,'.gifts-dialog');await run('document.querySelector(".gifts-dialog").close()');
  for(const tab of['audio','account','help']){await run('setLiveStudioTab('+JSON.stringify(tab)+')');await settle();assert.equal(await run('document.documentElement.scrollWidth>innerWidth+1'),false);}
 }
 for(const mode of['light','dark']){await run('TikInteractAppearance.set('+JSON.stringify(mode)+');setLiveStudioTab("studio");openStudioHelp()');await check('tutorial-'+mode,'#studio-tour-tooltip');await run('closeStudioHelp()');}
 for(const width of[390,320]){await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:true});await run('TikInteractLanguage.set("en");setLiveStudioTab("gifts")');await check('mobile-gifts-'+width,'#tiktok-gifts-panel');await run('TikInteractCreator.openAccountSection("subscription");document.querySelector("[data-open-support]").click()');await b.waitFor('!!document.querySelector(".support-topic")');await check('mobile-support-'+width,'#site-support');await run('document.getElementById("site-support").close()');assert.equal(await run('document.documentElement.scrollWidth>innerWidth+1'),false);}
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await page('index.html');await run('__qaSignOut()');
 for(const mode of['light','dark']){await run('TikInteractAppearance.set('+JSON.stringify(mode)+');document.querySelector("[data-open-support]").click()');await b.waitFor('!!document.querySelector(".support-login-notice")');await check('support-guest-'+mode,'#site-support');await run('document.getElementById("site-support").close();openAuthModal()');await check('login-'+mode,'#auth-modal');await run('closeAuthModal();document.querySelector(".language-trigger").click()');await check('language-'+mode,'.language-menu');await run('document.querySelector(".language-trigger").click()');}
 await page('GAME/MOTO-INTERACT/index.html');await run('document.querySelector("[data-gallery-open]").click()');
 for(const mode of['light','dark']){await run('TikInteractAppearance.set('+JSON.stringify(mode)+')');await check('game-gallery-'+mode,'.game-gallery-dialog');}
 assert.deepEqual(b.errors,[]);await writeFile(dir+'/contrast.json',JSON.stringify(report,null,2));
 const failures=Object.fromEntries(Object.entries(report).filter(([,issues])=>issues.length));assert.deepEqual(failures,{},'Readable menu and dialog text in every checked appearance');console.log('Support topics/forms/private thread, gift catalog/collection/recent, appearance switching without lost drafts, tutorial, cookies, footer and separators passed.');
}catch(e){console.log('Runtime errors:',b.errors);await writeFile(dir+'/contrast.json',JSON.stringify(report,null,2));await b.screenshot(dir+'/failure.webp');throw e;}finally{await b.close();await bridge.close();}
