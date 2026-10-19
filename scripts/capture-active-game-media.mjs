// Real gameplay only. Isolated browser, test inputs, no LIVE connection or user account.
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const root=process.env.MEDIA_ROOT||'http://127.0.0.1:3003',out='assets/game-gallery',temp='.tools/game-media';
await mkdir(temp,{recursive:true});
const ffmpeg=process.env.MEDIA_FFMPEG||'.tools/video/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const novaOnly=process.argv.includes('--nova-only');
const b=await openSkyShiftBrowser('active-game-media-capture'),entries=novaOnly?JSON.parse(await readFile(temp+'/capture-report.json','utf8')).filter(e=>e.game!=='nova-vex'):[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function encode(args){const r=spawnSync(ffmpeg,['-y','-hide_banner','-loglevel','error',...args],{windowsHide:true,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||'FFmpeg failed');}
async function saveImage(game,mode,label,{canvas=false,detail=false}={}){
 const file=`${game}-${mode}-hd.webp`,thumbnail=`${game}-${mode}-hd-thumb.webp`;
 if(canvas){const uri=await b.evaluate('document.getElementById("raceCanvas").toDataURL("image/webp",.96)');await writeFile(out+'/'+file,Buffer.from(uri.split(',')[1],'base64'));}
 else{const selector=game==='nova-vex'?'#stage':'#shell';const clip=await b.evaluate(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY+${detail?300:0},width:r.width,height:${detail?540:'r.height'},scale:1}})()`);const shot=await b.page('Page.captureScreenshot',{format:'webp',quality:96,clip,captureBeyondViewport:true});await writeFile(out+'/'+file,Buffer.from(shot.data,'base64'));}
 encode(['-i',out+'/'+file,'-vf','scale=360:-2','-c:v','libwebp','-quality','87',out+'/'+thumbnail]);
 entries.push({game,mode,label,file,thumbnail,shape:canvas?'landscape':detail?'square':'portrait'});console.log('Captured '+file);
}
async function record(game,selector,setup){
 await b.evaluate(`(()=>{const c=document.querySelector('${selector}'),stream=c.captureStream(24),chunks=[];const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:7000000});window.__media={rec,stream,chunks};rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.start(250);})()`);
 await setup();
 const data=await b.evaluate('new Promise(resolve=>{const m=window.__media;m.rec.onstop=async()=>{const reader=new FileReader();reader.onload=()=>{m.stream.getTracks().forEach(t=>t.stop());resolve(reader.result.split(",")[1])};reader.readAsDataURL(new Blob(m.chunks,{type:m.rec.mimeType}));};m.rec.stop();})');
 const source=temp+'/'+game+'.webm',video=game+'-preview.mp4';await writeFile(source,Buffer.from(data,'base64'));
 encode(['-i',source,'-an','-c:v','libx264','-preset','medium','-crf','21','-r','24','-pix_fmt','yuv420p','-movflags','+faststart',out+'/'+video]);
 const poster=entries.find(e=>e.game===game&&e.mode===(game==='nova-vex'?'jetpack':'nitro-red'));
 entries.splice(entries.findIndex(e=>e.game===game)+1,0,{game,mode:'preview',label:'În mișcare',type:'video',video,file:poster.file,thumbnail:poster.thumbnail,shape:game==='nova-vex'?'portrait':'landscape'});
 console.log('Recorded '+video);
}
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:564,height:1030,deviceScaleFactor:2,mobile:false});
 for(const [game,folder,filename]of (novaOnly?[]:[['neon-interact','NEON-INTERACT','Neon-Interact.html'],['moto-interact','MOTO-INTERACT','Moto-Interact.html']])){
  await b.page('Page.navigate',{url:`${root}/GAME/${folder}/${filename}`});
  await b.waitFor('!!document.querySelector("#redTelemetry")?.style.left');await b.evaluate('document.fonts.ready');await wait(900);
  await b.evaluate('document.getElementById("raceCanvas").width=1440;document.getElementById("raceCanvas").height=1080;if(document.getElementById("sound").getAttribute("aria-pressed")==="true")document.getElementById("sound").click();document.getElementById("reset").click()');
  await wait(200);await saveImage(game,'overview','Jocul complet');await saveImage(game,'track',game==='moto-interact'?'Bulevardul de zi':'Cursa de noapte',{canvas:true});
  await b.evaluate('document.getElementById("giftValue").value="500";document.querySelector(\'[data-team="0"][data-kind="gift"]\').click()');await wait(750);await saveImage(game,'nitro-red',game==='moto-interact'?'RED pe o roată':'Nitro RED',{canvas:true});
  await b.evaluate('document.getElementById("reset").click();document.querySelector(\'[data-team="1"][data-kind="gift"]\').click()');await wait(750);await saveImage(game,'nitro-blue',game==='moto-interact'?'BLUE pe o roată':'Nitro BLUE',{canvas:true});
  await b.evaluate('document.getElementById("reset").click()');
  await record(game,'#raceCanvas',async()=>{await wait(800);await b.evaluate('document.querySelector(\'[data-team="0"][data-kind="gift"]\').click()');await wait(4200);await b.evaluate('document.querySelector(\'[data-team="1"][data-kind="gift"]\').click()');await wait(6200);});
 }
 await b.page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:2,mobile:false});
 await b.page('Page.navigate',{url:root+'/GAME/NOVA-VEX/Neon-Ascent.html?qa'});await b.waitFor('!!window.__neonAscent&&document.getElementById("loading").hidden');
 await b.evaluate('__neonAscent.sim.setSettings({autoplay:false,soundEnabled:false,musicEnabled:false,showContributors:false,finishDistance:10000});const style=document.createElement("style");style.textContent="#quick-test{display:none!important}";document.head.append(style)');
 for(const [mode,label,meter]of [['earth','Neon District',0],['grass','Rooftop Run',150],['clouds','Skyline',500],['space','Sky Circuit',1100],['cosmos','Neon Heights',2200],['lava','Undergrid',-200],['crystal','Power Core',-700],['abyss','Deep Grid',-1200]]){
  await b.evaluate(`__neonAscent.sim.setSettings({backgroundTheme:'${mode}'});__neonAscent.teleport(${meter});__neonAscent.advance(.2)`);await saveImage('nova-vex',mode,label);
 }
 for(const [mode,action,label,time]of [['jetpack','cloud','Jetpack · +150 m',1.5],['push','meteor','Împingerea lui Vex',1.8],['ride','vortex','Cursa lui Vex',3.6]]){
  await b.evaluate(`__neonAscent.control({action:'session.panic'});__neonAscent.control({action:'session.resume'});__neonAscent.sim.setSettings({backgroundTheme:'earth'});__neonAscent.teleport(1000);__neonAscent.sim.player.x=__neonAscent.sim.previous.x=240;__neonAscent.action({action:'${action}',amount:1,commandId:'capture-${mode}',actor:{username:'demo'}});__neonAscent.advance(${time})`);await saveImage('nova-vex',mode,label,{detail:true});
 }
 await b.evaluate('__neonAscent.control({action:"session.panic"});__neonAscent.control({action:"session.resume"});__neonAscent.sim.setSettings({backgroundTheme:"earth"});__neonAscent.teleport(1000);__neonAscent.sim.player.x=__neonAscent.sim.previous.x=240;__neonAscent.live(true)');
 await record('nova-vex','#scene',async()=>{await wait(500);await b.evaluate('__neonAscent.action({action:"cloud",amount:1,commandId:"clip-jetpack",actor:{username:"demo"}})');await wait(4100);await b.evaluate('__neonAscent.action({action:"vortex",amount:1,commandId:"clip-vex",actor:{username:"demo"}})');await wait(6500);});
 const manifest=JSON.parse(await readFile(out+'/manifest.json','utf8')).filter(e=>!['neon-race-2','moto-interact','nova-vex'].includes(e.game));
 const order={ 'neon-interact':['track','overview','preview'],'moto-interact':['track','preview','nitro-red','nitro-blue','overview'],'nova-vex':['ride','preview','earth','push'] };
 entries.splice(0,entries.length,...entries.filter(e=>order[e.game].includes(e.mode)));
 for(const e of entries){
  if(e.game==='nova-vex')e.label=({ride:'Nova și Vex',preview:'Nova în acțiune',earth:'Jocul complet',push:'Vex o încurcă'})[e.mode];
  if(e.mode==='preview'&&e.game!=='moto-interact'){
   const file=e.game+'-preview-v2.mp4';
   if(await access(out+'/'+file).then(()=>true,()=>false))e.video=file;
   if(e.game==='neon-interact')e.label='Cursa în mișcare';
  }
 }
 entries.sort((a,b)=>a.game.localeCompare(b.game)||order[a.game].indexOf(a.mode)-order[b.game].indexOf(b.mode));
 for(const e of entries)manifest.push({...e,game:e.game==='neon-interact'?'neon-race-2':e.game});
 await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 await writeFile(temp+'/capture-report.json',JSON.stringify(entries,null,2));
 console.log('Saved '+entries.length+' gameplay media entries. Covers were not modified.');
}finally{await b.close();}
