import {SupportInbox,supportEscape as esc,supportError} from './support-center.js';

let clientPromise;
async function getClient(){
 if(window.tikInteractSupabase)return window.tikInteractSupabase;
 if(!clientPromise)clientPromise=(async()=>{
  if(!window.supabase)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.onload=resolve;script.onerror=reject;document.head.append(script);});
  const response=await fetch('assets/supabase-config.json');if(!response.ok)throw Error('Unavailable');const config=await response.json();return window.supabase.createClient(config.url,config.anonKey);
 })().catch(error=>{clientPromise=null;throw error;});
 return clientPromise;
}
export function mountSupport({dialog,topics,robot,onOpen}){
 const root=dialog.querySelector('.support-content');let client,user,inbox,view='new',activeTopic,identity,epoch=0,sending=false,requestId=null,requestPayload,drafts={},replyDrafts=new Map(),replyRequests=new Map();
 const rpc=async(name,args={})=>{const {data,error}=await client.rpc(name,args);if(error)throw error;return data;};
 const teardown=()=>{if(inbox){replyDrafts=inbox.drafts;replyRequests=inbox.requests;inbox.destroy({clear:false});inbox=null;}};
 const capture=()=>{const f=root.querySelector('.support-form');if(f&&activeTopic)drafts[activeTopic]={body:f.elements.message.value,subject:f.elements.subject.value,area:f.elements.area.value};};
 const toolbar=()=>`<div class="support-account-bar"><div><button type="button" data-support-view="new" aria-pressed="${view==='new'}">Mesaj nou</button> <button type="button" data-support-view="inbox" aria-pressed="${view==='inbox'}">Conversațiile mele</button></div><span>${esc(user?.email||'')}</span></div>`;
 function render(){
  teardown();
  if(!user){root.innerHTML=`<div class="support-intro">${robot}<h2 id="resource-support-title">Cu ce te putem ajuta?</h2><p>Trimite un mesaj și urmărește răspunsul în contul tău.</p></div><div class="support-login-notice">Pentru o conversație privată, intră în cont.<br><a href="index.html?view=account">Intră în cont →</a></div>`;return;}
  root.innerHTML=toolbar()+(view==='inbox'?'<h2 id="resource-support-title" class="support-sr-only">Conversațiile mele</h2><div data-customer-inbox></div>':`<div class="support-intro">${robot}<span class="support-eyebrow">SUNTEM AICI PENTRU TINE</span><h2 id="resource-support-title">Cu ce te putem ajuta?</h2><p>Alege subiectul și spune-ne ce ai în minte.</p></div><div class="support-topics">${Object.entries(topics).map(([key,topic])=>`<button type="button" class="support-topic" data-support-topic="${key}"><span class="support-topic-icon"><i class="fa-solid ${topic.icon}" aria-hidden="true"></i></span><span><strong>${topic.title}</strong><small>${topic.description}</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>`).join('')}</div>`);
  if(view==='inbox'){inbox=new SupportInbox({root:root.querySelector('[data-customer-inbox]'),rpc,onStats:()=>window.dispatchEvent(new Event('tikinteract:support'))});inbox.drafts=replyDrafts;inbox.requests=replyRequests;inbox.start();}
 }
 async function load(){
  const current=++epoch;try{client=await getClient();const {data,error}=await client.auth.getUser();if(current!==epoch||!dialog.open)return;user=error&&!data?.user?null:data?.user||null;identity=user?.id;render();}
  catch(e){if(current===epoch&&dialog.open)root.innerHTML='<div class="support-login-notice">Suportul nu s-a încărcat. Închide panoul și încearcă din nou.</div>';}
 }
 function compose(topic){
  capture();activeTopic=topic;view='new';teardown();const t=topics[topic],saved=drafts[topic]||{};
  root.innerHTML=toolbar()+`<section data-support-write><button class="support-back" type="button" data-support-back><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Alt subiect</button><div class="support-write-heading"><span class="support-topic-icon"><i class="fa-solid ${t.icon}" aria-hidden="true"></i></span><h2 id="resource-support-title">${t.title}</h2></div><form class="support-form"><label class="support-subject-label" for="support-subject">Subiect</label><input id="support-subject" name="subject" required minlength="5" maxlength="120" value="${esc(saved.subject||t.title)}"><div ${topic==='bug'?'':'hidden'}><label for="support-area">Unde apare problema?</label><select id="support-area" name="area">${['LIVE Studio','Un joc','Conexiunea TikTok','Site / cont'].map(x=>`<option ${saved.area===x?'selected':''}>${x}</option>`).join('')}</select></div><label for="support-message">Mesajul tău</label><textarea id="support-message" name="message" required minlength="20" maxlength="4000" rows="5" placeholder="${esc(t.hint)}">${esc(saved.body||'')}</textarea><span class="support-message-hint">Minimum 20 de caractere. Fără parole sau date de conectare.</span><button class="support-submit" type="submit"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Trimite mesajul</button><p class="support-delivery-note">Răspunsul va apărea în Conversațiile mele, în contul tău.</p><p class="support-form-status" data-support-status role="status"></p></form></section>`;
  root.querySelector('[data-support-back]').focus({preventScroll:true});
 }
 async function open({inbox:showInbox=false}={}){
  if(dialog.open){if(showInbox&&user){capture();view='inbox';render();}return;}
  onOpen();view=showInbox?'inbox':'new';root.innerHTML='<p class="support-delivery-note" role="status">Se încarcă suportul…</p>';dialog.showModal();await load();
 }
 dialog.addEventListener('close',()=>{if(dialog.open)return;capture();epoch++;teardown();root.replaceChildren();});
 root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.supportTopic&&user)compose(b.dataset.supportTopic);
  if(b.hasAttribute('data-support-back')){capture();render();}
  if(b.dataset.supportView){capture();view=b.dataset.supportView;render();}
 });
 root.addEventListener('submit',async event=>{
  if(!event.target.matches('.support-form'))return;event.preventDefault();if(sending)return;
  const form=event.target,body=form.elements.message.value.trim(),subject=form.elements.subject.value.trim(),status=form.querySelector('[data-support-status]');
  if(body.length<20||subject.length<5){status.textContent='Scrie un subiect de minimum 5 caractere și un mesaj de minimum 20 de caractere.';return;}
  const payload={p_topic:activeTopic,p_subject:subject,p_body:body,p_area:activeTopic==='bug'?form.elements.area.value:''};
  const key=JSON.stringify(payload);if(requestPayload!==key){requestPayload=key;requestId=crypto.randomUUID();}
  const current=epoch,topic=activeTopic;capture();sending=true;form.querySelector('[type=submit]').disabled=true;
  try{const data=await rpc('create_support_ticket',{...payload,p_request_id:requestId});delete drafts[topic];requestId=null;requestPayload=null;if(current!==epoch||!dialog.open)return;view='inbox';render();await inbox.open(data.ticket.id);}
  catch(e){if(form.isConnected)status.textContent=supportError(e);}
  finally{sending=false;if(form.isConnected)form.querySelector('[type=submit]').disabled=false;}
 });
 window.addEventListener('tikinteract:auth',()=>{const next=window.tikInteractUser?.id;if(identity&&next!==identity){epoch++;teardown();drafts={};replyDrafts.clear();replyRequests.clear();requestId=null;requestPayload=null;user=null;identity=next;if(dialog.open)load();}else if(!identity&&next&&dialog.open)load();});
 // Pages without the site's auth UI still react to logout in another tab.
 window.addEventListener('storage',event=>{if(event.key?.includes('auth-token')&&dialog.open){capture();epoch++;teardown();drafts={};replyDrafts.clear();replyRequests.clear();load();}});
 return {open};
}
