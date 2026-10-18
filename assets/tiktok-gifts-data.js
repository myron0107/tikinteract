// Shared normalization for genuine TikTok catalog entries and received gifts.
export function giftImageSources(...values){
    const urls=[];
    for(const value of values){
        const candidates=Array.isArray(value)?value:[...(value?.urlList||[]),...(value?.url_list||[]),...(Array.isArray(value?.url)?value.url:[value?.url]),value];
        for(const candidate of candidates){try{const url=new URL(candidate);if(url.protocol==='https:'&&!urls.includes(url.href))urls.push(url.href);}catch{}}
    }
    return urls.slice(0,8);
}
export const safeGiftImage=value=>giftImageSources(value)[0]||null;
const integer=(value,max=1000000)=>Number.isFinite(Number(value))?Math.min(max,Math.max(0,Math.floor(Number(value)))):0;
export function normalizeGiftCatalog(raw){
    const list=Array.isArray(raw)?raw:raw?.gifts||raw?.data?.gifts||[];
    const gifts=new Map();
    for(const item of list){
        const id=String(item.id??item.giftId??item.gift_id??'').slice(0,100);if(!id)continue;
        const images=giftImageSources(item.image,item.images,item.giftImage,item.icon,item.image_url);
        gifts.set(id,{id,name:String(item.name||item.giftName||'Cadou TikTok').slice(0,100),
            coins:integer(item.diamond_count??item.diamondCount??item.coins),
            image:images[0]||null,images,
            type:integer(item.type??item.giftType)});
    }
    return [...gifts.values()].sort((a,b)=>a.coins-b.coins||a.name.localeCompare(b.name));
}
export function normalizeReceivedGift(event){
    if(event?.type!=='gift'||!event.eventId)return null;
    const quantity=Math.max(1,integer(event.repeatCount??event.quantity??1,1000));
    const unitCoins=integer(event.diamondCount??event.unitCoins);
    const name=String(event.giftName||'Cadou TikTok').slice(0,100);
    const id=String(event.giftId||'').slice(0,100)||'unknown:'+name.toLowerCase();
    return {eventId:String(event.eventId).slice(0,100),id,name,quantity,unitCoins,
        coins:event.coins==null?Math.min(1000000,quantity*unitCoins):integer(event.coins),
        image:safeGiftImage(event.giftImage),sender:String(event.displayName||event.username||'Spectator').slice(0,80),
        at:Number.isFinite(event.timestamp??event.at)?(event.timestamp??event.at):Date.now()};
}
export function summarizeGifts(events=[]){
    const seen=new Set(),gifts=new Map(),recent=[];let count=0,coins=0;
    for(const event of events){
        if(!event?.eventId||seen.has(event.eventId))continue;seen.add(event.eventId);
        const gift=normalizeReceivedGift({type:'gift',giftId:event.id,giftName:event.name,repeatCount:event.quantity,diamondCount:event.unitCoins,giftImage:event.image,...event});
        if(!gift)continue;
        const item=gifts.get(gift.id)||{id:gift.id,name:gift.name,image:gift.image,unitCoins:gift.unitCoins,count:0,coins:0,firstAt:gift.at,lastAt:gift.at};
        item.count+=gift.quantity;item.coins+=gift.coins;item.firstAt=Math.min(item.firstAt,gift.at);
        if(gift.at>=item.lastAt){item.name=gift.name;item.image=gift.image||item.image;item.unitCoins=gift.unitCoins;item.lastAt=gift.at;}
        gifts.set(item.id,item);count+=gift.quantity;coins+=gift.coins;recent.push(gift);
    }
    return {count,coins,types:gifts.size,collection:[...gifts.values()].sort((a,b)=>b.coins-a.coins||b.count-a.count),recent:recent.sort((a,b)=>b.at-a.at).slice(0,30)};
}
export function filterGifts(gifts,{query='',sort='value',owned=false,collection=[]}={}){
    const ids=new Set(collection.map(gift=>gift.id));
    const search=query.trim().toLocaleLowerCase('ro');
    const rows=gifts.filter(gift=>(!search||`${gift.name} ${gift.id}`.toLocaleLowerCase('ro').includes(search))&&(!owned||ids.has(gift.id)));
    return rows.sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name):sort==='recent'?(a,b)=>(b.lastAt||b.at||0)-(a.lastAt||a.at||0):sort==='count'?(a,b)=>(b.count||0)-(a.count||0):sort==='price'?(a,b)=>(a.unitCoins??a.coins)-(b.unitCoins??b.coins):(a,b)=>(b.unitCoins??b.coins)-(a.unitCoins??a.coins));
}
export function addGiftToLedger(ledger,event){
    const gift=normalizeReceivedGift(event);if(!gift||ledger.seen.includes(gift.eventId))return false;
    const summary=ledger.summary;
    let item=summary.collection.find(item=>item.id===gift.id);
    if(!item){item={id:gift.id,name:gift.name,image:gift.image,unitCoins:gift.unitCoins,count:0,coins:0,firstAt:gift.at,lastAt:gift.at};summary.collection.push(item);}
    item.count+=gift.quantity;item.coins+=gift.coins;
    if(gift.at>=item.lastAt){item.lastAt=gift.at;item.image=gift.image||item.image;item.name=gift.name;item.unitCoins=gift.unitCoins;}
    item.firstAt=Math.min(item.firstAt,gift.at);
    summary.count+=gift.quantity;summary.coins+=gift.coins;summary.types=summary.collection.length;
    summary.recent=[gift,...summary.recent].sort((a,b)=>b.at-a.at).slice(0,30);
    ledger.seen.push(gift.eventId);if(ledger.seen.length>20000)ledger.seen.shift();
    ledger.pending.push(gift);return true;
}
