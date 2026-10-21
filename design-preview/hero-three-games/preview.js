import {NeonRace2} from '../../assets/neon-race2-engine.js';
import {createNightRenderer} from '../../assets/neon-race2-renderer.js';
import {createMotoRenderer} from '../../assets/moto-interact-renderer.js';
import {createNovaScene} from './nova-scene.js';

const canvas=document.getElementById('hero'),ctx=canvas.getContext('2d',{alpha:false});
const lengths=[6,6,8],starts=[0,6,12],names=['NEON INTERACT','MOTO INTERACT','NOVA & VEX'],duration=20,fade=.55;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let clock=0,last=0,paused=reduced.matches,visible=true,request=0,language='ro',ready=false,active=-1;
const copy={ro:{eyebrow:'PROPUNERE PENTRU HOMEPAGE',heading:'Trei jocuri, o singură animație.',description:'O buclă scurtă cu scene din NEON INTERACT, MOTO INTERACT și NOVA & VEX.',loading:'Se pregătesc imaginile jocurilor…',note:'20 de secunde · Fără sunet · Tranziții discrete',approval:'Propunere separată, înainte de integrarea în site.',play:'Redă animația',pause:'Pauză animație'},en:{eyebrow:'HOMEPAGE PROPOSAL',heading:'Three games, one animation.',description:'A short loop featuring NEON INTERACT, MOTO INTERACT and NOVA & VEX.',loading:'Preparing game artwork…',note:'20 seconds · Silent · Subtle transitions',approval:'Separate proposal, before integration into the site.',play:'Play animation',pause:'Pause animation'}};
function translate(){document.documentElement.lang=language;document.querySelectorAll('[data-copy]').forEach(el=>el.textContent=copy[language][el.dataset.copy]);playCopy();}
function playCopy(){const button=document.getElementById('play');button.textContent=paused?'▶':'Ⅱ';button.setAttribute('aria-label',copy[language][paused?'play':'pause']);button.setAttribute('aria-pressed',String(paused));}
function run(){if(ready&&!paused&&visible&&!document.hidden&&!request){last=0;request=requestAnimationFrame(tick);}}
function stop(){cancelAnimationFrame(request);request=0;last=0;}
function tick(now){request=0;if(paused||!visible||document.hidden)return;const dt=Math.min((now-(last||now))/1000,.05);last=now;clock+=dt;renderAt(clock);request=requestAnimationFrame(tick);}
const imageReady=image=>image.complete&&image.naturalWidth?Promise.resolve():new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(Error(image.src)),{once:true});});
function raceScene(motorcycle=false){
  const surface=document.createElement('canvas');surface.width=1200;surface.height=900;
  const renderer=(motorcycle?createMotoRenderer:createNightRenderer)(surface),race=new NeonRace2();
  let previous=-1,nextEvent=0;
  const events=motorcycle?[[.65,1,'like',100],[1.2,0,'gift',100],[4.6,1,'gift',25]]:[[.6,1,'like',100],[1.2,0,'gift',160],[3.4,1,'gift',130]];
  return{canvas:surface,renderer,race,load:()=>Promise.all(renderer.images.map(imageReady)),draw(local){
    if(local<previous||previous<0){race.reset();race.teams.forEach(team=>team.distance=900);previous=0;nextEvent=0;renderer.draw(race,0);}
    while(race.elapsed<local-1e-6){const dt=Math.min(1/60,local-race.elapsed);while(events[nextEvent]&&events[nextEvent][0]<=race.elapsed+dt){const [,team,kind,value]=events[nextEvent++];race.contribute(team,kind,value);}race.step(dt,false);}
    renderer.draw(race,local,{effectsTime:local,reduced:false});previous=local;return surface;
  }};
}
const scenes=[raceScene(),raceScene(true)];
function paintScene(index,local,alpha=1){const source=scenes[index].draw(local);ctx.globalAlpha=alpha;if(index===2)ctx.drawImage(source,0,0,canvas.width,canvas.height);else ctx.drawImage(source,0,225,1200,675,0,0,canvas.width,canvas.height);ctx.globalAlpha=1;}
function renderAt(time){
  if(!ready)return;const cycle=((time%duration)+duration)%duration,index=cycle<6?0:cycle<12?1:2,local=cycle-starts[index],transition=Math.max(0,(local-(lengths[index]-fade))/fade);
  ctx.setTransform(1,0,0,1,0,0);paintScene(index,local+fade);
  if(transition>0){const smooth=transition*transition*(3-2*transition);paintScene((index+1)%3,local-lengths[index]+fade,smooth);}
  if(active!==index){active=index;document.getElementById('scene-name').textContent=names[index];document.querySelectorAll('[data-scene]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.scene)===index)));}
  document.querySelectorAll('[data-scene]').forEach(button=>button.style.setProperty('--progress',Number(button.dataset.scene)===index?Math.min(1,local/lengths[index]):0));
  canvas.dataset.scene=String(index);canvas.dataset.phase=index===2?scenes[2].phase:scenes[index].race.teams[0].nitroSeconds>0?'nitro':'race';
}
document.getElementById('play').onclick=()=>{paused=!paused;playCopy();if(paused)stop();else run();};
document.querySelectorAll('[data-scene]').forEach(button=>button.onclick=()=>{clock=starts[Number(button.dataset.scene)];renderAt(clock);last=0;run();});
document.getElementById('language').onclick=()=>{language=language==='ro'?'en':'ro';translate();};
document.getElementById('theme').onclick=()=>{const light=document.documentElement.dataset.mode!=='light';document.documentElement.dataset.mode=light?'light':'dark';document.getElementById('theme').textContent=light?'☾':'☀';};
document.addEventListener('visibilitychange',()=>{stop();run();});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)run();else stop();},{threshold:.1}).observe(canvas);
reduced.addEventListener('change',()=>{paused=reduced.matches;playCopy();stop();run();});
try{
  const [,nova]=await Promise.all([Promise.all(scenes.map(scene=>scene.load())),createNovaScene()]);scenes.push(nova);ready=true;document.getElementById('loading').hidden=true;document.getElementById('play').disabled=false;translate();renderAt(0);run();
  // Fixed-time rendering is exposed only on this isolated approval page for review/export.
  window.TikInteractHeroPreview=Object.freeze({duration,scenes:names,canvas,seek(time){paused=true;stop();clock=time;renderAt(time);playCopy();},play(){paused=false;playCopy();run();},pause(){paused=true;stop();playCopy();},state:()=>({time:clock,scene:active,phase:canvas.dataset.phase,paused,ready})});
}catch(error){document.getElementById('loading').textContent=language==='ro'?'Imaginile nu s-au încărcat. Reîncarcă pagina.':'Artwork could not be loaded. Reload the page.';console.error(error);}
