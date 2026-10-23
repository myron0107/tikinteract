import {esc,ic} from './creator-ui.js?v=4';
import {animationAPI as api,animationText as t,animationError} from './animations-client.js?v=2';
import {mediaCards,filteredClips,tabs,button,option} from './animations-live-views.js?v=4';
import {renderAnimationWorkspace as renderAnimations} from './animations-workspace-views.js?v=3';
import {loadAnimationState} from './animations-state.js?v=3';
import {creditPurchase} from './animations-credit-purchase.js?v=1';
let root,dialog,opener,interval,epoch=0,refreshing=false,photoFile=null,uploadId=null,requestId=null,lastSignature='',mountPromise,accountId=null,lastAccessPlan=null;
const checkoutRequests=new Map();
const s={workspace:'live',tab:'library',world:'vampire',tier:'standard',format:'16:9',prompt:'',character:'',consent:false,photo:'',photoName:'',busy:false,query:'',filter:'all',worlds:[],library:[],rules:[],jobs:[],wallet:{included:0,purchased:0,debt:0},config:{enabled:false,testMode:true,packages:[]},transactions:[],orders:[]};
const lastTabs={ai:'generator',live:'library'};let requestedRule=null;
Object.assign(s,{ready:false,loading:true,error:null,highlight:null});
export function setAnimationWorkspace(mode,{tab,clip,highlight}={}){
 const same=mode===s.workspace;if(!same)lastTabs[s.workspace]=s.tab;s.workspace=mode==='ai'?'ai':'live';
 const wanted=tab||(same?s.tab:lastTabs[s.workspace]);s.tab=tabs(s).some(([id])=>id===wanted)||s.workspace==='ai'&&wanted==='history'?wanted:tabs(s)[0][0];
 if(clip){s.tab='events';requestedRule=clip;}
 s.highlight=highlight||null;
 if(root){draw();if(requestedRule&&s.ready){const id=requestedRule;requestedRule=null;ruleDialog(null,id);}}
}
const toast=message=>{const e=root?.querySelector('[data-an-toast]');if(e){e.textContent=message;e.hidden=false;setTimeout(()=>{e.hidden=true;},6000);}};
function draw(){if(root){root.dataset.workspace=s.workspace;root.querySelectorAll('video').forEach(v=>v.pause());root.innerHTML=renderAnimations(s);window.dispatchEvent(new CustomEvent('tikinteract:animation-view',{detail:{workspace:s.workspace,tab:s.tab,ready:s.ready}}));if(s.highlight){const card=root.querySelector(`[data-clip-id="${CSS.escape(s.highlight)}"]`);if(card){card.classList.add('an-selected-clip');card.scrollIntoView({block:'nearest',behavior:'instant'});}}}}
export function showAnimationCredits(){if(s.ready)open(t('Reîncarcă credite','Top up credits'),creditPurchase(s));}
function open(title,html){
 if(dialog?.open)dialog.close();opener=document.activeElement;
 if(!dialog){dialog=document.createElement('dialog');dialog.className='an-dialog';dialog.dataset.nativeI18n='';dialog.setAttribute('aria-labelledby','an-dialog-title');document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('[data-an-close]'))dialog.close();});dialog.addEventListener('close',()=>{dialog.querySelectorAll('video').forEach(v=>v.pause());if(opener?.isConnected)opener.focus({preventScroll:true});});dialog.addEventListener('submit',submitDialog);dialog.addEventListener('click',click);}
 dialog.innerHTML=`<header><h2 id="an-dialog-title">${esc(title)}</h2><button type="button" data-an-close aria-label="${t('Închide','Close')}">${ic('xmark')}</button></header><div class="an-dialog-body">${html}<p data-an-dialog-error role="status"></p></div>`;dialog.showModal();dialog.querySelector('[data-an-close]').focus({preventScroll:true});
}
async function reload({silent=false}={}){
 if(refreshing)return;refreshing=true;const current=epoch;
 if(!s.ready){s.loading=true;s.error=null;draw();}
 try{const data=await loadAnimationState({force:!silent});if(current!==epoch)return;const signature=JSON.stringify({...data,library:data.library.map(({url,...c})=>c)});Object.assign(s,data,{ready:true,loading:false,error:null});if(!silent||signature!==lastSignature&&!root.contains(document.activeElement)){draw();lastSignature=signature;}if(requestedRule){const id=requestedRule;requestedRule=null;ruleDialog(null,id);}}
 catch(e){if(current===epoch&&!silent){s.loading=false;s.error=e.message;s.ready=false;draw();}}
 finally{refreshing=false;}
}
async function upload(file){
 const ticket=await api({action:'upload',mime:file.type,bytes:file.size,title:file.name,format:s.format,world:s.world,consent:true});
 const result=await window.tikInteractSupabase.storage.from('studio-animations').uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:file.type});if(result.error)throw Error('ANIM_UPLOAD_FAILED');
 await api({action:'confirmUpload',id:ticket.id});return ticket.id;
}
async function generate(){
 if(s.busy)return;if(!photoFile||!s.consent){toast(t('Adaugă fotografia și confirmă acordul persoanei.','Add a photo and confirm the person’s consent.'));return;}
 s.busy=true;draw();const current=epoch;requestId||=crypto.randomUUID();let error;
 try{uploadId||=await upload(photoFile);if(current!==epoch)return;await api({action:'generate',requestId,photoId:uploadId,title:s.character||t('Personaj nou','New character'),world:s.world,prompt:s.prompt,tier:s.tier,format:s.format,duration:5,consent:s.consent});requestId=null;await reload();}
 catch(e){error=e;}finally{if(current===epoch){s.busy=false;draw();if(error)toast(animationError(error.message));}}
}
const submitButton=()=>`<button type="submit" class="an-button an-primary">${t('Salvează','Save')}</button>`;
function ruleDialog(id,selectedClip){
 if(!s.library.some(c=>c.mime==='video/mp4')){toast(t('Adaugă mai întâi un videoclip.','Add a video first.'));return;}const r=s.rules.find(r=>r.id===id);
 open(t('Regulă LIVE','LIVE rule'),`<form data-an-dialog-form="rule" data-id="${esc(id||'')}"><label>${t('Eveniment','Event')}<select name="type">${[['gift',t('Cadou TikTok','TikTok gift')],['user',t('Utilizator','User')],['threshold',t('Prag monede per eveniment','Coins per event')],['manual','Manual']].map(([v,l])=>option(v,l,r?.type||'gift')).join('')}</select></label><label>${t('ID sau numele exact al cadoului','Gift ID or exact gift name')}<input name="gift" maxlength="100" value="${esc(r?.gift||'')}" placeholder="5655 / Rose"></label><label>${t('Username fan','Fan username')}<input name="username" maxlength="31" value="${esc(r?.username||'')}" placeholder="@username"></label><label>${t('Prag cantitate / monede','Quantity / coin threshold')}<input name="threshold" type="number" min="1" max="1000000" value="${r?.threshold||1}" required></label><label>${t('Videoclip','Video')}<select name="clip">${s.library.filter(c=>c.mime==='video/mp4').map(c=>option(c.id,c.title,r?.clip||selectedClip||s.library.find(c=>c.mime==='video/mp4').id)).join('')}</select></label>${submitButton()}</form>`);
}
async function act(action,extra={}){const result=await api({action,...extra});await reload();return result;}
async function click(event){
 const shortcut=event.target.closest('[data-an-open-tab]');if(shortcut){window.TikInteractWorkspaces?.open('ai',{tab:shortcut.dataset.anOpenTab});return;}
 const tab=event.target.closest('[data-an-tab]');if(tab){s.tab=tab.dataset.anTab;draw();return;}
 for(const [attr,key] of [['world','world'],['tier','tier'],['format','format']]){const e=event.target.closest(`[data-an-${attr}]`);if(e){s[key]=e.dataset['an'+attr[0].toUpperCase()+attr.slice(1)];requestId=null;draw();return;}}
 const b=event.target.closest('[data-an-action]');if(!b)return;const id=b.dataset.id,clip=s.library.find(c=>c.id===id),rule=s.rules.find(r=>r.id===id);b.disabled=true;
 try{switch(b.dataset.anAction){
  case 'photo':root.querySelector('#an-photo').click();break;
  case 'open-ai':window.TikInteractWorkspaces?.open('ai');break;
  case 'open-live':window.TikInteractWorkspaces?.open('live');break;
  case 'send-live':window.TikInteractWorkspaces?.open('live',{tab:'animations',clip:id});break;
  case 'live-rule':ruleDialog(null,id);break;
  case 'favorite':window.TikInteractStudioPersonalization?.toggleAnimation(id);draw();break;
  case 'refresh':await reload();break;
  case 'all-worlds':s.tab='universes';draw();break;
  case 'use-world':s.tab='generator';draw();break;
  case 'events':s.tab='events';draw();break;
  case 'preview':if(clip)open(clip.title,`${clip.mime?.startsWith('image/')?`<img class="an-full-image" src="${esc(clip.url)}" alt="${esc(clip.title)}">`:`<video controls playsinline preload="metadata" src="${esc(clip.url)}"></video>`}<p>${t('Previzualizarea nu consumă credite AI.','Preview uses no AI credits.')}</p>`);break;
  case 'download':{const r=await api({action:'download',id}),a=document.createElement('a');a.href=r.url;a.rel='noreferrer';a.download=s.library.find(c=>c.id===id)?.mime==='image/jpeg'?'character.jpg':'animation.mp4';a.click();break;}
  case 'fan':if(clip)open(t('Asociază un fan','Assign a fan'),`<form data-an-dialog-form="fan" data-id="${id}"><label>Username<input name="fan" maxlength="31" value="${esc(clip.fan)}"></label>${submitButton()}</form>`);break;
  case 'delete':if(clip)open(t('Șterge videoclipul','Delete video'),`<form data-an-dialog-form="deleteMedia" data-id="${id}"><p>${esc(clip.title)}</p><p>${t('Videoclipul și regulile asociate vor fi șterse din cont.','The video and its rules will be deleted from your account.')}</p>${submitButton()}</form>`);break;
  case 'import':open(t('Importă videoclip','Import video'),`<form data-an-dialog-form="import"><label>MP4 · 100 MB<input name="file" type="file" accept="video/mp4" required></label><label><input name="rights" type="checkbox" required>${t('Am dreptul să încarc și să difuzez acest videoclip.','I have the right to upload and broadcast this video.')}</label>${submitButton()}</form>`);break;
  case 'new-world':open(t('Univers personalizat','Custom universe'),`<form data-an-dialog-form="world"><label>${t('Nume','Name')}<input name="name" maxlength="50" required></label><label>${t('Descriere','Description')}<textarea name="description" rows="3" maxlength="400" required></textarea></label><label>${t('Stil de bază','Base style')}<select name="base">${s.worlds.filter(w=>!w.id.startsWith('custom-')).map(w=>option(w.id,w.name,'vampire')).join('')}</select></label>${submitButton()}</form>`);break;
  case 'new-rule':ruleDialog();break;
  case 'edit-rule':ruleDialog(id);break;
  case 'toggle-rule':if(rule)await act('saveRule',{...rule,enabled:!rule.enabled});break;
  case 'delete-rule':await act('deleteRule',{id});break;
  case 'test-rule':if(rule)await act('event',{manual:true,clip:rule.clip,requestId:crypto.randomUUID()});toast(t('Adăugat în coada OBS.','Added to the OBS queue.'));break;
  case 'play-live':await act('event',{manual:true,clip:id,requestId:crypto.randomUUID()});toast(t('Adăugat în coada OBS.','Added to the OBS queue.'));break;
  case 'overlay':{const r=await api({action:'overlayToken'});open('OBS Browser Source',`<label>${t('Link privat — nu îl distribui','Private link — do not share')}<input readonly value="${esc(r.url)}" id="an-overlay-url"></label>${button('copy-overlay',t('Copiază linkul','Copy link'),'copy')}<p>${t('Adaugă o sursă Browser în OBS, lipește linkul și setează 1080×1920 sau 1920×1080. Linkul anterior este revocat.','Add an OBS Browser Source, paste the link and set 1080×1920 or 1920×1080. The previous link is revoked.')}</p>`);break;}
  case 'copy-overlay':await navigator.clipboard.writeText(dialog.querySelector('#an-overlay-url').value);b.textContent=t('Copiat','Copied');break;
  case 'revoke-overlay':await act('revokeOverlay');toast(t('Accesul OBS a fost revocat.','OBS access revoked.'));break;
  case 'clear-queue':await act('clearQueue');toast(t('Coada a fost golită.','Queue cleared.'));break;
  case 'cancel-job':await act('cancelJob',{id});break;
  case 'topup':{
   if(s.ready)open(t('Reîncarcă credite','Top up credits'),creditPurchase(s));break;
  }
  case 'select-package':dialog.querySelector('.an-dialog-body').innerHTML=creditPurchase(s,id)+'<p data-an-dialog-error role="status"></p>';dialog.querySelector(`[data-an-action=select-package][data-id="${CSS.escape(id)}"]`)?.focus({preventScroll:true});break;
  case 'buy-test-plan':{const key='plan:'+id,req=checkoutRequests.get(key)||crypto.randomUUID();checkoutRequests.set(key,req);const r=await api({action:'testSubscription',plan:id,requestId:req,locale:t('ro','en')});if(r.url){const url=new URL(r.url);if(url.protocol==='https:'&&url.hostname==='checkout.stripe.com')location.assign(url.href);}else{await reload();toast(t('Confirmarea abonamentului este în așteptare.','Subscription confirmation is pending.'));}break;}
  case 'buy-package':{const req=checkoutRequests.get(id)||crypto.randomUUID();checkoutRequests.set(id,req);const r=await api({action:'checkout',packageId:id,requestId:req,locale:t('ro','en')});if(r.url){const url=new URL(r.url);if(url.protocol==='https:'&&url.hostname==='checkout.stripe.com')location.assign(url.href);}else{await reload();toast(t('Confirmarea plății este în așteptare.','Payment confirmation is pending.'));}break;}
  case 'history':open(t('Istoric credite','Credit history'),`<h3>${t('Achiziții','Purchases')}</h3>${s.orders.map(o=>`<p>${o.credits} ${t('credite','credits')} · ${(o.amount/100).toFixed(2)} ${esc(o.currency.toUpperCase())} · ${esc(o.status)} ${o.test?'TEST':''}</p>`).join('')||'<p>—</p>'}<h3>${t('Operațiuni','Transactions')}</h3>${s.transactions.map(x=>`<p>${new Date(x.created_at).toLocaleString(t('ro-RO','en-GB'))} · ${esc(({grant:t('Creditare','Grant'),reserve:t('Rezervare','Reservation'),consume:t('Consum','Consumption'),return:t('Restituire','Return'),reversal:t('Rambursare / dispută','Refund / dispute')})[x.kind]||x.kind)} · ${x.amount>0?'+':''}${x.amount} ${x.test?'TEST':''}</p>`).join('')||'<p>—</p>'}${button('privacy',t('Fotografii și date personale','Photos and personal data'),'user-shield')}`);break;
  case 'privacy':open(t('Șterge datele animațiilor','Delete animation data'),`<form data-an-dialog-form="deleteData"><p>${t('Șterge fotografiile, videoclipurile, descrierile și regulile animațiilor. Istoricul financiar și soldul se păstrează. Finalizează sau anulează întâi generările active.','Delete photos, videos, prompts and animation rules. Financial history and balances are retained. Finish or cancel active generations first.')}</p>${submitButton()}</form>`);break;
 }}catch(e){if(dialog?.open)dialog.querySelector('[data-an-dialog-error]').textContent=animationError(e.message);else toast(animationError(e.message));}finally{b.disabled=false;}
}
async function submitDialog(event){
 const form=event.target;if(!form.dataset.anDialogForm)return;event.preventDefault();const f=new FormData(form),type=form.dataset.anDialogForm,b=form.querySelector('[type=submit]');b.disabled=true;
 try{
  if(type==='import'){const file=f.get('file');if(file.type!=='video/mp4'||file.size>104857600)throw Error('ANIM_INVALID_FILE');await upload(file);}
  if(type==='world')await api({action:'createWorld',...Object.fromEntries(f)});
  if(type==='fan')await api({action:'fan',id:form.dataset.id,fan:f.get('fan')});
  if(type==='deleteMedia')await api({action:'deleteMedia',id:form.dataset.id});
  if(type==='deleteData')await api({action:'deleteData',confirm:true});
  if(type==='rule')await api({action:'saveRule',id:form.dataset.id||undefined,...Object.fromEntries(f),threshold:Number(f.get('threshold')),enabled:true});
  dialog.close();await reload();
 }catch(e){dialog.querySelector('[data-an-dialog-error]').textContent=animationError(e.message);}finally{b.disabled=false;}
}
function reset(){epoch++;clearInterval(interval);if(s.photo)URL.revokeObjectURL(s.photo);photoFile=null;uploadId=null;requestId=null;checkoutRequests.clear();lastSignature='';Object.assign(s,{ready:false,loading:true,error:null,highlight:null,photo:'',photoName:'',prompt:'',character:'',consent:false,busy:false,worlds:[],library:[],rules:[],jobs:[],transactions:[],orders:[],wallet:{included:0,purchased:0,debt:0}});if(dialog?.open)dialog.close();}
async function start(){await reload();clearInterval(interval);interval=setInterval(async()=>{if(document.hidden||refreshing||!window.tikInteractUser||root.classList.contains('hidden'))return;try{if(s.jobs.some(j=>!['moderation','completed','failed','review'].includes(j.status)))await api({action:'tick'});await reload({silent:true});}catch{}},8000);}
export function mountAnimations(element){
 if(root)return mountPromise;root=element;accountId=window.tikInteractUser?.id||null;root.dataset.nativeI18n='';s.workspace=document.documentElement.dataset.workspace==='ai'?'ai':'live';s.tab=s.workspace==='ai'?'generator':'library';draw();
 root.addEventListener('click',click);root.addEventListener('input',e=>{const id=e.target.id;if(id==='an-character')s.character=e.target.value;if(id==='an-prompt')s.prompt=e.target.value;if(id==='an-library-search'){s.query=e.target.value;root.querySelector('[data-an-library-grid]').innerHTML=mediaCards(s,filteredClips(s));}});
 root.addEventListener('change',async e=>{const id=e.target.id;if(id==='an-universe'){s.world=e.target.value;requestId=null;draw();}if(id==='an-consent')s.consent=e.target.checked;if(id==='an-library-filter'){s.filter=e.target.value;draw();}
  if(id==='an-photo'){const file=e.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10485760){toast(t('Alege JPG, PNG sau WEBP, maximum 10 MB.','Choose JPG, PNG or WEBP, up to 10 MB.'));return;}try{const image=await createImageBitmap(file);if(image.width<300||image.height<300)throw Error();image.close();}catch{toast(t('Fotografia trebuie să aibă cel puțin 300×300 px.','Photo must be at least 300×300 px.'));return;}if(s.photo)URL.revokeObjectURL(s.photo);s.photo=URL.createObjectURL(file);s.photoName=file.name;photoFile=file;uploadId=null;requestId=null;draw();}
 });
 root.addEventListener('submit',e=>{if(e.target.dataset.anForm==='generate'){e.preventDefault();generate();}});
 root.addEventListener('keydown',e=>{if(!e.target.matches('[data-an-tab]'))return;const ids=tabs(s).map(([id])=>id),i=ids.indexOf(s.tab),next=e.key==='ArrowRight'?ids[(i+1)%ids.length]:e.key==='ArrowLeft'?ids[(i+ids.length-1)%ids.length]:null;if(next){e.preventDefault();s.tab=next;draw();root.querySelector(`[data-an-tab=${next}]`).focus();}});
 window.addEventListener('tikinteract:language',()=>{dialog?.close();if(s.worlds.length)draw();else reload();});
 lastAccessPlan=window.TikInteractPass?.getAccess()?.plan||null;
 window.addEventListener('tikinteract:access',()=>{const plan=window.TikInteractPass?.getAccess()?.plan||null;if(plan===lastAccessPlan)return;lastAccessPlan=plan;if(s.ready)draw();});
 window.addEventListener('tikinteract:auth',()=>{const next=window.tikInteractUser?.id||null;if(next===accountId)return;accountId=next;reset();if(next)start();else root.innerHTML='';});
 window.addEventListener('tikinteract:studio-tab',event=>{if(event.detail.tab!=='animations')root.querySelectorAll('video').forEach(v=>v.pause());else reload({silent:s.ready});});
 window.addEventListener('pagehide',reset);mountPromise=start();return mountPromise;
}
