import {DEFAULT_CONFIG,validateConfig,cloneConfig,PANEL_NAMES} from './platform-schema.js';
let config=cloneConfig(DEFAULT_CONFIG),revision=-1;
const byId=id=>config.games.find(game=>game.id===id);
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
let connection;
const credentials=()=>connection ||= fetch(new URL('./supabase-config.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Config unavailable');return r.json();});
const api=Object.freeze({getGame:byId,getConfig:()=>cloneConfig(config),getRevision:()=>revision,refresh});
window.TikInteractPlatform=api;
function catalog(){
 const root=document.getElementById('view-catalog');
 if(root){
  root.querySelectorAll(':scope>section,:scope>.platform-empty').forEach(el=>el.remove());
  for(const plan of config.plans){
   const games=config.games.filter(g=>g.status==='published'&&g.plan===plan.id);
   if(!games.length)continue;
   const section=node('section','mb-10'),title=node('h2','mb-4 text-xl font-extrabold text-white',plan.id==='free'?'GRATUITE':plan.name.toUpperCase()),grid=node('div','grid');
   for(const game of games){const card=node('a','premium-card game-catalog-card game-cover-card');card.dataset.platformGame=game.id;card.href=game.presentationPath||'#game-'+game.id;card.setAttribute('aria-label','Vezi prezentarea '+game.name);const image=node('img','game-card-preview');image.src=game.cover;image.alt='Coperta '+game.name;image.width=720;image.height=1280;image.loading='lazy';card.append(image);if(!game.presentationPath)card.addEventListener('click',event=>{event.preventDefault();showGame(game);});grid.append(card);}
   section.append(title,grid);root.append(section);
  }
  if(!root.querySelector('section'))root.append(node('p','platform-empty','Pregătim următoarele jocuri. Revino în curând.'));
 }
 const grid=document.querySelector('.game-center-grid'),select=document.getElementById('live-game-select');
 if(grid&&select){
  const selected=select.value;grid.replaceChildren();select.querySelectorAll('option[value]:not([value=""])').forEach(el=>el.remove());
  for(const game of config.games.filter(g=>g.status==='published')){
   const option=node('option','',game.name);option.value=game.id;select.append(option);
   const card=node('article','game-center-card game-cover-card');card.dataset.gameId=game.id;card.dataset.gameCenterCard=(game.name+' '+game.description).toLowerCase();card.setAttribute('aria-label',game.name);
   const image=node('img');image.src=game.cover;image.alt='Coperta '+game.name;image.width=720;image.height=1280;image.loading='lazy';
   const body=node('div','game-center-card-body'),button=node('button','',game.plan==='free'||window.TikInteractPass?.canAccess(game.plan)?'Deschide în Studio':config.plans.find(p=>p.id===game.plan).name);button.type='button';button.dataset.planGame=game.id;button.addEventListener('click',()=>window.launchStudioGame?.(game.id));body.append(button);card.append(image,body);grid.append(card);
  }
  if(byId(selected)?.status==='published')select.value=selected;else select.value='';
  window.initializeGameFavorites?.();window.filterStudioGames?.(document.getElementById('game-center-search')?.value||'');
  updateAccess();
 }
 const nova=document.querySelector('[data-home-nova]');if(nova)nova.hidden=byId('nova-vex')?.status!=='published';
}
function updateAccess(){
 for(const button of document.querySelectorAll('[data-plan-game]')){const game=byId(button.dataset.planGame);if(game)button.textContent=game.plan==='free'||window.TikInteractPass?.canAccess(game.plan)?'Deschide în Studio':config.plans.find(p=>p.id===game.plan).name;}
 const frame=document.getElementById('live-game-frame'),id=frame?.dataset.gameId,game=byId(id);
 if(id&&(!game||game.status!=='published'||(game.plan!=='free'&&!window.TikInteractPass?.canAccess(game.plan)))){
  window.TikInteractLive?.detach();frame.removeAttribute('src');delete frame.dataset.gameId;frame.hidden=true;frame.parentElement.classList.add('is-empty');document.getElementById('studio-game-empty').hidden=false;window.resetStudioTestMenu?.();document.getElementById('live-game-status').textContent='Jocul nu mai este disponibil pentru contul tău. Alege un joc gratuit sau verifică PLAY PASS.';
 }
}
function prices(){for(const [i,p]of config.plans.entries()){const card=document.querySelectorAll('#pricing>.pricing-card')[i];if(!card)continue;card.hidden=!p.enabled;card.querySelector('h3').textContent=p.name;const price=card.querySelector('.price');price.replaceChildren(document.createTextNode(new Intl.NumberFormat('ro-RO',{maximumFractionDigits:2}).format(p.priceCents/100)));price.append(node('span','',p.currency+(p.id==='free'?'':' / lună')));card.querySelector('ul').replaceChildren(...p.features.map(f=>node('li','',f)));}}
function home(){const copy=document.querySelector('.home-hero-copy');if(!copy)return;const title=copy.querySelector('h1');title.replaceChildren(document.createTextNode(config.home.heading),document.createElement('br'),node('span','',config.home.accent));copy.querySelector(':scope>p').textContent=config.home.intro;}
function studio(){const workspace=document.querySelector('.studio-workspace'),left=document.querySelector('.studio-game-sidebar'),right=document.querySelector('.studio-controls');if(!workspace||!left||!right)return;const selectors={games:'.studio-game-picker',controls:'#studio-test-panel',streamer:'.studio-connection',audio:'.studio-audio',stats:'.studio-stats',feed:'.studio-controls>.live-grid,.studio-game-sidebar>.live-grid'};const panels=Object.fromEntries(Object.entries(selectors).map(([id,selector])=>[id,workspace.querySelector(selector)]));for(const side of ['left','right'])for(const id of config.studio[side]){if(panels[id]){panels[id].dataset.configPanel=id;(side==='left'?left:right).append(panels[id]);}}workspace.dataset.configDensity=config.studio.density;workspace.dataset.configSide=config.studio.side;window.TikInteractStudioLayout?.fitGame();}
function apply(value){config=validateConfig(value);catalog();prices();home();studio();window.dispatchEvent(new CustomEvent('tikinteract:config',{detail:{revision}}));}
async function refresh(){try{const c=await credentials();const response=await fetch(c.url+'/rest/v1/rpc/get_site_public_config',{method:'POST',headers:{apikey:c.anonKey,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});if(!response.ok)return false;const data=await response.json();if(!data?.config)return false;if(data.revision===revision)return true;validateConfig(data.config);revision=data.revision;apply(data.config);return true;}catch{return false;}}
function showGame(game){let dialog=document.getElementById('platform-game-dialog');if(!dialog){dialog=node('dialog','resource-page-dialog');dialog.id='platform-game-dialog';dialog.setAttribute('aria-label','Prezentare joc');dialog.innerHTML='<div class="resource-page-topbar"><strong>JOCURI</strong><button class="support-icon-button" type="button" aria-label="Închide prezentarea">×</button></div><div class="resource-reader"></div>';dialog.querySelector('button').onclick=()=>dialog.close();document.body.append(dialog);}const content=dialog.querySelector('.resource-reader'),image=node('img','platform-game-cover');image.src=game.cover;image.alt=game.name;const heading=node('h1','',game.name),description=node('p','',game.description),link=node('a','support-submit','Deschide în LIVE Studio');link.href='live-studio.html?game='+encodeURIComponent(game.id);content.replaceChildren(image,heading,description,link);dialog.showModal();}
let roleRequest=0;
async function updateAdminLink(){const request=++roleRequest;document.querySelectorAll('[data-platform-admin-link]').forEach(el=>el.remove());const client=window.tikInteractSupabase;if(!client||!window.tikInteractUser)return;try{const {data,error}=await client.rpc('site_admin_role');if(request!==roleRequest||error||!['owner','admin','editor'].includes(data))return;const menu=document.getElementById('user-profile-menu');if(menu){const a=node('a','account-menu-button'),icon=node('i','fa-solid fa-user-shield');icon.setAttribute('aria-hidden','true');a.append(icon,node('span','','ADMINISTRARE'));a.href='admin.html';a.dataset.platformAdminLink='';menu.append(a);}}catch{}}
const previewToken=new URLSearchParams(location.search).get('adminPreview');
const preview=!!previewToken&&window.parent!==window;
if(preview){
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.channel!=='tikinteract-admin-preview'||event.data.token!==previewToken)return;try{apply(event.data.config);}catch{}});
}
function initialize(){apply(config);if(preview)window.parent.postMessage({channel:'tikinteract-preview-ready',token:previewToken},location.origin);else refresh();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
window.addEventListener('tikinteract:auth',updateAdminLink);
window.addEventListener('tikinteract:access',()=>{updateAccess();window.refreshGameFavorites?.();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(!preview)refresh();updateAdminLink();}});
setInterval(()=>{if(!document.hidden&&!preview)refresh();},60000);
