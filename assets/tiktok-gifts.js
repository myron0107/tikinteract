import {normalizeGiftCatalog,addGiftToLedger,filterGifts,giftImageSources} from './tiktok-gifts-data.js?v=2';

const $=id=>document.getElementById(id),ledgers=new Map(),flights=new Map();
const empty=()=>({count:0,coins:0,types:0,collection:[],recent:[]});
const username=value=>/^[A-Za-z0-9._]{2,24}$/.test(String(value||'').replace(/^@/,''))?String(value).replace(/^@/,'').toLowerCase():'';
const format=value=>new Intl.NumberFormat('ro-RO').format(value||0);
const coinText=value=>format(value)+(Number(value)===1?' monedă':' monede');
const receivedText=count=>'×'+format(count)+(Number(count)===1?' primit':' primite');
const date=value=>new Date(value).toLocaleString('ro-RO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
let receiver='',view='catalog',limit=60,cloudUnavailable=false,storageError=false,display=empty(),readVersion=0;
let catalog={gifts:[],updatedAt:null,username:null},catalogPending=false,catalogRequest=0;
let bundledPromise=null;
const bundledImages=new Map();
try{const saved=JSON.parse(localStorage.getItem('tikinteract-gift-catalog-v1')||'null');if(saved)catalog={...saved,gifts:normalizeGiftCatalog(saved.gifts)};}catch{}
async function loadBundledCatalog(){
    if(!bundledPromise)bundledPromise=(async()=>{
        const response=await fetch(new URL('./tiktok-gifts-catalog.json',import.meta.url));
        if(!response.ok)throw new Error('Catalog indisponibil');
        const snapshot=await response.json(),gifts=normalizeGiftCatalog(snapshot.gifts);
        for(const gift of gifts){const file=snapshot.imageFiles?.[gift.id];if(/^assets\/tiktok-gift-images\/[a-f0-9]{64}\.(webp|png|jpg)$/.test(file||''))bundledImages.set(gift.id,{file,source:gift.image});}
        if(!catalog.gifts.length||snapshot.updatedAt>(catalog.updatedAt||0))catalog={gifts,updatedAt:snapshot.updatedAt,username:null,scope:'catalog',source:snapshot.source,region:snapshot.region};
        render();
    })().catch(()=>{if(!catalog.gifts.length){catalog.error='Catalogul nu s-a putut încărca. Încearcă actualizarea de la TikTok.';render();}});
    return bundledPromise;
}
function ledgerFor(name){
    name=username(name);if(!name)return null;if(ledgers.has(name))return ledgers.get(name);
    let ledger={summary:empty(),seen:[],pending:[]};
    try{const saved=JSON.parse(localStorage.getItem('tikinteract-gifts-v1:'+name)||'null');if(saved?.summary?.collection&&Array.isArray(saved.seen)&&Array.isArray(saved.pending))ledger=saved;}catch{}
    ledgers.set(name,ledger);return ledger;
}
function persist(name){try{localStorage.setItem('tikinteract-gifts-v1:'+username(name),JSON.stringify(ledgerFor(name)));storageError=false;}catch{storageError=true;}}
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!=null)element.textContent=text;return element;}
function icon(name){const element=node('i','fa-solid fa-'+name);element.setAttribute('aria-hidden','true');return element;}
function thumbnail(gift){
    const wrap=node('span','gift-art');wrap.append(icon('gift'));
    const known=catalog.gifts.find(item=>item.id===gift.id),sources=giftImageSources(gift.image,gift.images,known?.image,known?.images),local=bundledImages.get(gift.id);
    if(local&&(!gift.image||local.source===sources[0]))sources.unshift(new URL(local.file,document.baseURI).href);
    if(sources.length){const image=node('img');let index=0;image.src=sources[0];image.alt=gift.name;image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.dataset.tiktokSource=gift.image||known?.image||'';image.addEventListener('load',()=>wrap.classList.add('has-image'),{once:true});image.addEventListener('error',()=>{index++;if(sources[index])image.src=sources[index];else image.remove();});wrap.append(image);}
    return wrap;
}
function stat(label,value,suffix=''){const box=node('div','gifts-stat');box.append(node('span','',label),node('strong','',value));if(suffix)box.append(node('small','',suffix));return box;}
function summaryInto(target,data){
    if(!target)return;target.replaceChildren();
    const best=[...data.collection].sort((a,b)=>b.unitCoins-a.unitCoins)[0];
    target.append(stat('Cadouri primite',format(data.count)),stat('Monede din cadouri',format(data.coins)),stat('Tipuri colectate',format(data.types)),stat('Cel mai valoros',best?.name||'—',best?format(best.unitCoins)+' monede / cadou':''));
}
function card(gift,kind='collection'){
    const tile=node('article','gift-card'+((gift.unitCoins??gift.coins)>=1000?' is-valuable':''));
    tile.dataset.giftId=gift.id;
    tile.append(thumbnail(gift),node('h3','',gift.name));
    const price=gift.unitCoins??gift.coins,value=node('span','gift-value');value.append(icon('coins'),document.createTextNode(price>0?coinText(price):'Valoare indisponibilă'));tile.append(value);
    if(kind==='collection'){
        tile.append(node('span','gift-owned',receivedText(gift.count)),node('small','gift-card-detail',coinText(gift.coins)+' în total'));
    }else{
        const owned=display.collection.find(item=>item.id===gift.id);
        if(owned)tile.append(node('span','gift-owned',receivedText(owned.count)),node('small','gift-card-detail',coinText(owned.coins)+' în total'));
        else tile.append(node('small','gift-card-detail','Încă neprimit'));
    }
    return tile;
}
function recentRow(gift){
    const row=node('article','gift-recent-row'),info=node('div','gift-recent-info'),value=node('div','gift-recent-value');
    info.append(node('strong','',gift.name+' ×'+format(gift.quantity)),node('span','','De la '+gift.sender));
    value.append(node('strong','',format(gift.coins)+' monede'),node('time','',date(gift.at)));row.append(thumbnail(gift),info,value);return row;
}
function showEmpty(target,title,text){const box=node('div','gifts-empty');box.append(icon('gift'),node('h3','',title),node('p','',text));target.append(box);}
function render(){
    const root=$('gifts-content');if(!root)return;
    const isCatalog=view==='catalog';
    $('gifts-owner').textContent=isCatalog?'Toate cadourile TikTok':receiver?'Colecția @'+receiver:'Colecția ta de cadouri';
    const ownerNote=$('gifts-owner-note');if(ownerNote)ownerNote.textContent=isCatalog?'Imagini originale de la TikTok':'Cadouri primite, nu trimise';
    $('gifts-summary').hidden=isCatalog;
    summaryInto($('gifts-summary'),display);
    document.querySelectorAll('[data-gifts-view]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.giftsView===view)));
    $('gift-catalog-controls').hidden=!isCatalog;
    $('gifts-tools').hidden=view==='recent';
    const status=$('gifts-status');
    status.textContent=storageError?'Spațiul de stocare este plin. Păstrează pagina deschisă până se sincronizează cadourile.':isCatalog?(catalogPending?'Se actualizează lista de la TikTok…':catalog.error|| (catalog.updatedAt?'Preluat de la TikTok · '+date(catalog.updatedAt):'Se încarcă catalogul TikTok…')):cloudUnavailable?'Salvat pe acest dispozitiv · sincronizarea publică nu este disponibilă momentan.':'Colecția include cadourile primite de la activare.';
    root.replaceChildren();root.className=view==='recent'?'gifts-recent-list':'gifts-grid';
    let rows;
    if(view==='recent')rows=display.recent;
    else rows=filterGifts(isCatalog?catalog.gifts:display.collection,{query:$('gifts-search').value,sort:view==='highlights'?'value':$('gifts-sort').value,owned:isCatalog&&$('gifts-owned-only').checked,collection:display.collection});
    if(view==='highlights')rows=rows.slice(0,12);
    $('gifts-result-count').textContent=format(rows.length)+(view==='recent'?' recente':isCatalog?' cadouri în catalog':' tipuri de cadouri');
    if(!rows.length)showEmpty(root,isCatalog?(catalog.gifts.length?'Niciun cadou găsit':'Se încarcă lista TikTok'):receiver?'Colecția începe cu primul cadou':'Alege profilul streamerului',isCatalog?(catalog.gifts.length?'Încearcă alt nume sau ID ori dezactivează filtrul colecției.':'Catalogul include imaginile și valorile originale, fără să fie nevoie să pornești un LIVE.'):receiver?'Cadourile primite în timpul LIVE-ului vor apărea aici, cu imagine, cantitate și valoare.':'Salvează profilul TikTok în Setări Streamer. Cadourile se atribuie persoanei care le primește.');
    rows.slice(0,limit).forEach(gift=>root.append(view==='recent'?recentRow(gift):card(gift,isCatalog?'catalog':'collection')));
    $('gifts-more').hidden=rows.length<=limit;
}
async function refreshCollection(){
    const version=++readVersion;
    display=receiver?ledgerFor(receiver).summary:empty();render();
    const client=window.tikInteractSupabase;if(!receiver||!client)return;
    const name=receiver;
    try{const{data,error}=await client.rpc('get_streamer_gift_collection',{p_tiktok_username:name});if(version!==readVersion)return;
        if(error){cloudUnavailable=true;render();return;}
        cloudUnavailable=false;
        if(data&&!ledgerFor(name).pending.length){
            const ledger=ledgerFor(name);ledger.summary=structuredClone(data);
            ledger.seen=[...new Set([...ledger.seen,...data.recent.map(item=>item.eventId)])].slice(-20000);
            persist(name);display=ledger.summary;
        }render();
    }catch{cloudUnavailable=true;render();}
}
async function flush(name=receiver){
    name=username(name);if(!name)return;
    if(flights.has(name))return flights.get(name);
    const work=(async()=>{
        const client=window.tikInteractSupabase;if(!client||!window.tikInteractUser)return;
        const active=await window.waitForTikInteractLiveSession?.();
        const ledger=ledgerFor(name);
        for(const gift of [...ledger.pending]){
            if(!active&&!gift.leaderboardSaved)continue;
            const payload={p_event_id:gift.eventId,p_tiktok_username:name,p_coins:gift.coins,p_gift_id:gift.id,p_gift_name:gift.name,p_gift_image:gift.image,p_quantity:gift.quantity,p_unit_coins:gift.unitCoins,p_sender:gift.sender};
            let result;try{result=await client.rpc('record_my_live_gift_details',payload);}catch{break;}
            if(!result.error){ledger.pending=ledger.pending.filter(item=>item.eventId!==gift.eventId);cloudUnavailable=false;persist(name);continue;}
            cloudUnavailable=true;
            if(['PGRST202','42883'].includes(result.error.code)&&gift.coins>0&&!gift.leaderboardSaved&&active){
                // Older installations still receive the existing leaderboard total once.
                const old=await client.rpc('record_my_live_gift',{p_event_id:gift.eventId,p_coins:gift.coins});
                if(!old.error){gift.leaderboardSaved=true;persist(name);}
            }
        }
    })().finally(()=>{flights.delete(name);if(name===receiver){if(!ledgerFor(name).pending.length&&!cloudUnavailable)refreshCollection();else render();}});
    flights.set(name,work);return work;
}
async function record(event,name){
    name=username(name);if(!name)return;
    const ledger=ledgerFor(name);
    if(!addGiftToLedger(ledger,event))return;
    persist(name);if(receiver===name){display=ledger.summary;render();}
    await flush(name);
}
function receiveCatalog(message){
    catalogPending=false;
    const gifts=normalizeGiftCatalog(message.gifts);
    catalog={gifts:gifts.length?gifts:catalog.gifts,updatedAt:message.updatedAt||catalog.updatedAt,username:message.username||null,scope:message.scope,source:message.source||catalog.source,region:message.region||catalog.region,error:message.error||null};
    try{localStorage.setItem('tikinteract-gift-catalog-v1',JSON.stringify(catalog));}catch{}
    render();
}
function requestCatalog(refresh=false){
    const requested=username($('gift-catalog-username')?.value||receiver||$('tiktok-user')?.value);
    if($('gift-catalog-username')&&requested)$('gift-catalog-username').value='@'+requested;
    catalogPending=true;render();
    const request=++catalogRequest;
    if(!window.requestTikTokGiftCatalog?.(requested,refresh)){catalogPending=false;catalog.error='Pornește serverul local ca să actualizezi catalogul.';render();}
    setTimeout(()=>{if(catalogPending&&request===catalogRequest){catalogPending=false;catalog.error='TikTok nu a răspuns încă. Catalogul salvat rămâne disponibil.';render();}},20000);
}
function setProfile(name){
    name=username(name);if(!name||name==='numele_tau'||name===receiver)return;
    receiver=name;if($('gift-catalog-username'))$('gift-catalog-username').value='@'+name;refreshCollection();
}
async function open(){
    setProfile($('tiktok-user')?.value);refreshCollection();
    await loadBundledCatalog();
    if(!catalog.gifts.length||Date.now()-(catalog.updatedAt||0)>6*60*60*1000)requestCatalog(false);
}
function createCollectionButton(profile){
    const button=node('button','streamer-gifts-button');button.type='button';button.append(icon('gift'),document.createTextNode('Cadouri'));
    button.setAttribute('aria-label','Colecția de cadouri a lui @'+profile.tiktok_username);
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openCollection(profile);});return button;
}
let dialog,dialogData=empty(),dialogView='collection',dialogVersion=0;
function renderDialog(){
    const summary=dialog.querySelector('[data-gift-dialog-summary]'),content=dialog.querySelector('[data-gift-dialog-content]');summaryInto(summary,dialogData);
    dialog.querySelectorAll('[data-gift-dialog-view]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.giftDialogView===dialogView)));
    content.replaceChildren();content.className=dialogView==='recent'?'gifts-recent-list':'gifts-grid';
    const rows=dialogView==='recent'?dialogData.recent:filterGifts(dialogData.collection,{sort:dialogView==='highlights'?'value':'count'}).slice(0,60);
    if(!rows.length)showEmpty(content,'Niciun cadou înregistrat încă','Cadourile noi primite în Studio apar aici.');
    rows.forEach(gift=>content.append(dialogView==='recent'?recentRow(gift):card(gift)));
}
async function openCollection(profile){
    await loadBundledCatalog();
    if(!dialog){
        dialog=node('dialog','gifts-dialog');dialog.setAttribute('aria-labelledby','gift-profile-title');
        dialog.innerHTML='<div class="gift-dialog-top"><div><span class="eyebrow">Colecția streamerului</span><h2 id="gift-profile-title"></h2></div><button type="button" data-gift-dialog-close aria-label="Închide colecția">×</button></div><p class="gifts-dialog-status" role="status"></p><div class="gifts-summary" data-gift-dialog-summary></div><div class="gifts-view-tabs"><button data-gift-dialog-view="collection">Colecție</button><button data-gift-dialog-view="recent">Recente</button><button data-gift-dialog-view="highlights">Cele mai valoroase</button></div><div data-gift-dialog-content></div>';
        document.body.append(dialog);dialog.querySelector('[data-gift-dialog-close]').onclick=()=>dialog.close();
        dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
        dialog.querySelectorAll('[data-gift-dialog-view]').forEach(button=>button.onclick=()=>{dialogView=button.dataset.giftDialogView;renderDialog();});
    }
    const version=++dialogVersion,name=username(profile.tiktok_username);dialogView='collection';dialogData=empty();
    $('gift-profile-title').textContent=profile.tiktok_display_name||'@'+name;
    const status=dialog.querySelector('.gifts-dialog-status');status.textContent='Se încarcă colecția @'+name+'…';renderDialog();if(!dialog.open)dialog.showModal();
    try{const client=window.tikInteractSupabase;if(!client)throw new Error('unavailable');
        const{data,error}=await client.rpc('get_streamer_gift_collection',{p_tiktok_username:name});if(version!==dialogVersion)return;
        if(error)throw error;if(!data){status.textContent='Nu există o colecție publică disponibilă pentru acest profil.';return;}
        dialogData=data;status.textContent='@'+name+' · Cadouri primite în Studio';renderDialog();
    }catch{if(version!==dialogVersion)return;
        const local=ledgerFor(name).summary;
        if(local.count){dialogData=local;status.textContent='@'+name+' · Colecție salvată pe acest dispozitiv';renderDialog();}
        else status.textContent='Colecțiile publice nu sunt disponibile momentan. Cadourile istorice nu pot fi reconstruite din totalul de monede.';
    }
}
window.TikInteractGifts=Object.freeze({record,flush,setProfile,receiveCatalog,open,openCollection,createCollectionButton});
function init(){
    if(!$('tiktok-gifts-panel'))return;
    document.querySelectorAll('[data-gifts-view]').forEach(button=>button.onclick=()=>{view=button.dataset.giftsView;limit=60;render();if(view==='catalog'&&!catalog.gifts.length)requestCatalog();});
    $('gifts-search').addEventListener('input',()=>{limit=60;render();});$('gifts-sort').addEventListener('change',render);$('gifts-owned-only').addEventListener('change',render);
    $('gifts-more').onclick=()=>{limit+=60;render();};
    $('gifts-refresh').onclick=()=>{flush();refreshCollection();if(view==='catalog')requestCatalog(true);};
    setProfile($('tiktok-user')?.value);render();
    setInterval(()=>{if(!document.hidden&&receiver)flush();},30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
