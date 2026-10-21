// Shared account inbox. Messages remain on the platform; no external mail service.
export const supportEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=supportEscape;
export const SUPPORT_TOPICS={game:'Propunere de joc',bug:'Problemă tehnică',idea:'Sugestie',question:'Întrebare'};
const STATES={open:'De răspuns',pending:'În așteptare',resolved:'Rezolvat'};
const date=value=>new Date(value).toLocaleString((window.TikInteractLanguage?.locale() || 'ro-RO'),{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
export function supportError(error){
 const message=error?.message||'';
 if(/PGRST202|schema cache|does not exist/.test(error?.code+' '+message))return 'Mesageria nu este încă activată. Echipa trebuie să configureze serviciul de suport.';
 if(message.includes('SUPPORT_ACCOUNT_REQUIRED'))return 'Intră într-un cont cu e-mail confirmat pentru a folosi mesageria.';
 if(message.includes('SUPPORT_RATE_LIMIT'))return 'Ai trimis multe mesaje. Încearcă din nou peste o oră.';
 if(message.includes('SUPPORT_CONFLICT'))return 'Conversația s-a actualizat între timp. Reîncarcă mesajele și aplică din nou modificarea.';
 if(message.includes('SUPPORT_INVALID'))return 'Verifică subiectul, mesajul și opțiunile alese.';
 if(/SUPPORT_NOT_FOUND|SUPPORT_STAFF_REQUIRED/.test(message))return 'Nu mai ai acces la această conversație.';
 return 'Mesajele nu s-au încărcat. Verifică legătura și încearcă din nou.';
}
export class SupportInbox{
 constructor({root,rpc,staff=false,idPrefix=staff?'admin':'customer',onStats=()=>{}}){
  Object.assign(this,{root,rpc,staff,idPrefix,onStats,filter:'all',search:'',offset:0,selected:null,thread:null,drafts:new Map(),requests:new Map(),epoch:0,alive:true});
  root.classList.add('support-inbox');root.classList.toggle('si-admin',staff);
  root.innerHTML=`<div class="si-toolbar"><label class="si-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" maxlength="120" placeholder="${staff?'Caută subiect, mesaj sau e-mail':'Caută în conversațiile tale'}" aria-label="Caută conversații"></label><button type="button" data-si-refresh aria-label="Actualizează mesajele"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i><span>Actualizează</span></button><span class="si-sync" role="status"></span></div><div class="si-filters" aria-label="Filtre mesaje">${[['all','Toate'],['unread','Necitite'],['open','De răspuns'],['pending','În așteptare'],['resolved','Rezolvate'],...(staff?[['mine','Atribuite mie']]:[])].map(([key,label])=>`<button type="button" data-si-filter="${key}" aria-pressed="${key==='all'}">${label}</button>`).join('')}</div><p class="si-error" role="status" hidden></p><div class="si-workspace"><aside class="si-conversations" aria-label="Lista conversațiilor"><div class="si-list"><div class="si-empty">Se încarcă mesajele…</div></div><div class="si-pagination"><button type="button" data-si-prev aria-label="Pagina precedentă">←</button><span></span><button type="button" data-si-next aria-label="Pagina următoare">→</button></div></aside><section class="si-detail" aria-label="Conversație"><div class="si-empty si-empty-detail"><span class="si-empty-icon"><i class="fa-regular fa-comments" aria-hidden="true"></i></span><h3>Alege o conversație</h3><p>${staff?'Întrebări, probleme și idei, într-un singur loc.':'Mesajele tale și răspunsurile echipei apar aici.'}</p></div></section></div>`;
  this.click=event=>this.handleClick(event);root.addEventListener('click',this.click);
  this.input=event=>{if(!event.target.matches('.si-search input'))return;clearTimeout(this.debounce);this.debounce=setTimeout(()=>{this.search=event.target.value.trim();this.offset=0;this.refreshList();},280);};root.addEventListener('input',this.input);
  this.submit=event=>{if(event.target.matches('.si-compose')){event.preventDefault();this.send(event.target);}};root.addEventListener('submit',this.submit);
  this.change=event=>{if(event.target.name==='internal')this.updateComposeMode();};root.addEventListener('change',this.change);
  this.timer=setInterval(()=>{if(this.alive&&root.isConnected&&!document.hidden&&!root.closest('[hidden]'))this.refresh();},20000);
 }
 async call(name,args={}){return this.rpc(name,args);}
 showError(error){const el=this.root.querySelector('.si-error');el.textContent=error?supportError(error):'';el.hidden=!error;}
 async start(){if(this.staff){try{this.team=await this.call('list_support_team');}catch(e){this.showError(e);}}await this.refresh();}
 destroy({clear=true}={}){this.saveDraft();this.alive=false;this.epoch++;clearInterval(this.timer);clearTimeout(this.debounce);this.root.removeEventListener('click',this.click);this.root.removeEventListener('input',this.input);this.root.removeEventListener('submit',this.submit);this.root.removeEventListener('change',this.change);if(clear){this.drafts.clear();this.requests.clear();}this.root.replaceChildren();}
 async refresh(){await this.refreshList();if(this.selected)await this.open(this.selected,{poll:true});}
 async refreshList(){
  const request=this.listRequest=(this.listRequest||0)+1;
  try{
   const data=await this.call('list_support_tickets',{p_filter:this.filter,p_search:this.search,p_limit:30,p_offset:this.offset});if(!this.alive||request!==this.listRequest)return;
   this.showError(null);this.data=data;this.onStats(data.stats);const list=this.root.querySelector('.si-list');const top=list.scrollTop;
   list.innerHTML=data.items.length?data.items.map(t=>`<button type="button" class="si-ticket ${t.id===this.selected?'is-selected':''}" data-si-ticket="${esc(t.id)}" aria-pressed="${t.id===this.selected}"><span class="si-ticket-top"><span class="si-avatar">${esc((t.ownerEmail||'?').slice(0,1).toUpperCase())}</span><span class="si-ticket-person">${esc(this.staff?t.ownerEmail:SUPPORT_TOPICS[t.topic])}</span><time>${esc(date(t.updatedAt))}</time>${t.unread?`<span class="si-unread" aria-label="${Number(t.unread)} mesaje necitite">${Number(t.unread)}</span>`:''}</span><strong>${esc(t.subject)}</strong><span class="si-ticket-preview">${esc(t.preview)}</span><span class="si-ticket-tags"><span class="si-state" data-state="${esc(t.state)}">${STATES[t.state]}</span>${this.staff&&t.priority!=='normal'?`<span class="si-priority">${t.priority==='urgent'?'Urgent':'Prioritate mare'}</span>`:''}</span></button>`).join(''):`<div class="si-empty"><i class="fa-regular fa-inbox" aria-hidden="true"></i><h3>${this.search?'Niciun rezultat':'Nicio conversație aici'}</h3><p>${this.search?'Încearcă un alt cuvânt.':'Mesajele noi vor apărea în această listă.'}</p></div>`;
   list.scrollTop=top;this.root.querySelector('[data-si-prev]').disabled=this.offset===0;this.root.querySelector('[data-si-next]').disabled=this.offset+30>=data.total;
   this.root.querySelector('.si-pagination span').textContent=data.total?`${this.offset+1}–${Math.min(this.offset+30,data.total)} / ${data.total}`:'0 conversații';
   this.root.querySelector('.si-sync').textContent='Actualizat '+new Date().toLocaleTimeString((window.TikInteractLanguage?.locale() || 'ro-RO'),{hour:'2-digit',minute:'2-digit'});
  }catch(e){if(this.alive&&request===this.listRequest){this.showError(e);this.root.querySelector('.si-list').innerHTML='<div class="si-empty">Mesajele nu sunt disponibile. Apasă Actualizează pentru a reîncerca.</div>';}}
 }
 saveDraft(){const form=this.root.querySelector('.si-compose');if(form&&this.selected)this.drafts.set(this.selected,{body:form.elements.body.value,internal:form.elements.internal?.checked||false});}
 async open(id,{poll=false,before=null}={}){
  const same=this.selected===id;
  if(!same){this.saveDraft();this.selected=id;this.thread=null;this.epoch++;this.root.querySelector('.si-detail').innerHTML='<div class="si-empty">Se încarcă conversația…</div>';}
  this.root.classList.add('si-thread-open');const epoch=this.epoch,request=this.threadRequest=(this.threadRequest||0)+1;
  try{
   const data=await this.call('get_support_thread',{p_ticket:id,p_before:before});if(!this.alive||epoch!==this.epoch||request!==this.threadRequest||this.selected!==id)return;
   this.showError(null);
   if(same&&this.thread){const combined=new Map(this.thread.messages.map(m=>[m.id,m]));data.messages.forEach(m=>combined.set(m.id,m));data.messages=[...combined.values()].sort((a,b)=>a.id-b.id);if(!before)data.hasMore=this.thread.hasMore;}
   const previous=this.thread;this.thread=data;
   if(!previous)this.renderThread();else this.renderMessages(previous,before);
   this.renderMetadata();this.root.querySelectorAll('[data-si-ticket]').forEach(b=>{const selected=b.dataset.siTicket===id;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));});
   if(!document.hidden&&this.root.getClientRects().length&&data.messages.length){await this.call('mark_support_read',{p_ticket:id,p_seen:data.messages.at(-1).id});if(!poll)await this.refreshList();}
  }catch(e){if(this.alive&&epoch===this.epoch&&request===this.threadRequest){this.showError(e);if(/SUPPORT_NOT_FOUND|SUPPORT_STAFF_REQUIRED|SUPPORT_ACCOUNT_REQUIRED/.test(e.message||'')){this.thread=null;this.root.querySelector('.si-detail').innerHTML='<div class="si-empty">Această conversație nu este disponibilă.</div>';}}}
 }
 renderThread(){
  const t=this.thread.ticket,stored=this.drafts.get(t.id)||{};
  this.root.querySelector('.si-detail').innerHTML=`<header class="si-thread-heading"><button type="button" data-si-back aria-label="Înapoi la conversații">←</button><div><span>${esc(SUPPORT_TOPICS[t.topic])} · #${esc(t.id.slice(0,8))}</span><h3>${esc(t.subject)}</h3><p>${esc(this.staff?t.ownerEmail:'Conversație privată cu echipa')}</p></div><span class="si-state si-thread-state"></span></header>${this.staff?`<div class="si-ticket-controls"><label>Stare<select name="state">${Object.entries(STATES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Prioritate<select name="priority"><option value="normal">Normală</option><option value="high">Mare</option><option value="urgent">Urgentă</option></select></label><label>Atribuie<select name="assigned"><option value="">Neatribuit</option>${(this.team||[]).map(m=>`<option value="${esc(m.id)}">${esc(m.email)}</option>`).join('')}</select></label><button type="button" data-si-update>Aplică</button></div>`:''}<div class="si-messages" role="log" aria-label="Mesaje" aria-live="polite"></div><form class="si-compose"><div class="si-compose-label"><label for="${esc(this.idPrefix)}-support-reply">${this.staff?'Răspuns către utilizator':'Mesajul tău'}</label>${this.staff?'<label class="si-note-switch"><input type="checkbox" name="internal"> Notă internă</label>':''}</div><textarea id="${esc(this.idPrefix)}-support-reply" name="body" rows="3" maxlength="4000" required placeholder="${this.staff?'Scrie un răspuns clar și util…':'Scrie un mesaj…'}">${esc(stored.body||'')}</textarea><div class="si-compose-bottom"><small>${this.staff?'Răspunsul apare în contul utilizatorului.':'Primești răspunsul aici, în Suport.'}</small><button type="submit"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Trimite</button></div></form>`;
  if(this.staff)this.root.querySelector('[name=internal]').checked=!!stored.internal;
  this.updateComposeMode();
  this.renderMessages();
 }
 updateComposeMode(){const form=this.root.querySelector('.si-compose');if(!form||!this.staff)return;const note=form.elements.internal.checked;form.querySelector('.si-compose-label>label').textContent=note?'Notă internă':'Răspuns către utilizator';form.querySelector('.si-compose-bottom small').textContent=note?'Vizibilă doar proprietarului și administratorilor.':'Răspunsul apare în contul utilizatorului.';form.querySelector('[type=submit]').innerHTML='<i class="fa-solid '+(note?'fa-lock':'fa-paper-plane')+'" aria-hidden="true"></i> '+(note?'Adaugă notă':'Trimite');}
 renderMessages(previous=null,before=null){
  if(previous&&previous.messages.length===this.thread.messages.length&&previous.messages.every((m,i)=>m.id===this.thread.messages[i].id))return;
  const root=this.root.querySelector('.si-messages'),nearEnd=root.scrollHeight-root.scrollTop-root.clientHeight<85,oldHeight=root.scrollHeight,oldTop=root.scrollTop;
  root.innerHTML=(this.thread.hasMore?'<button type="button" class="si-older" data-si-older>Încarcă mesajele anterioare</button>':'<div class="si-conversation-start">Începutul conversației · '+esc(date(this.thread.ticket.createdAt))+'</div>')+this.thread.messages.map(m=>`<article class="si-message ${m.authorKind==='staff'?'is-staff':''} ${m.internal?'is-internal':''}"><header><strong>${esc(m.author)}</strong>${m.internal?'<span><i class="fa-solid fa-lock" aria-hidden="true"></i> Notă internă</span>':''}<time>${esc(date(m.createdAt))}</time></header><p>${esc(m.body)}</p></article>`).join('');
  if(before)root.scrollTop=oldTop+root.scrollHeight-oldHeight;else if(!previous||nearEnd)root.scrollTop=root.scrollHeight;else root.scrollTop=oldTop;
 }
 renderMetadata(){
  const t=this.thread.ticket,badge=this.root.querySelector('.si-thread-state');badge.textContent=STATES[t.state];badge.dataset.state=t.state;
  const controls=this.root.querySelector('.si-ticket-controls');if(controls&&controls.dataset.version!==String(t.version)){controls.querySelector('[name=state]').value=t.state;controls.querySelector('[name=priority]').value=t.priority;controls.querySelector('[name=assigned]').value=t.assignedTo||'';controls.dataset.version=t.version;}
 }
 async send(form){
  if(this.sending||!this.thread)return;const body=form.elements.body.value.trim();if(!body)return;const id=this.selected,internal=form.elements.internal?.checked||false;
  const key=JSON.stringify([id,body,internal]);if(!this.requests.has(key))this.requests.set(key,crypto.randomUUID());const request=this.requests.get(key),epoch=this.epoch;
  this.sending=true;form.querySelector('[type=submit]').disabled=true;this.showError(null);
  try{
   await this.call('send_support_message',{p_ticket:id,p_body:body,p_internal:internal,p_request_id:request});this.requests.delete(key);if(this.drafts.get(id)?.body.trim()===body)this.drafts.delete(id);
   if(this.alive&&epoch===this.epoch&&id===this.selected){if(form.elements.body.value.trim()===body){form.reset();this.drafts.delete(id);this.updateComposeMode();}await this.open(id);await this.refreshList();}
  }catch(e){if(this.alive&&epoch===this.epoch)this.showError(e);}finally{this.sending=false;if(form.isConnected)form.querySelector('[type=submit]').disabled=false;}
 }
 async handleClick(event){
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.siTicket){await this.open(button.dataset.siTicket);return;}
  if(button.dataset.siFilter){this.filter=button.dataset.siFilter;this.offset=0;this.root.querySelectorAll('[data-si-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));await this.refreshList();}
  if(button.hasAttribute('data-si-refresh'))await this.refresh();
  if(button.hasAttribute('data-si-prev')){this.offset=Math.max(0,this.offset-30);await this.refreshList();}
  if(button.hasAttribute('data-si-next')){this.offset+=30;await this.refreshList();}
  if(button.hasAttribute('data-si-back')){this.saveDraft();this.epoch++;this.selected=null;this.thread=null;this.root.classList.remove('si-thread-open');}
  if(button.hasAttribute('data-si-older')&&this.thread?.messages.length){button.disabled=true;await this.open(this.selected,{before:this.thread.messages[0].id});if(button.isConnected)button.disabled=false;}
  if(button.hasAttribute('data-si-update')&&this.thread){
   const controls=this.root.querySelector('.si-ticket-controls'),id=this.selected,epoch=this.epoch;button.disabled=true;
   try{const data=await this.call('update_support_ticket',{p_ticket:id,p_state:controls.querySelector('[name=state]').value,p_priority:controls.querySelector('[name=priority]').value,p_assigned:controls.querySelector('[name=assigned]').value||null,p_version:this.thread.ticket.version});if(this.alive&&epoch===this.epoch){this.thread.ticket=data.ticket;this.renderMetadata();await this.refreshList();this.showError(null);}}
   catch(e){if(this.alive&&epoch===this.epoch)this.showError(e);}finally{button.disabled=false;}
  }
 }
}
