// Approved three-game Canvas presentation. No game iframe, LIVE session or audio.
import {NeonRace2} from '../neon-race2-engine.js';
import {createNightRenderer} from '../neon-race2-renderer.js';
import {createMotoRenderer} from '../moto-interact-renderer.js';
import {createNovaScene} from './nova-scene.js?v=2';
const lengths=[6,6,8],starts=[0,6,12],names=['NEON INTERACT','MOTO INTERACT','NOVA & VEX'],duration=20,fade=.55;
const imageReady=image=>image.complete&&image.naturalWidth?Promise.resolve():new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(Error('Hero artwork unavailable')),{once:true});});
function raceScene(motorcycle=false){
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
 const renderer=(motorcycle?createMotoRenderer:createNightRenderer)(canvas),race=new NeonRace2();let previous=-1,event=0;
 const events=motorcycle?[[.65,1,'like',100],[1.2,0,'gift',100],[4.6,1,'gift',25]]:[[.6,1,'like',100],[1.2,0,'gift',160],[3.4,1,'gift',130]];
 return {canvas,focus(){const poses=[0,1].map(i=>renderer.pose(race,i));return{left:Math.min(...poses.map(p=>p.x)),right:Math.max(...poses.map(p=>p.x+p.width))};},load:()=>Promise.all(renderer.images.map(imageReady)),draw(local){
  if(local<previous||previous<0){race.reset();race.teams.forEach(team=>team.distance=900);previous=0;event=0;renderer.draw(race,0);}
  while(race.elapsed<local-1e-6){const dt=Math.min(1/60,local-race.elapsed);while(events[event]&&events[event][0]<=race.elapsed+dt){const [,team,kind,value]=events[event++];race.contribute(team,kind,value);}race.step(dt,false);}
  renderer.draw(race,local,{effectsTime:local,reduced:false});previous=local;return canvas;
 }};
}
export async function mountHomeReel(root){
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false}),button=root.querySelector('[data-reel-toggle]'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const portrait=canvas.height>canvas.width;
 const scenes=[raceScene(),raceScene(true)];let clock=0,last=0,painted=0,request=0,paused=reduced.matches,visible=true,active=-1;
 const [,nova]=await Promise.all([Promise.all(scenes.map(scene=>scene.load())),createNovaScene({portrait})]);scenes.push(nova);
 const english=()=>window.TikInteractLanguage?.get()==='en';
 function copy(){button.innerHTML='<i class="fa-solid fa-'+(paused?'play':'pause')+'" aria-hidden="true"></i>';button.setAttribute('aria-label',english()?(paused?'Play animation':'Pause animation'):(paused?'Redă animația':'Pauză animație'));button.setAttribute('aria-pressed',String(paused));}
 function paint(index,time,alpha=1){
  const scene=scenes[index],source=scene.draw(time);ctx.globalAlpha=alpha;
  if(index===2)ctx.drawImage(source,0,0,canvas.width,canvas.height);
  else if(portrait){
   // Keep both teams in frame without stretching the cars or the motorcycles.
   const focus=scene.focus(),width=Math.min(source.width,Math.max(source.height*canvas.width/canvas.height,focus.right-focus.left+90)),x=Math.max(0,Math.min(source.width-width,(focus.left+focus.right-width)/2)),height=source.height*canvas.width/width,y=canvas.height-height;
   if(!scene.sky){const pixel=source.getContext('2d').getImageData(Math.floor(x+width/2),0,1,1).data;scene.sky='rgb('+pixel[0]+','+pixel[1]+','+pixel[2]+')';}
   ctx.fillStyle=scene.sky;ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(source,x,0,width,source.height,0,y,canvas.width,height);
  }else ctx.drawImage(source,0,225,1200,675,0,0,canvas.width,canvas.height);
  ctx.globalAlpha=1;
 }
 function render(time){const cycle=time%duration,index=cycle<6?0:cycle<12?1:2,local=cycle-starts[index],transition=Math.max(0,(local-lengths[index]+fade)/fade);ctx.setTransform(1,0,0,1,0,0);paint(index,local+fade);if(transition>0)paint((index+1)%3,local-lengths[index]+fade,transition*transition*(3-2*transition));if(active!==index){active=index;const label=root.querySelector('[data-reel-name]');if(label)label.textContent=names[index];}root.dataset.scene=String(index);}
 function stop(){cancelAnimationFrame(request);request=0;last=0;}
 function start(){if(!request&&!paused&&visible&&!document.hidden)request=requestAnimationFrame(tick);}
 function tick(now){request=0;if(paused||!visible||document.hidden)return;if(!last)last=now;if(now-painted>=1000/30){clock+=Math.min(.1,(now-last)/1000);last=now;painted=now;render(clock);}request=requestAnimationFrame(tick);}
 button.disabled=false;button.onclick=()=>{paused=!paused;copy();if(paused)stop();else start();};
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();},{threshold:.05});observer.observe(root);
 document.addEventListener('visibilitychange',()=>{stop();start();});reduced.addEventListener('change',()=>{paused=reduced.matches;copy();stop();start();});window.addEventListener('tikinteract:language',copy);
 root.dataset.ready='true';root.querySelector('[data-reel-poster]')?.setAttribute('hidden','');copy();render(0);start();
 return Object.freeze({pause(){paused=true;stop();copy();},play(){paused=false;copy();start();},getState:()=>({time:clock,scene:active,paused})});
}
