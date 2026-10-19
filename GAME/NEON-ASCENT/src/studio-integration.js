import {ACTIONS} from './config.js';

const KEY='tikinteract:nova-vex:gift-bindings:v1';
export class GiftBindings {
  constructor(action,storage=null){
    this.action=action;this.storage=storage;this.bindings={};
    try{
      const saved=JSON.parse(storage?.getItem(KEY)||'{}');
      for(const [kind,id]of Object.entries(saved))if(Object.hasOwn(ACTIONS,kind)&&typeof id==='string'&&id.length<=100&&!Object.values(this.bindings).includes(id))this.bindings[kind]=id;
    }catch{}
  }
  set(kind,value){
    if(!Object.hasOwn(ACTIONS,kind))return {ok:false,message:'Acțiune necunoscută.'};
    const id=String(value||'').trim();
    if(id.length>100)return {ok:false,message:'ID de cadou invalid.'};
    if(id&&Object.entries(this.bindings).some(([key,gift])=>key!==kind&&gift===id))return {ok:false,message:'Acest cadou este deja ales pentru altă acțiune.'};
    const next={...this.bindings};if(id)next[kind]=id;else delete next[kind];
    try{this.storage?.setItem(KEY,JSON.stringify(next));}catch{return {ok:false,message:'Nu am putut salva alegerea în browser.'};}
    this.bindings=next;return {ok:true};
  }
  receive(event){
    if(event?.type!=='gift'||!event.eventId||!event.giftId||event.giftType===1&&event.repeatEnd!==true)return false;
    const kind=Object.keys(this.bindings).find(key=>this.bindings[key]===String(event.giftId));if(!kind)return false;
    const amount=Math.max(1,Math.min(1000,Math.floor(Number(event.repeatCount)||1)));
    return this.action({action:kind,amount,commandId:('live:'+event.sessionId+':'+event.eventId).slice(0,128),
      actor:{username:event.username,displayName:event.displayName},gift:{name:event.giftName,repeatCount:amount},source:{simulated:false}});
  }
}

export function connectStudioGame(api){
  let storage=null;try{storage=window.localStorage;}catch{}
  const gifts=new GiftBindings(api.action,storage);
  window.TikInteractStudioControls=Object.freeze({
    ...api,
    getBindings:()=>({...gifts.bindings}),setBinding:(kind,id)=>gifts.set(kind,id),
    getDefinitions:()=>Object.entries(ACTIONS).map(([id,spec])=>({id,name:spec.name,description:spec.description,
      value:spec.setting?spec.sign*api.getSettings()[spec.setting]:id==='winAdd'?1:id==='winRemove'?-1:0}))
  });
  if(window.parent!==window)window.TikInteractGame?.register({viewport:{width:540,height:960},onGift:event=>gifts.receive(event)});
  return gifts;
}
