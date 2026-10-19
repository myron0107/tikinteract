// Offline fixed-step rendering prevents capture stalls from becoming frozen video frames.
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const root=process.env.MEDIA_ROOT||'http://127.0.0.1:3003';
const ffmpeg=process.env.MEDIA_FFMPEG||'.tools/video/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const b=await openSkyShiftBrowser('fixed-step-preview-clips'),fps=30,report=[];
async function render(id,count,expression) {
 const dir='.tools/game-media/'+id+'-frames-v2';await mkdir(dir,{recursive:true});
 for(let frame=0;frame<count;frame++){
  const uri=await b.evaluate(`(()=>{const frame=${frame};${expression};return window.previewCanvas.toDataURL('image/jpeg',.94).split(',')[1]})()`);
  await writeFile(dir+'/'+String(frame).padStart(5,'0')+'.jpg',Buffer.from(uri,'base64'));
  if(frame%150===0)console.log(id+': '+frame+'/'+count+' frames');
 }
 const file='assets/game-gallery/'+id+'-preview-v2.mp4';
 const nova=id==='nova-vex';
 const r=spawnSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-framerate',String(fps),'-i',dir+'/%05d.jpg','-frames:v',String(count),...(nova?['-vf','scale=720:1280']:[]),'-an','-c:v','libx264','-preset','medium','-crf',nova?'22':'21','-maxrate',nova?'2200k':'3500k','-bufsize',nova?'4400k':'7000k','-g','60','-pix_fmt','yuv420p','-movflags','+faststart',file],{windowsHide:true,encoding:'utf8'});
 if(r.status!==0)throw Error(r.stderr);report.push({id,file,frames:count,fps,duration:count/fps});console.log('Encoded '+file);
}
try {
 await b.page('Emulation.setDeviceMetricsOverride',{width:564,height:1030,deviceScaleFactor:1,mobile:false});
 await b.page('Page.navigate',{url:root+'/GAME/NEON-INTERACT/Neon-Interact.html'});
 await b.waitFor('!!document.querySelector("#redTelemetry")?.style.left');
 await b.evaluate(`(async()=>{
  const {NeonRace2}=await import('/assets/neon-race2-engine.js');
  const {createNightRenderer}=await import('/assets/neon-race2-renderer.js?v=8');
  window.previewCanvas=document.createElement('canvas');previewCanvas.width=1280;previewCanvas.height=960;
  window.previewRace=new NeonRace2();window.previewRenderer=createNightRenderer(previewCanvas);
  await Promise.all(previewRenderer.images.map(im=>im.complete&&im.naturalWidth?Promise.resolve():new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject})));
  window.requestAnimationFrame=()=>0;await new Promise(r=>setTimeout(r,50));
 })()`);
 await render('neon-interact',360,`if(frame===30)previewRace.contribute(0,'gift',500);if(frame===165)previewRace.contribute(1,'gift',500);previewRace.step(1/30);previewRenderer.draw(previewRace,(frame+1)/30,{effectsTime:(frame+1)/30,reduced:false})`);
 await b.page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:2,mobile:false});
 await b.page('Page.navigate',{url:root+'/GAME/NOVA-VEX/Neon-Ascent.html?qa'});
 await b.waitFor('!!window.__neonAscent&&document.getElementById("loading").hidden');
 await b.evaluate(`(async()=>{
  window.g=__neonAscent;g.control({action:'session.panic'});g.control({action:'session.resume'});
  g.sim.setSettings({autoplay:true,backgroundTheme:'earth',soundEnabled:false,musicEnabled:false,showContributors:false});g.teleport(100);
  window.previewCanvas=document.getElementById('scene');window.requestAnimationFrame=()=>0;await new Promise(r=>setTimeout(r,50));
 })()`);
 await render('nova-vex',600,`const powers={90:'cloud',210:'anvil',330:'meteor',495:'cloud'};if(powers[frame])g.action({action:powers[frame],amount:1,commandId:'preview-v2-'+frame,actor:{username:'demo'}});for(let step=0;step<4;step++)g.sim.step();g.renderer.render(g.sim,1,1/30)`);
 await writeFile('.tools/game-media/fixed-step-report.json',JSON.stringify(report,null,2));
} finally {await b.close();}
