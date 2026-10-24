import {CANVAS_WIDTH,snap,normalizeLayout,moveFavorite} from './studio-personalization-model.js?v=2';
import {esc,ic} from './creator-ui.js?v=4';
import {loadAnimationState} from './animations-state.js?v=3';
import {animationAPI,animationError} from './animations-client.js?v=2';
const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
const labels={games:['Favorite jocuri','Favorite games'],audio:['Favorite audio','Favorite audio'],preview:['Joc','Game'],controls:['Control joc','Game controls'],streamer:['TikTok LIVE','TikTok LIVE'],stats:['Scor și cadouri','Score and gifts'],feed:['Evenimente LIVE','LIVE events'],audience:['Chat și susținători','Chat and supporters'],animations:['Favorite animații','Favorite animations']};
const read=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}},write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const legacy={games:read('tikinteract_game_favorites_v1')||[],audio:read('tikinteract-audio-favorites')||[],animations:[]};
let root,toolbar,dialog,ghost,user=null,epoch=0,profiles=[],active=null,draft=normalizeLayout(),saved=normalizeLayout(),editing=false,loaded=false,cloud='loading',busy=false,timer,drag=null,dragFrame=0,applying=false,library=[],message='';
const panelIcons={games:'gamepad',audio:'table-cells',preview:'display',controls:'sliders',streamer:'tower-broadcast',stats:'chart-line',feed:'bolt',audience:'comments',animations:'clapperboard'};
const nodes=new Map(),originalHidden=new Map(),mode=()=>matchMedia('(max-width:700px)').matches?'mobile':'desktop',ids=()=>[...nodes.keys()];
let platformDefault=null,defaultRevision=0,canPublish=false,restoredLayout=false;
const presentationKey=()=>`tikinteract_control_room_layout:${user}`;
const effectiveLayout=()=>!draft.custom&&platformDefault?normalizeLayout({...platformDefault,favorites:draft.favorites},ids()):draft;
const key=()=>`tikinteract_layout_v1:${user}`,name=id=>labels[id]?t(...labels[id]):nodes.get(id)?.getAttribute('aria-label')||id;
function cache(){if(user)write(key(),{profiles,active,draft:editing?null:draft});}
function say(text){message=text;const p=toolbar?.querySelector('[data-sle-message]');if(p)p.textContent=text;}
async function rpc(name,args={}){
 const own=user,client=window.tikInteractSupabase;if(!own||!client)throw Error('LAYOUT_LOGIN_REQUIRED');
 let timeout;try{const result=await Promise.race([client.rpc(name,args),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('LAYOUT_OFFLINE')),6000);})]);
  if(own!==user||own!==window.tikInteractUser?.id)throw Error('LAYOUT_ACCOUNT_CHANGED');if(result.error)throw result.error;return result.data;
 }finally{clearTimeout(timeout);}
}
function errorText(e){const value=String(e?.message||'');return /LAYOUT_CONFLICT/.test(value)?t('Profilul a fost modificat pe alt dispozitiv. Reîncarcă profilurile înainte să salvezi.','This profile changed on another device. Reload profiles before saving.'):/LAYOUT_LIMIT/.test(value)?t('Poți salva cel mult 8 profiluri.','You can save up to 8 profiles.'):/PGRST202|does not exist|schema cache/.test(value)?t('Salvare locală. Pentru sincronizare, instalează supabase/studio-workspaces.sql.','Saved locally. Install supabase/studio-workspaces.sql to enable sync.'):t('Sincronizarea nu a reușit. Modificările rămân pe acest dispozitiv.','Sync failed. Changes remain on this device.');}
function buttons(){
 if(!toolbar)return;window.dispatchEvent(new Event('tikinteract:layout-status'));
 toolbar.innerHTML=`<select data-sle-profile aria-label="${t('Profil de aranjament','Layout profile')}" ${busy||editing?'disabled':''}>${profiles.map(p=>`<option value="${esc(p.id)}" ${p.id===active?'selected':''}>${esc(p.name)}</option>`).join('')}</select><button type="button" data-sle="new" ${busy||editing?'disabled':''} title="${t('Profil nou','New profile')}">${ic('plus')}</button><button type="button" data-sle="edit" ${!user||!loaded||editing||busy?'disabled':''}>${ic('sliders')}${t('Personalizează','Customize Layout')}</button><span class="sle-tools" ${editing?'':'hidden'}><button type="button" data-sle="save" ${busy?'disabled':''}>${ic('check')}${t('Salvează','Save Layout')}</button><button type="button" data-sle="cancel">${t('Anulează','Cancel')}</button><button type="button" data-sle="reset">${t('Resetează','Reset Layout')}</button><button type="button" data-sle="panels">${ic('layer-group')}${t('Panouri','Add Panel')}</button><button type="button" data-sle="favorites">${ic('star')}${t('Favorite','Favorites')}</button><button type="button" data-sle="lock">${ic('lock')}${t('Blochează','Lock Layout')}</button>${canPublish?`<button type="button" data-sle="publish" ${busy?'disabled':''}>${ic('globe')}${t('Setează ca implicit','Set as platform default')}</button>`:''}</span><button type="button" data-sle="profiles" ${!user||busy||editing?'disabled':''}>${ic('folder')}${t('Profiluri','Profiles')}</button><small>${cloud==='ready'?t('Sincronizat cu contul','Synced with account'):cloud==='loading'?t('Se încarcă profilurile…','Loading profiles…'):t('Doar pe acest dispozitiv','This device only')} · ${mode()==='mobile'?t('Mobil','Mobile'):t('Desktop','Desktop')}</small>${effectiveLayout().custom&&!editing?'<button type="button" data-sle="saved-layout">'+t(restoredLayout?'Noul Studio':'Aranjament salvat',restoredLayout?'New Studio':'Saved layout')+'</button>':''}<p data-sle-message role="status">${esc(message)}</p>`;
}
function applyFavorites(){applying=true;try{window.TikInteractFavorites?.set(draft.favorites);renderAnimations();}finally{applying=false;}}
function apply(){
 const view=effectiveLayout(),custom=view.custom&&restoredLayout||editing;root.classList.toggle('sle-custom',custom);root.classList.toggle('sle-edit',editing);
 if(document.body.classList.contains('studio-widget-desktop')&&custom){
  const old=parseFloat(root.style.getPropertyValue('--sle-viewport-left'))||0,origin=root.getBoundingClientRect().left+old;
  root.style.setProperty('--sle-viewport-left',origin+'px');root.style.setProperty('--sle-viewport-width',document.documentElement.clientWidth+'px');
 }
 const current=mode(),rows=view[current],scale=root.clientWidth/CANVAS_WIDTH[current];
 root.style.setProperty('--sle-height',Math.max(700,...rows.filter(p=>!p.hidden).map(p=>p.y+p.h+32))+'px');
 for(const [id,node] of nodes){const p=rows.find(p=>p.id===id);if(!p)continue;
  node.hidden=custom?p.hidden:originalHidden.get(id);node.classList.toggle('sle-panel',custom);
  // Hidden Studio sections have no measurable width. Keep their last geometry
  // until visible, instead of collapsing every saved panel to zero pixels.
  if(custom&&scale>0)for(const [key,value]of Object.entries({left:p.x*scale,top:p.y,width:p.w*scale,'panel-height':p.h}))node.style.setProperty('--sle-'+key,value+'px');
 }
 buttons();requestAnimationFrame(()=>{window.TikInteractStudioLayout?.fitGame();nodes.forEach(node=>window.TikInteractWidgetDesktop?.positionResize(node));});
}
function register(id,node){
 if(!node||nodes.has(id)||!/^[a-z][a-z0-9-]{0,49}$/.test(id))return;
 nodes.set(id,node);originalHidden.set(id,node.hidden);node.dataset.layoutPanel=id;node.style.zIndex=String(20+nodes.size*3);
 const controls=document.createElement('div');controls.className='sle-panel-tools';controls.dataset.sleHandle=id;controls.tabIndex=0;controls.setAttribute('role','group');
 controls.innerHTML=`<i class="fa-solid fa-grip-vertical sle-panel-grip" aria-hidden="true"></i><i class="fa-solid fa-${panelIcons[id]||'window-maximize'} sle-panel-icon" aria-hidden="true"></i><span data-sle-label>${esc(name(id))}</span><button type="button" data-sle-left="${id}" aria-label="${t('Mută spre stânga','Move left')}">‹</button><button type="button" data-sle-up="${id}" aria-label="${t('Mută în sus','Move up')}">↑</button><button type="button" data-sle-down="${id}" aria-label="${t('Mută în jos','Move down')}">↓</button><button type="button" data-sle-right="${id}" aria-label="${t('Mută spre dreapta','Move right')}">›</button><button type="button" data-sle-hide="${id}" aria-label="${t('Ascunde panoul','Hide panel')}">${ic('xmark')}</button>`;
 node.prepend(controls);const resize=document.createElement('button');resize.type='button';resize.className='sle-resize';resize.dataset.sleResize=id;resize.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 13 10-10m-5 10 5-5"/></svg>';resize.setAttribute('aria-label',t('Redimensionează; săgețile modifică dimensiunea','Resize; arrow keys change size'));node.append(resize);
 // LIVE updates may repaint a panel; keep its header and the same resize grip.
 const attach=()=>window.TikInteractWidgetDesktop?.attachResize(node,resize);
 attach();window.addEventListener('tikinteract:desktop-ready',attach,{once:true});
 new MutationObserver(()=>{if(!node.contains(controls))node.prepend(controls);if(!resize.isConnected)node.append(resize);window.TikInteractWidgetDesktop?.positionResize(node);}).observe(node,{childList:true});
 for(const h of node.querySelectorAll(':scope>h3,:scope>h4,:scope>.live-favorites-heading,:scope>.studio-test-header'))h.dataset.sleDrag=id;
}
function showDialog(title,html){
 if(!dialog){dialog=document.createElement('dialog');dialog.className='an-dialog sle-dialog';dialog.dataset.nativeI18n='';dialog.setAttribute('aria-labelledby','sle-dialog-title');document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('[data-sle-close]'))dialog.close();});dialog.addEventListener('close',()=>toolbar.querySelector('[data-sle=edit]')?.focus({preventScroll:true}));}
 dialog.innerHTML=`<header><h2 id="sle-dialog-title">${esc(title)}</h2><button type="button" data-sle-close aria-label="${t('Închide','Close')}">${ic('xmark')}</button></header><div class="an-dialog-body">${html}</div>`;if(!dialog.open)dialog.showModal();dialog.querySelector('[data-sle-close]').focus({preventScroll:true});
}
function renderAnimations(){
 const panel=nodes.get('animations');if(!panel)return;const container=panel.querySelector('[data-sle-animation-grid]');
 container.innerHTML=draft.favorites.animations.map(id=>library.find(c=>c.id===id&&c.mime==='video/mp4')).filter(Boolean).map((c,index)=>`<article class="live-favorite-card" data-animation-id="${c.id}"><div class="live-favorite-card-topline"><span class="live-favorite-number">${index+1}</span><button type="button" data-sle-remove-animation="${c.id}" class="live-favorite-remove" aria-label="${t('Elimină din favorite','Remove favorite')}">${ic('star')}</button></div><button type="button" class="live-favorite-trigger" data-sle-play="${c.id}"><span class="live-favorite-icon">${ic('film')}</span><span class="live-favorite-title">${esc(c.title)}</span></button></article>`).join('')||`<p>${t('Adaugă videoclipuri din biblioteca comună.','Add videos from the shared library.')}</p>`;
}
async function loadLibrary(){try{const state=await loadAnimationState();library=state.library;renderAnimations();return library;}catch(e){say(animationError(e.message));return [];}}
async function save({lock=true}={}){
 if(!user||busy)return false;busy=true;const own=user,version=epoch,layout=structuredClone(draft),id=active;buttons();
 const previous=profiles.find(p=>p.id===id);if(!previous){busy=false;return false;}
 try{
  const row=await rpc('studio_layout_save',{p_id:id,p_name:previous.name,p_layout:layout,p_revision:previous.revision,p_owner:own});
  if(version!==epoch)return false;const newer=JSON.stringify(draft)!==JSON.stringify(layout);profiles=profiles.map(p=>p.id===id?{...row,layout:newer?structuredClone(draft):row.layout,pending:newer}:p);saved=structuredClone(layout);cloud='ready';
  if(editing){restoredLayout=true;write(presentationKey(),true);}if(lock)editing=false;cache();say(t('Aranjament salvat în cont.','Layout saved to your account.'));return true;
 }catch(e){
  if(version!==epoch)return false;
  if(/LAYOUT_CONFLICT/.test(String(e.message))){say(errorText(e));return false;}
  cloud=/PGRST202|does not exist|schema cache/.test(String(e.message))?'missing':'offline';
  profiles=profiles.map(p=>p.id===id?{...p,layout:structuredClone(draft),pending:true}:p);saved=structuredClone(layout);if(lock)editing=false;cache();say(errorText(e));return false;
 }finally{if(version===epoch){busy=false;if(!drag)apply();else buttons();if(JSON.stringify(draft)!==JSON.stringify(layout))queueWorkspaceSave();}}
}
function changedFavorites(){
 applyFavorites();cache();
 if(!editing){clearTimeout(timer);timer=setTimeout(()=>{if(!editing)save({lock:false});},700);}
 window.dispatchEvent(new CustomEvent('tikinteract:layout-favorites',{detail:structuredClone(draft.favorites)}));
}
function toggleAnimation(id){
 if(!user)return;const list=draft.favorites.animations;if(list.includes(id))draft.favorites.animations=list.filter(x=>x!==id);else if(list.length<40)list.push(id);changedFavorites();
}
async function favoritePicker(only){
 await loadLibrary();const catalog=window.TikInteractFavorites?.catalog()||{games:[],audio:[]};
 const group=(kind,title,items)=>`<section><h3>${title}</h3>${items.map(item=>`<label><input type="checkbox" data-favorite-kind="${kind}" value="${esc(item.id)}" ${draft.favorites[kind].includes(item.id)?'checked':''}>${esc(item.name||item.title)}</label>`).join('')||`<p>${t('Niciun fișier disponibil.','No files available.')}</p>`}</section>`;
 showDialog(t('Favoritele tale','Your favorites'),`<p>${t('Sunt scurtături. Eliminarea nu șterge fișierele originale. În modul de editare poți trage cardurile pentru a le reordona.','These are shortcuts. Removing one never deletes the original file. Drag cards in edit mode to reorder them.')}</p><div class="sle-panel-picker">${!only?group('games',t('Jocuri','Games'),catalog.games)+group('audio',t('Sunete','Sounds'),catalog.audio):''}${group('animations',t('Animații','Animations'),library.filter(c=>c.mime==='video/mp4'))}</div>`);
 dialog.querySelectorAll('[data-favorite-kind]').forEach(input=>input.onchange=()=>{const kind=input.dataset.favoriteKind,list=draft.favorites[kind],limit=kind==='audio'?12:40;if(input.checked&&!list.includes(input.value)&&list.length<limit)list.push(input.value);else draft.favorites[kind]=list.filter(x=>x!==input.value);input.checked=draft.favorites[kind].includes(input.value);changedFavorites();});
}
function queueWorkspaceSave(){clearTimeout(timer);timer=setTimeout(()=>{if(!loaded||!user||document.documentElement.dataset.studioTourActive==='true')return;if(busy||drag)queueWorkspaceSave();else save({lock:false});},800);}
function panelPicker(){
 showDialog(t('Panouri disponibile','Available panels'),`<div class="sle-panel-picker">${draft[mode()].map(p=>`<label><input type="checkbox" data-show-panel="${p.id}" ${!p.hidden?'checked':''}>${esc(name(p.id))}</label>`).join('')}</div>`);
 dialog.querySelectorAll('[data-show-panel]').forEach(input=>input.onchange=()=>{draft.custom=true;draft[mode()].find(p=>p.id===input.dataset.showPanel).hidden=!input.checked;apply();queueWorkspaceSave();if(input.dataset.showPanel==='animations'&&input.checked)loadLibrary();});
}
function profileDialog(create=false){
 showDialog(t('Profiluri de aranjament','Layout profiles'),`<form data-sle-profile-form><label>${t('Numele profilului nou','New profile name')}<input name="name" maxlength="50" required value="${create?'':esc(profiles.find(p=>p.id===active)?.name||'')}"></label><button class="an-button" type="submit">${ic('plus')}${t('Creează din aranjamentul curent','Create from current layout')}</button></form><p>${t('Cel mult 8 profiluri per cont. Desktop și mobil au poziții separate.','Up to 8 profiles per account. Desktop and mobile have separate positions.')}</p><button class="an-button" type="button" data-sle-reload>${ic('rotate')}${t('Reîncarcă din cont','Reload from account')}</button><button class="an-button" type="button" data-sle-delete ${profiles.find(p=>p.id===active)?.revision?'':'disabled'}>${ic('trash-can')}${t('Șterge profilul selectat','Delete selected profile')}</button>`);
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(profiles.length>=8){say(t('Limita este de 8 profiluri.','The limit is 8 profiles.'));return;}const id=crypto.randomUUID();profiles.push({id,name:new FormData(e.target).get('name').trim(),layout:structuredClone(draft),revision:0});active=id;dialog.close();await save();};
 dialog.querySelector('[data-sle-reload]').onclick=()=>{dialog.close();loadUser(true);};
 dialog.querySelector('[data-sle-delete]').onclick=async e=>{e.target.disabled=true;try{await rpc('studio_layout_delete',{p_id:active});profiles=profiles.filter(p=>p.id!==active);active=profiles[0]?.id||null;cache();dialog.close();await loadUser(true);}catch(error){say(errorText(error));e.target.disabled=false;}};
}
async function action(event){
 const button=event.target.closest('[data-sle]');if(!button)return;
 switch(button.dataset.sle){
  case 'edit':{
   clearTimeout(timer);
   saved=structuredClone(draft);
   draft=structuredClone(effectiveLayout());
   if(!draft.custom||!restoredLayout){const r=root.getBoundingClientRect(),scale=CANVAS_WIDTH[mode()]/r.width;let bottom=r.height+20;for(const p of draft[mode()]){const n=nodes.get(p.id);if(!n||n.hidden)continue;if(!n.getClientRects().length){Object.assign(p,{x:0,y:Math.round(bottom),w:Math.min(CANVAS_WIDTH[mode()],Math.round(r.width*scale)),h:p.id==='audio'?340:240});bottom+=p.id==='audio'?360:260;continue;}const b=n.getBoundingClientRect();Object.assign(p,{x:Math.max(0,Math.round((b.left-r.left)*scale)),y:Math.max(0,Math.round(b.top-r.top)),w:Math.min(CANVAS_WIDTH[mode()],Math.round(b.width*scale)),h:Math.max(p.id==='games'?310:96,Math.round(b.height))});}}
   editing=true;draft.custom=true;apply();break;
  }
  case 'save':await save();break;
  case 'cancel':draft=structuredClone(saved);editing=false;applyFavorites();apply();break;
  case 'reset':{const favorites=draft.favorites;draft=normalizeLayout({favorites},ids());applyFavorites();apply();say(t('Aranjament implicit. Salvează pentru confirmare.','Default layout restored. Save to keep it.'));break;}
  case 'lock':await save();break;
  case 'panels':panelPicker();break;
  case 'favorites':await favoritePicker();break;
  case 'new':profileDialog(true);break;
  case 'profiles':profileDialog();break;
  case 'saved-layout':restoredLayout=!restoredLayout;write(presentationKey(),restoredLayout);apply();break;
  case 'publish':publishDialog();break;
 }
}
function publishDialog(){
 if(!canPublish)return;
 const layout=structuredClone(draft);layout.favorites={games:[],audio:[],animations:[]};
 showDialog(t('Aranjamentul implicit al platformei','Platform default layout'),`<p>${t('Publici pozițiile, dimensiunile și vizibilitatea panourilor pentru desktop și mobil. Se aplică utilizatorilor fără aranjament personalizat. Favoritele, fișierele și datele tale nu se publică.','Publish panel positions, sizes and visibility for desktop and mobile. This applies to users without a customized layout. Your favorites, files and personal data are never published.')}</p><button type="button" class="an-button" data-publish-default>${t('Publică acest aranjament','Publish this layout')}</button><p data-publish-error role="status"></p>`);
 dialog.querySelector('[data-publish-default]').onclick=async e=>{
  e.target.disabled=true;try{const value=await rpc('studio_layout_publish_default',{p_layout:layout,p_revision:defaultRevision});platformDefault=normalizeLayout(value.layout,ids());defaultRevision=value.revision;write('tikinteract_layout_default_v1',value);dialog.close();say(t('Aranjamentul implicit a fost publicat. Profilurile personalizate se păstrează.','Default layout published. Customized profiles are preserved.'));}catch(error){dialog.querySelector('[data-publish-error]').textContent=errorText(error);e.target.disabled=false;}
 };
}
async function loadUser(force=false){
 const id=window.tikInteractUser?.id||null;if(id===user&&loaded&&!force)return;
 const token=++epoch;clearTimeout(timer);endPointer(false);user=id;restoredLayout=read(presentationKey())===true;busy=false;loaded=false;editing=false;cloud='loading';profiles=[];active=null;message='';library=[];canPublish=false;
 const cachedDefault=read('tikinteract_layout_default_v1');platformDefault=cachedDefault?.layout?normalizeLayout(cachedDefault.layout,ids()):null;defaultRevision=cachedDefault?.revision||0;
 draft=normalizeLayout(null,ids());saved=structuredClone(draft);applyFavorites();apply();
 if(!user){loaded=true;cloud='offline';apply();window.TikInteractStartup?.ready('user-layout');return;}
 const cached=read(key());if(Array.isArray(cached?.profiles)){
  profiles=cached.profiles.filter(p=>typeof p.id==='string'&&typeof p.name==='string'&&Number.isInteger(p.revision)).slice(0,8).map(p=>({...p,layout:normalizeLayout(p.layout,ids(),{migrateAnimationFavorites:true})}));active=profiles.some(p=>p.id===cached.active)?cached.active:profiles[0]?.id;
 }
 if(!profiles.length){let favorites={games:[],audio:[],animations:[]};if(!read('tikinteract_layout_legacy_owner')){favorites=legacy;write('tikinteract_layout_legacy_owner',user);}profiles=[{id:crypto.randomUUID(),name:t('Principal','Main'),revision:0,layout:normalizeLayout({favorites},ids())}];active=profiles[0].id;}
 draft=normalizeLayout(profiles.find(p=>p.id===active).layout,ids());saved=structuredClone(draft);applyFavorites();apply();
 try{
  const [result,context]=await Promise.all([rpc('studio_layout_list'),rpc('studio_layout_context')]);if(token!==epoch)return;
  canPublish=context?.can_publish===true;platformDefault=context?.default?.layout?normalizeLayout(context.default.layout,ids()):null;defaultRevision=context?.default?.revision||0;write('tikinteract_layout_default_v1',context?.default||null);
  if(result.profiles?.length){const cached=profiles,preferred=active;profiles=result.profiles.map(p=>{const local=cached.find(q=>q.id===p.id);return {...p,layout:normalizeLayout(local?.pending&&local.revision===p.revision?local.layout:p.layout,ids(),{migrateAnimationFavorites:true}),pending:!!(local?.pending&&local.revision===p.revision)};});profiles.push(...cached.filter(p=>p.pending&&p.revision===0&&!profiles.some(q=>q.id===p.id)).slice(0,8-profiles.length));active=profiles.some(p=>p.id===preferred&&p.pending)?preferred:profiles.some(p=>p.id===result.active)?result.active:profiles[0].id;draft=normalizeLayout(profiles.find(p=>p.id===active).layout,ids());saved=structuredClone(draft);}
  cloud=profiles.some(p=>p.pending)?'offline':'ready';
 }catch(e){if(token!==epoch)return;cloud=/PGRST202|does not exist|schema cache/.test(String(e.message))?'missing':'offline';say(errorText(e));}
 finally{if(token===epoch){loaded=true;applyFavorites();apply();cache();window.TikInteractStartup?.ready('user-layout');if(!effectiveLayout()[mode()].find(p=>p.id==='animations')?.hidden)loadLibrary();}}
}
function enableFreeLayout(){
 const convert=!draft.custom||!restoredLayout,rects=convert?[...nodes].filter(([,n])=>n.getClientRects().length).map(([id,n])=>[id,n.getBoundingClientRect()]):[];
 if(convert)draft=structuredClone(effectiveLayout());
 draft.custom=true;restoredLayout=true;write(presentationKey(),true);apply();
 if(convert){const r=root.getBoundingClientRect(),width=CANVAS_WIDTH[mode()],scale=width/r.width;
  for(const[id,b]of rects){const p=draft[mode()].find(p=>p.id===id);if(!p)continue;const w=Math.min(width,Math.round(b.width*scale));Object.assign(p,{x:Math.max(0,Math.min(width-w,Math.round((b.left-r.left)*scale))),y:Math.max(0,Math.round(b.top-r.top)),w,h:Math.max(96,Math.round(b.height)),hidden:false});}
  apply();
 }
}
function frontPanel(node){
 const ordered=[...nodes.values()].sort((a,b)=>(parseInt(a.style.zIndex,10)||20)-(parseInt(b.style.zIndex,10)||20)).filter(n=>n!==node);ordered.push(node);
 ordered.forEach((n,i)=>{n.style.zIndex=String(20+i*3);window.TikInteractWidgetDesktop?.positionResize(n);});
}
function startPointer(e){
 const free=document.body.classList.contains('studio-widget-desktop')&&e.target.closest('[data-sle-handle],[data-sle-resize]');
 if((!editing&&!free)||e.button!==0||drag)return;
 if(free&&e.target.closest('button:not([data-sle-resize])'))return;
 if(free&&!editing)enableFreeLayout();
 const favorite=e.target.closest('.studio-quick-item,.live-favorite-card');
 if(favorite){if(e.target.closest('.game-favorite-star,.live-favorite-remove'))return;const kind=favorite.closest('.studio-game-options')?'games':favorite.closest('#live-favorite-sounds')?'audio':'animations',id=kind==='games'?favorite.querySelector('[data-live-game]')?.dataset.liveGame:kind==='audio'?favorite.dataset.soundId:favorite.dataset.animationId;if(!id)return;drag={kind:'favorite',list:kind,id,node:favorite,startX:e.clientX,startY:e.clientY,moved:false};}
 else{
  const handle=e.target.closest('[data-sle-handle],[data-sle-drag],[data-sle-resize]');if(!handle||e.target.closest('button:not([data-sle-resize]),input,select,a'))return;
  const id=handle.dataset.sleHandle||handle.dataset.sleDrag||handle.dataset.sleResize,p=draft[mode()].find(p=>p.id===id);if(!p)return;
  drag={kind:handle.dataset.sleResize?'resize':'move',corner:handle.dataset.resizeCorner||'se',id,node:nodes.get(id),start:{...p},startX:e.clientX,startY:e.clientY,moved:false};
 }
 frontPanel(drag.node);drag.rect=drag.node.getBoundingClientRect();drag.scroll=scrollY;
 drag.styles=Object.fromEntries(['transform','z-index','width','height','pointer-events'].map(k=>[k,[drag.node.style.getPropertyValue(k),drag.node.style.getPropertyPriority(k)]]));
 drag.pointer=e.pointerId;drag.capture=e.target.closest('[data-sle-resize],[data-sle-handle]')||e.target;drag.capture.setPointerCapture?.(e.pointerId);e.preventDefault();
}
function pointerMove(e){
 if(!drag||e.pointerId!==drag.pointer)return;
 drag.point={x:e.clientX,y:e.clientY};
 if(!dragFrame)dragFrame=requestAnimationFrame(renderDrag);
}
function renderDrag(){
 dragFrame=0;const d=drag;if(!d?.point)return;
 const {x,y}=d.point,dx=x-d.startX,dy=y-d.startY+scrollY-d.scroll;
 if(Math.hypot(dx,dy)<5&&!d.moved)return;d.moved=true;
 document.body.classList.add('sle-dragging');d.node.classList.add('sle-moving');d.node.style.setProperty('pointer-events','none');
 const rect=root.getBoundingClientRect(),width=CANVAS_WIDTH[mode()],scale=rect.width/width;
 if(d.kind==='favorite'){
  const selector=d.list==='games'?'.studio-game-options .studio-quick-item':d.list==='audio'?'#live-favorite-sounds .live-favorite-card':'#studio-favorite-animations .live-favorite-card';
  d.target=[...root.querySelectorAll(selector)].find(node=>{if(node===d.node)return false;const r=node.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});
  d.node.style.setProperty('transform','translate3d('+dx+'px,'+dy+'px,0)','important');return;
 }
 const p={...d.start},panelSnap=value=>document.body.classList.contains('studio-widget-desktop')?Math.round(value):snap(value);
 if(d.kind==='move'){
  const left=Math.max(0,Math.min(width-p.w,d.start.x+dx/scale)),top=Math.max(0,Math.min(12000,d.start.y+dy));
  p.x=Math.max(0,Math.min(width-p.w,panelSnap(left)));p.y=panelSnap(top);
  d.node.style.setProperty('transform','translate3d('+((left-d.start.x)*scale)+'px,'+(top-d.start.y)+'px,0)','important');
 }else{
  const next=window.TikInteractWindowGeometry.resize(d.start,d.corner,dx/scale,dy,{left:0,top:0,right:width,bottom:13800,minWidth:mode()==='mobile'?120:160,minHeight:96,maxHeight:1800});
  Object.assign(p,next);
  d.node.style.setProperty('width',p.w*scale+'px','important');d.node.style.setProperty('height',p.h+'px','important');
  d.node.style.setProperty('transform','translate3d('+((p.x-d.start.x)*scale)+'px,'+(p.y-d.start.y)+'px,0)','important');
 }
 window.TikInteractWidgetDesktop?.positionResize(d.node);
 d.next=p;if(!document.body.classList.contains('studio-widget-desktop')){
  if(!ghost){ghost=document.createElement('div');ghost.className='sle-drop';root.append(ghost);}
  Object.assign(ghost.style,{left:p.x*scale+'px',top:p.y+'px',width:p.w*scale+'px',height:p.h+'px'});
 }
 root.style.setProperty('--sle-height',Math.max(root.clientHeight,p.y+p.h+32)+'px');
 if(y>innerHeight-45)window.scrollBy({top:15,behavior:'instant'});else if(y<90)window.scrollBy({top:-15,behavior:'instant'});
}
function endPointer(commit=true){
 if(!drag)return;if(dragFrame){cancelAnimationFrame(dragFrame);dragFrame=0;if(commit)renderDrag();}const d=drag;drag=null;d.node.classList.remove('sle-moving');ghost?.remove();ghost=null;document.body.classList.remove('sle-dragging');
 for(const [key,[value,priority]]of Object.entries(d.styles||{})){if(value)d.node.style.setProperty(key,value,priority);else d.node.style.removeProperty(key);}
 if(d.capture?.hasPointerCapture?.(d.pointer))d.capture.releasePointerCapture(d.pointer);
 if(commit&&d.moved){
  if(d.kind==='favorite'){
   const target=d.target;const targetKind=target?.closest('.studio-game-options')?'games':target?.closest('#live-favorite-sounds')?'audio':target?.dataset.animationId?'animations':null;
   if(targetKind===d.list){const before=d.list==='games'?target.querySelector('[data-live-game]')?.dataset.liveGame:d.list==='audio'?target.dataset.soundId:target.dataset.animationId;draft.favorites[d.list]=moveFavorite(draft.favorites[d.list],d.id,before);changedFavorites();}
  }else if(d.next){draft.custom=true;draft[mode()]=draft[mode()].map(p=>p.id===d.id?d.next:p);apply();queueWorkspaceSave();}
 }
 // Suppress the synthetic click generated by pointerup on a game/audio card.
 if(d.moved||editing){const block=e=>{e.preventDefault();e.stopImmediatePropagation();};document.addEventListener('click',block,{capture:true,once:true});setTimeout(()=>document.removeEventListener('click',block,true),100);}
}
function init(){
 root=document.querySelector('.studio-workspace');if(!root)return;
 toolbar=document.getElementById('studio-layout-toolbar');toolbar.dataset.nativeI18n='';toolbar.addEventListener('click',action);
 toolbar.addEventListener('change',e=>{if(e.target.matches('[data-sle-profile]'))window.TikInteractStudioPersonalization.selectProfile(e.target.value);});
 for(const [id,selector]of Object.entries({games:'.studio-game-picker',audio:'.studio-audio',preview:'.studio-stage',controls:'#studio-test-panel',streamer:'.studio-connection',stats:'.studio-stats',feed:'.studio-controls>.live-grid',audience:'#studio-live-session',animations:'#studio-favorite-animations'}))register(id,root.querySelector(selector));
 root.querySelectorAll('[data-layout-panel]').forEach(node=>register(node.dataset.layoutPanel,node));
 root.addEventListener('pointerdown',e=>{const panel=e.target.closest('[data-layout-panel]');if(panel)frontPanel(panel);startPointer(e);},{capture:true});document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-sle-resize]')&&!root.contains(e.target))startPointer(e);},{capture:true});document.addEventListener('pointermove',pointerMove);document.addEventListener('pointerup',()=>endPointer(true));document.addEventListener('pointercancel',()=>endPointer(false));
 root.addEventListener('click',async e=>{
  const hide=e.target.closest('[data-sle-hide]'),move=e.target.closest('[data-sle-up],[data-sle-down],[data-sle-left],[data-sle-right]');
  if(hide&&!editing&&document.body.classList.contains('studio-widget-desktop')){window.TikInteractWidgetDesktop?.choose(hide.dataset.sleHide,false);return;}
  if(hide&&editing){draft[mode()].find(p=>p.id===hide.dataset.sleHide).hidden=true;apply();queueWorkspaceSave();return;}
  if(move&&editing){const id=move.dataset.sleUp||move.dataset.sleDown||move.dataset.sleLeft||move.dataset.sleRight,p=draft[mode()].find(p=>p.id===id);p.x=Math.max(0,Math.min(CANVAS_WIDTH[mode()]-p.w,p.x+(move.dataset.sleLeft?-8:move.dataset.sleRight?8:0)));p.y=Math.max(0,Math.min(12000,p.y+(move.dataset.sleUp?-8:move.dataset.sleDown?8:0)));apply();return;}
  const remove=e.target.closest('[data-sle-remove-animation]');if(remove){toggleAnimation(remove.dataset.sleRemoveAnimation);return;}
  if(e.target.closest('[data-sle-add-animations]')){await favoritePicker('animations');return;}
  const play=e.target.closest('[data-sle-play]');if(play&&!editing){play.disabled=true;try{await animationAPI({action:'event',manual:true,clip:play.dataset.slePlay,requestId:crypto.randomUUID()});say(t('Animație adăugată în coada LIVE.','Animation added to the LIVE queue.'));}catch(error){say(animationError(error.message));}finally{play.disabled=false;}}
 });
 document.addEventListener('keydown',e=>{const resize=e.target.closest('[data-sle-resize]'),handle=e.target.closest('[data-sle-handle]');if((!resize&&!handle)||(!editing&&!document.body.classList.contains('studio-widget-desktop'))||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||(!resize&&e.target!==handle))return;e.preventDefault();if(!editing)enableFreeLayout();if(!resize){const p=draft[mode()].find(p=>p.id===handle.dataset.sleHandle);p.x=Math.max(0,Math.min(CANVAS_WIDTH[mode()]-p.w,p.x+(e.key==='ArrowRight'?8:e.key==='ArrowLeft'?-8:0)));p.y=Math.max(0,Math.min(12000,p.y+(e.key==='ArrowDown'?8:e.key==='ArrowUp'?-8:0)));apply();queueWorkspaceSave();return;}const p=draft[mode()].find(p=>p.id===resize.dataset.sleResize);Object.assign(p,window.TikInteractWindowGeometry.resize(p,resize.dataset.resizeCorner||'se',e.key==='ArrowRight'?8:e.key==='ArrowLeft'?-8:0,e.key==='ArrowDown'?8:e.key==='ArrowUp'?-8:0,{left:0,top:0,right:CANVAS_WIDTH[mode()],bottom:13800,minWidth:mode()==='mobile'?120:160,minHeight:96,maxHeight:1800}));apply();queueWorkspaceSave();});
 window.addEventListener('tikinteract:favorites',e=>{if(!user||applying||!loaded)return;Object.assign(draft.favorites,e.detail);changedFavorites();});
 window.addEventListener('tikinteract:animation-state',e=>{library=e.detail.library;renderAnimations();});
 window.addEventListener('tikinteract:auth',()=>loadUser());
 window.addEventListener('tikinteract:language',()=>{nodes.forEach((node,id)=>{node.querySelector('[data-sle-label]').textContent=name(id);});apply();});
 matchMedia('(max-width:700px)').addEventListener('change',()=>{endPointer(false);apply();});
 let previousWidth=root.clientWidth;new ResizeObserver(()=>{if(root.clientWidth===previousWidth)return;previousWidth=root.clientWidth;if(drag)return;apply();}).observe(root);
 window.addEventListener('pagehide',()=>{clearTimeout(timer);endPointer(false);});
 window.addEventListener('blur',()=>endPointer(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();endPointer(false);apply();}});
 new MutationObserver(records=>{let added=false;for(const record of records)for(const node of record.addedNodes){if(node.nodeType!==1)continue;for(const panel of [node,...node.querySelectorAll('[data-layout-panel]')]){const id=panel.dataset.layoutPanel;if(id&&!nodes.has(id)){register(id,panel);added=true;}}}if(added){draft=normalizeLayout(draft,ids());apply();}}).observe(root,{childList:true,subtree:true});
 window.TikInteractStudioPersonalization=Object.freeze({getFavorites:()=>structuredClone(draft.favorites),toggleAnimation,registerPanel:(id,node)=>{register(id,node);draft=normalizeLayout(draft,ids());apply();},getLayout:()=>structuredClone(effectiveLayout()),setPanelVisible:(id,visible)=>{const p=draft[mode()].find(p=>p.id===id);if(!p)return;const changed=p.hidden===visible;p.hidden=!visible;originalHidden.set(id,!visible);apply();if(changed)queueWorkspaceSave();},isEditing:()=>editing,
 getStatus:()=>({loaded,busy,cloud,canPublish,active,profiles:profiles.map(({id,name})=>({id,name}))}),
 saveLayout:async()=>{if(!loaded||busy||!user)return false;enableFreeLayout();return save({lock:false});},
 openProfiles:()=>profileDialog(),publishLayout:()=>{enableFreeLayout();publishDialog();},
 selectProfile:async id=>{const profile=profiles.find(p=>p.id===id);if(!profile||busy)return;active=id;restoredLayout=true;write(presentationKey(),true);draft=normalizeLayout(profile.layout,ids());saved=structuredClone(draft);applyFavorites();apply();cache();window.dispatchEvent(new CustomEvent('tikinteract:layout-profile',{detail:{visible:draft[mode()].filter(p=>!p.hidden).map(p=>p.id)}}));try{await rpc('studio_layout_select',{p_id:id});}catch(error){say(errorText(error));}},
 restoreLayout:value=>{draft=normalizeLayout(value,ids());applyFavorites();apply();cache();queueWorkspaceSave();}
 });
 loadUser();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
