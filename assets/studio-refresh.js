/* Rearranges native Studio elements. No demonstration engine or replacement services. */
import{ct,esc,ic}from'./creator-ui.js?v=4';
const $=s=>document.querySelector(s),en=()=>window.TikInteractLanguage?.get()==='en',t=(ro,english)=>en()?english:ro;
let currentTab='studio',suggestedFor,accountObserver;
const names={studio:['TRANSMISIE','STREAM'],games:['JOCURI','GAMES'],audio:['PANOU DE SUNETE','SOUND PAD'],gifts:['Cadouri TikTok','TikTok Gifts'],analytics:['STATISTICI','ANALYTICS'],community:['Comunitate','Community'],account:['Contul meu','My Account'],help:['Ajutor','Help']};
function label(tab){return t(...(names[tab]||names.studio));}
function arrange(){
 const left=$('.studio-game-sidebar'),right=$('.studio-controls');if(!left||!right)return;
 const config=window.TikInteractPlatform?.getConfig()?.studio;
 const signature=config?config.left.join(',')+'|'+config.right.join(','):'';
 const defaultLayout=!config||['games,controls|streamer,audio,stats,feed','games,audio,streamer|controls,stats,feed'].includes(signature);
 if(defaultLayout){for(const selector of ['.studio-game-picker','.studio-audio']){const el=$(selector);if(el&&el.parentElement!==left)left.append(el);}for(const selector of ['#studio-test-panel','.studio-connection','.live-grid','.studio-stats']){const el=$(selector);if(el&&el.parentElement!==right)right.append(el);}}
 // The previous shell created an empty connection host above the workspace.
 const host=$('#creator-connection-host');if(host&&!host.children.length)host.hidden=true;
 requestAnimationFrame(()=>window.TikInteractStudioLayout?.fitGame());
}
function suggestions(){
 const root=$('#studio-suggestions');if(!root)return;const selected=$('#live-game-select')?.value||'';
 const games=window.TikInteractPlatform?.getConfig()?.games?.filter(g=>g.status==='published'&&g.id!==selected)||[];
 if(suggestedFor===selected&&root.children.length)return;suggestedFor=selected;
 root.innerHTML='<span>'+t('Alege un joc','Choose a game')+'</span>'+games.map(g=>'<button type="button" data-suggested-game="'+esc(g.id)+'"><img src="'+esc(g.cover)+'" alt=""><strong translate="no">'+esc(g.name)+'</strong>'+ic('play')+'</button>').join('');
}
function covers(){document.querySelectorAll('.studio-game-option').forEach(button=>{const game=window.TikInteractPlatform?.getGame(button.dataset.liveGame),img=button.querySelector('img');if(game&&img&&img.getAttribute('src')!==game.cover)img.src=game.cover;});}
function header(){
 const logo=$('.cp-rail-brand');if(logo){logo.title=t('Deschide transmisia','Open STREAM');logo.setAttribute('aria-label','TikInteract / '+label('studio'));}
 const crumb=$('#studio-current-section');const section=$('#creator-account-panel')?.dataset.accountSection;const sections={profile:['Profil','Profile'],subscription:['Abonamentul meu','My subscription'],messages:['Mesajele mele','My messages'],security:['Securitate','Security']};if(crumb)crumb.textContent=label(currentTab)+(currentTab==='account'&&sections[section]?' / '+t(...sections[section]):'');
 const title=$('.app-workspace-heading h1 [data-cp="studio"]');if(title)title.textContent=label('studio');
 document.querySelectorAll('.studio-app-rail [data-studio-tab]').forEach(button=>{const tab=button.dataset.studioTab;if(!names[tab])return;const span=button.querySelector('[data-cp]');if(span)span.textContent=label(tab);button.title=label(tab);});
 connectionLabels();

 const heading=$('.studio-connection .studio-panel-title');if(heading&&heading.textContent!=='TikTok LIVE')heading.textContent='TikTok LIVE';
 document.querySelector('.studio-controls .feed-header>span:first-child')?.replaceChildren(t('Evenimente LIVE','LIVE events'));
}
function shortConnectLabel(){const button=$('#btn-connect'),label=t('Conectează','Connect');if(button&&['Pornește Conexiunea Live','Start LIVE connection','Conectează','Connect'].includes(button.textContent.trim())&&button.textContent!==label)button.textContent=label;}
function connectionLabels(){
 shortConnectLabel();
 const input=$('#tiktok-user');if(input){input.placeholder='@username';input.setAttribute('aria-label',t('Username TikTok','TikTok username'));}
 const more=$('#studio-profile-more');if(more){const name=t('Opțiuni profil TikTok','TikTok profile options');more.title=name;more.setAttribute('aria-label',name);}
 const actions=$('.studio-profile-details .streamer-profile-actions');actions?.setAttribute('data-native-i18n','');
 for(const [selector,icon,ro,en]of [['[onclick="syncTikTokAccount()"]','check','Salvează profilul','Save profile'],['[onclick="clearTikTokAccount()"]','rotate-left','Resetează','Reset']]){
  const button=actions?.querySelector(selector);if(!button)continue;const name=t(ro,en);button.innerHTML=ic(icon)+'<span>'+name+'</span>';button.title=name;button.setAttribute('aria-label',name);
 }
}
function simplifyConnection(connection){
 const input=connection.querySelector('#tiktok-user'),connect=$('#btn-connect'),heading=connection.querySelector('.studio-panel-title'),status=$('#tiktok-sync-status');
 if(input&&connect){const row=document.createElement('div');row.className='compact-connect-row';input.before(row);row.append(input,connect);connection.querySelector('label[for="tiktok-user"]')?.classList.add('sr-only');}
 const copy=[...connection.querySelectorAll('p')].find(p=>p.textContent.includes('Salvarea username'));
 if(heading){const top=document.createElement('div');top.className='studio-connect-heading';heading.before(top);top.append(heading);heading.id='studio-connect-title';connection.setAttribute('aria-labelledby',heading.id);top.setAttribute('data-native-i18n','');
  const details=document.createElement('div');details.id='studio-profile-details';details.className='studio-profile-details';details.hidden=true;
  for(const item of [connection.querySelector('#tiktok-profile'),connection.querySelector('.streamer-profile-actions'),copy].filter(Boolean))details.append(item);
  connection.append(details);
  const toggle=document.createElement('button');toggle.type='button';toggle.id='studio-profile-more';toggle.className='studio-profile-more studio-connect-options';toggle.innerHTML=ic('ellipsis');toggle.setAttribute('aria-controls',details.id);toggle.setAttribute('aria-expanded','false');toggle.onclick=()=>{details.hidden=!details.hidden;toggle.setAttribute('aria-expanded',String(!details.hidden));};top.append(toggle);
  details.addEventListener('keydown',event=>{if(event.key==='Escape'){details.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}});
 }
 if(connect)new MutationObserver(shortConnectLabel).observe(connect,{childList:true,characterData:true,subtree:true});
 if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');const sync=()=>{status.hidden=!status.textContent.trim()||/^(Stare:|Status:)/i.test(status.textContent.trim());};new MutationObserver(sync).observe(status,{childList:true,characterData:true,subtree:true});sync();}
 connectionLabels();
}
function accountTicket(){
 const root=$('#creator-account-panel'),card=root?.querySelector('.cp-pass-card');if(!card)return;
 card.classList.add('restored-account-ticket');
 if(!card.querySelector('.restored-ticket-top')){
  const heading=card.querySelector('h3'),name=card.querySelector('[data-account-pass]'),desc=card.querySelector('#account-pass-description'),button=card.querySelector('[data-account-upgrade]');
  const top=document.createElement('div');top.className='restored-ticket-top';heading.before(top);top.append(heading,name);const price=document.createElement('div');price.className='restored-ticket-price';top.append(price);
  const body=document.createElement('div');body.className='restored-ticket-body';card.append(body);body.append(desc,button);
 }
 const access=window.TikInteractPass?.getAccess(),plan=access?.plan||'free';card.dataset.plan=plan;
 const config=window.TikInteractPlatform?.getConfig()?.plans?.find(p=>p.id===plan);const price=card.querySelector('.restored-ticket-price');
 const value=config?new Intl.NumberFormat(en()?'en-US':'ro-RO').format(config.priceCents/100)+' '+config.currency+(plan==='free'?'':t(' / lună',' / month')):'';
 if(price.textContent!==value)price.textContent=value;
 const image=$('#creator-account-panel #account-avatar-image');if(image&&!image.dataset.errorHandled){image.dataset.errorHandled='true';image.addEventListener('error',()=>{image.hidden=true;image.classList.add('hidden');});}
}
function active(tab){currentTab=tab;header();if(tab==='account'){accountObserver?.disconnect();const root=$('#creator-account-panel');if(root){accountTicket();accountObserver=new MutationObserver(accountTicket);accountObserver.observe(root,{childList:true,subtree:true});}}}
function init(){
 document.body.classList.add('studio-modern');
 const top=$('.app-topbar-title');if(top){top.innerHTML='<strong id="studio-current-section">'+label(currentTab)+'</strong>';top.setAttribute('data-native-i18n','');}
 $('.app-workspace-heading .eyebrow')?.remove();
 const rail=$('.studio-app-rail'),nav=$('.studio-app-nav');if(rail&&nav){
  nav.querySelectorAll('a,.cp-nav-label').forEach(el=>el.remove());
  const help=$('#studio-help-button');if(help){help.dataset.studioTab='help';help.setAttribute('aria-controls','studio-help-panel');help.setAttribute('role','tab');help.setAttribute('aria-selected','false');help.onclick=()=>window.setLiveStudioTab('help');}
  // Retain the native gift recording/trigger services, removing only this catalog UI.
  nav.querySelector('[data-studio-tab="gifts"]')?.remove();$('#tiktok-gifts-panel')?.remove();
  for(const tab of ['studio','games','audio','analytics']){const button=nav.querySelector('[data-studio-tab="'+tab+'"]');if(button)nav.append(button);}
  const bottom=rail.querySelector('.app-rail-bottom');if(bottom){bottom.classList.add('live-studio-tabs','studio-secondary-nav');bottom.setAttribute('role','tablist');bottom.setAttribute('aria-label',t('Cont și suport','Account and support'));bottom.querySelector('.cp-rail-account')?.remove();for(const tab of ['community','account','help']){const button=nav.querySelector('[data-studio-tab="'+tab+'"]');if(button)bottom.append(button);}const back=bottom.querySelector('a[href="index.html"]');if(back)bottom.append(back);}
  let helpPanel=$('#studio-help-panel');if(!helpPanel){helpPanel=document.createElement('section');helpPanel.id='studio-help-panel';helpPanel.className='cp-page hidden';helpPanel.setAttribute('role','tabpanel');helpPanel.setAttribute('aria-labelledby','studio-help-button');$('#view-live').append(helpPanel);}
  rail.querySelector('.cp-rail-brand').title=t('Deschide transmisia','Open STREAM');
 }
 const stage=$('.studio-stage');if(stage){stage.querySelector('.studio-stage-heading>div:first-child')?.remove();const status=$('#live-overview-status'),orientation=$('#creator-orientation');if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');}if(status&&orientation)orientation.before(status);const oldActions=stage.querySelector('.studio-stage-actions');if(oldActions&&!oldActions.children.length)oldActions.remove();
  if(!$('#studio-suggestions')){const box=document.createElement('div');box.id='studio-suggestions';box.setAttribute('data-native-i18n','');stage.append(box);}
 }
 const connection=$('.studio-connection');if(connection)simplifyConnection(connection);
 const feed=$('.studio-controls .feed-header');if(feed&&!$('#studio-clear-feed')){const button=document.createElement('button');button.type='button';button.id='studio-clear-feed';button.className='studio-profile-more';button.textContent=t('Curăță','Clear');button.onclick=()=>$('#feed-list')?.replaceChildren();feed.append(button);}
 const quick=$('.studio-game-options');if(quick)new MutationObserver(covers).observe(quick,{childList:true,subtree:true});
 $('#live-game-frame')?.addEventListener('load',()=>{suggestedFor=undefined;suggestions();});
 document.addEventListener('click',event=>{const button=event.target.closest('[data-suggested-game]');if(button)window.launchStudioGame(button.dataset.suggestedGame);});
 arrange();covers();suggestions();header();help();requestAnimationFrame(arrange);
}
function help(){const root=$('#studio-help-panel');if(!root)return;root.setAttribute('data-native-i18n','');root.innerHTML='<div class="cp-page-heading"><h2>'+label('help')+'</h2><p>'+t('Tot ce ai nevoie pentru următorul LIVE.','Everything you need for your next LIVE.')+'</p></div><div class="studio-help-cards">'+[
 ['gamepad',t('Alege jocul','Choose your game'),t('Pornește un joc din favorite sau din catalog. Schimbă formatul între 9:16 și 16:9 fără să repornești jocul.','Launch a game from your favorites or the catalog. Switch between 9:16 and 16:9 without restarting it.')],
 ['tower-broadcast',t('Conectează LIVE-ul','Connect your LIVE'),t('Introdu username-ul TikTok în panoul de conexiune. Serverul local preia comentariile, like-urile și cadourile.','Enter your TikTok username in the connection panel. The local server receives comments, likes and gifts.')],
 ['sliders',t('Controlează jocul','Control your game'),t('Comenzile din dreapta controlează direct jocul ales. Cadourile și acțiunile disponibile depind de joc.','The controls on the right act directly on your selected game. Available gifts and actions depend on the game.')],
 ['volume-high',t('Pregătește sunetele','Prepare your audio'),t('Adaugă sunete la favorite în PANOU DE SUNETE. Reglează volumul și redă-le din panoul de acces rapid.','Add favorites in SOUND PAD. Adjust the volume and play them from the quick access panel.')]
 ].map(([icon,title,copy])=>'<article class="cp-panel">'+ic(icon)+'<h3>'+title+'</h3><p>'+copy+'</p></article>').join('')+'</div><button class="cp-btn cp-btn-primary" type="button" onclick="openStudioHelp()">'+t('Pornește turul ghidat','Start the guided tour')+'</button>';
}
window.addEventListener('tikinteract:studio-tab',event=>active(event.detail.tab));
window.addEventListener('tikinteract:config',()=>{queueMicrotask(arrange);covers();suggestedFor=undefined;suggestions();accountTicket();});
window.addEventListener('tikinteract:access',accountTicket);
window.addEventListener('tikinteract:account-section',header);
window.addEventListener('tikinteract:language',()=>{header();help();suggestedFor=undefined;suggestions();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
