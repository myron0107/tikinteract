// In-memory, current LIVE only. No example viewers, lifetime totals or simulated game controls.
export function createStudioSession(){
 let state,seen;const reset=()=>{state={connected:false,sessionId:null,username:null,viewers:null,peak:null,likes:0,comments:0,gifts:0,coins:0,started:null,chat:[],recentGifts:[],supporters:[]};seen=new Set();};reset();
 const positive=(value,max=1000000000)=>Number.isSafeInteger(Number(value))&&Number(value)>0?Math.min(max,Number(value)):0;
 function receive(m,now=Date.now()){
  if(!m||typeof m!=='object')return false;
  if(m.type==='status'){
   if(!m.connected){state.connected=false;state.viewers=null;return true;}
   if(!m.sessionId)return false;
   if(m.sessionId!==state.sessionId){reset();state.sessionId=m.sessionId;state.started=now;}
   state.connected=true;state.username=String(m.username||'').slice(0,80);return true;
  }
  if(!state.connected||m.sessionId&&m.sessionId!==state.sessionId||m.simulated||m.test)return false;
  if(m.type==='audience'){if(m.viewerCount==null||m.viewerCount==='')return false;const value=Number(m.viewerCount);if(!Number.isSafeInteger(value)||value<0||value>10000000)return false;state.viewers=value;state.peak=Math.max(state.peak??0,value);return true;}
  if(!['chat','like','gift'].includes(m.type))return false;
  const id=m.eventId||m.messageId;if(!id||seen.has(id))return false;
  if(m.type==='gift'&&m.giftType===1&&!m.repeatEnd)return false;
  seen.add(id);if(seen.size>20000)seen.delete(seen.values().next().value);
  const username=String(m.username||'').replace(/^@/,'').slice(0,80),row={id,username,text:String(m.message||m.comment||m.text||'').slice(0,1000),at:now};
  if(m.type==='chat'){state.comments++;state.chat.unshift(row);state.chat.length=Math.min(state.chat.length,60);}
  if(m.type==='like')state.likes=Math.min(1000000000,state.likes+positive(m.likeCount));
  if(m.type==='gift'){
   const quantity=positive(m.repeatCount,1000000)||1,value=positive(m.diamondCount,1000000),coins=Math.min(1000000000,quantity*value);
   Object.assign(row,{gift:String(m.giftName||m.giftId||'Gift').slice(0,120),quantity,coins});state.gifts+=quantity;state.coins+=coins;state.recentGifts.unshift(row);state.recentGifts.length=Math.min(state.recentGifts.length,40);
   if(username){let person=state.supporters.find(p=>p.username===username);if(!person){person={username,coins:0,gifts:0};state.supporters.push(person);}person.coins+=coins;person.gifts+=quantity;state.supporters.sort((a,b)=>b.coins-a.coins);state.supporters.length=Math.min(state.supporters.length,100);}
  }
  return true;
 }
 return Object.freeze({receive,reset,snapshot:()=>structuredClone(state)});
}
