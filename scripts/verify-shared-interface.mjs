import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
const server=spawn('python',['-m','http.server','3019','--bind','127.0.0.1'],{windowsHide:true,stdio:'ignore'});
await new Promise(r=>setTimeout(r,700));const b=await openSkyShiftBrowser('shared-interface-review'),run=e=>b.evaluate(e),dir='.tools/shared-interface-review';
const settle=()=>run('document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,220)))');
const root='http://127.0.0.1:3019';
const header=()=>run(`(()=>{const h=document.querySelector('.ti-site-header'),get=(s,properties)=>{const c=getComputedStyle(h.querySelector(s));return Object.fromEntries(properties.map(p=>[p,c[p]]))};return{brand:get('.ti-brand-name',['fontFamily','fontSize','fontWeight','letterSpacing','color']),accent:get('.ti-brand-name>span',['color']),tagline:get('.ti-brand-tagline',['fontFamily','fontSize','fontWeight','letterSpacing','color','display']),nav:get('[data-nav-item=catalog]',['fontFamily','fontSize','fontWeight','padding','height']),studio:get('.open-studio-button',['fontFamily','fontSize','fontWeight','padding','height','borderRadius'])}})()`);
try{
 await mkdir(dir,{recursive:true});
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);const c=window.supabase.createClient(),r=c.rpc.bind(c);c.rpc=async(n,...a)=>n==="get_my_account_status"?{data:{allowed:true,state:"active"},error:null}:n==="get_my_access"?{data:{plan:"free",periods:[],serverNow:new Date().toISOString()},error:null}:r(n,...a);const f=window.fetch.bind(window);window.fetch=(u,o)=>String(u).includes("/rest/v1/rpc/")?Promise.resolve(new Response("{}",{status:200,headers:{"Content-Type":"application/json"}})):f(u,o);'});
 for(const {width,mode,language} of [{width:1440,mode:'dark',language:'ro'},{width:390,mode:'light',language:'en'},{width:320,mode:'dark',language:'ro'}]){
  const seed=await b.page('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('tikinteract_mode',${JSON.stringify(mode)});localStorage.setItem('tikinteract_language',${JSON.stringify(language)});`});
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});let baseline;
  for(const path of ['index.html','GAME/NEON-INTERACT/index.html','GAME/MOTO-INTERACT/index.html','GAME/NOVA-VEX/index.html','guide.html','privacy-policy.html','404.html']){
   await b.page('Page.navigate',{url:root+'/'+path});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"');await settle();
   const actual=await header();baseline ||= actual;assert.deepEqual(actual,baseline,'Public header mismatch: '+path);
   assert.equal(await run('document.querySelectorAll(".ti-site-header").length'),1);
   assert.equal(await run('document.querySelectorAll(".game-page-nav").length'),0);
   if(path.startsWith('GAME/')){
    const back=await run(`(()=>{const e=document.querySelector('.game-presentation-back'),r=e?.getBoundingClientRect();return e?{text:e.textContent.trim(),href:new URL(e.href).pathname+new URL(e.href).search,visible:r.width>0&&r.height>0}:null})()`);
    assert.deepEqual(back,{text:language==='en'?'Back to games':'Înapoi la jocuri',href:'/index.html?view=catalog',visible:true},'Game back button '+path);
   }
   assert(await run('document.documentElement.scrollWidth<=innerWidth'),'Overflow '+path);
   await b.screenshot(dir+'/'+path.replaceAll('/','-')+'-'+width+'-'+mode+'.webp');
   if(path==='GAME/MOTO-INTERACT/index.html'){
    await run('document.querySelector(".game-presentation-back").click()');
    await b.waitFor('location.pathname==="/index.html"&&location.search==="?view=catalog"&&document.documentElement?.dataset.uiReady==="ready"');
    assert(await run('!!document.querySelector("#view-catalog")?.getClientRects().length'),'Back button opens catalog');
   }
  }
  await b.page('Page.navigate',{url:root+'/admin.html'});await b.waitFor('document.readyState==="complete"');await settle();
  assert(await run('Array.from(document.querySelectorAll(".admin-brand")).every(e=>e.querySelector(".ti-home-wordmark")&&!e.querySelector(".ti-symbol"))'));
  await b.screenshot(dir+'/admin-'+width+'-'+mode+'.webp');
  await b.page('Page.navigate',{url:root+'/live-studio.html'});await b.waitFor('document.documentElement?.dataset.uiReady==="ready"');
  for(const [tab,selector]of [['studio','.studio-quick-search'],['games','.game-center-search'],['audio','.audio-search']]){
   await run(`setLiveStudioTab(${JSON.stringify(tab)})`);await settle();
   const actual=await run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),s=getComputedStyle(e),i=getComputedStyle(e.querySelector('input'));return{height:s.height,radius:s.borderRadius,font:i.fontSize,background:i.backgroundColor}})()`);
   assert.deepEqual(actual,{height:'40px',radius:'10px',font:'12px',background:'rgba(0, 0, 0, 0)'},'Search style '+tab);
  }
  assert.equal(await run('getComputedStyle(document.getElementById("audio-sound-category")).height'),'40px');
  assert.equal(await run('getComputedStyle(document.getElementById("audio-filter-favorites")).height'),'36px');
  await b.waitFor('!!document.querySelector(".audio-sound-favorite")');
  assert.equal(await run('getComputedStyle(document.querySelector(".audio-sound-favorite")).width'),'24px');
  await b.screenshot(dir+'/audio-'+width+'-'+mode+'.webp');
  await b.page('Page.removeScriptToEvaluateOnNewDocument',{identifier:seed.identifier});
 }
 assert.deepEqual(b.errors,[]);
 console.log('Shared public header has matching fonts, colors, logo, slogan and buttons across homepage, 3 games, guide, privacy and 404 on desktop/mobile and Dark/Light. Admin wordmark updated. Studio search fields 40px/10px/12px, category 40px, filter buttons 36px and favorites 24px. No JS exceptions or horizontal overflow.');
}catch(error){await b.screenshot(dir+'/failure.webp');console.log(b.errors);throw error;}finally{await b.close();server.kill();}
