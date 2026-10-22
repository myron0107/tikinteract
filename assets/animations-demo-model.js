const art=new URL('./animations-demo/',import.meta.url);
export const asset=(id,suffix='jpg')=>new URL(`${id}.${suffix}`,art).href;
export const WORLDS=[
 {id:'vampire',name:'Vampire Kingdom',style:['Gotic · Cinematic','Gothic · Cinematic'],description:['Castele gotice, mantii regale și lumină roșie în ceața nopții.','Gothic castles, royal capes and red light in the night mist.']},
 {id:'knights',name:'Medieval Knights',style:['Epic · Medieval','Epic · Medieval'],description:['Fortărețe, armuri din oțel și steaguri în lumina aurie.','Fortresses, steel armour and banners in golden light.']},
 {id:'superhero',name:'Superheroes',style:['Eroic · Acțiune','Heroic · Action'],description:['Eroi originali și intrări spectaculoase deasupra orașului.','Original heroes and spectacular entrances above the city.']},
 {id:'galactic',name:'Galactic Empire',style:['SF · Spațiu','Sci-fi · Space'],description:['Nave stelare, planete îndepărtate și lumină cosmică.','Starships, distant planets and cosmic light.']},
 {id:'military',name:'Military',style:['Tactic · Cinematic','Tactical · Cinematic'],description:['Decoruri tactice, fum și personaje cu echipament original.','Tactical settings, smoke and characters in original gear.']},
 {id:'fantasy',name:'Dark Fantasy',style:['Mistic · Fantastic','Mystic · Fantasy'],description:['Păduri mistice, ruine străvechi și puteri supranaturale.','Mystical forests, ancient ruins and supernatural powers.']},
 {id:'cyberpunk',name:'Cyberpunk',style:['Neon · Viitor','Neon · Future'],description:['Orașe verticale, holograme și ploaie în lumina neonului.','Vertical cities, holograms and rain in neon light.']},
 {id:'anime',name:'Anime',style:['Anime · Stilizat','Anime · Stylised'],description:['Lumi vibrante, personaje expresive și efecte fantastice.','Vibrant worlds, expressive characters and fantasy effects.']}
];
export const GIFTS=[{id:'rose',name:'Rose',coins:1},{id:'heart',name:'Finger Heart',coins:5},{id:'galaxy',name:'Galaxy',coins:1000},{id:'universe',name:'TikTok Universe',coins:44999}];
export function defaultDemoState(){return {world:'vampire',duration:5,format:'16:9',styleLock:true,identityLock:true,custom:[],library:[
 {id:'example-throne',title:'Throne Awakening',world:'vampire',duration:5,format:'16:9',fan:'',kind:'demo'},
 {id:'example-guardian',title:'The Royal Guardian',world:'knights',duration:5,format:'16:9',fan:'',kind:'demo'},
 {id:'example-neon',title:'Neon Arrival',world:'cyberpunk',duration:5,format:'9:16',fan:'',kind:'demo'}
 ],rules:[
 {id:'example-gift',type:'gift',gift:'rose',user:'',threshold:1,clip:'example-throne',enabled:true},
 {id:'example-fan',type:'user',gift:'galaxy',user:'demo_fan',threshold:1,clip:'example-guardian',enabled:true},
 {id:'example-threshold',type:'threshold',gift:'galaxy',user:'',threshold:1000,clip:'example-neon',enabled:true}
 ]};}
const clean=(value,max=160)=>typeof value==='string'?value.trim().slice(0,max):'';
export const fanName=value=>clean(value,31).replace(/^@/,'');
export const validFan=value=>/^[\w.]{2,30}$/.test(value);
export function readDemoState(raw){
 const fallback=defaultDemoState();if(!raw||raw.version!==1)return fallback;
 const baseIds=new Set(WORLDS.map(w=>w.id));
 const custom=Array.isArray(raw.custom)?raw.custom.slice(0,16).filter(w=>/^custom-[\w-]+$/.test(w?.id)&&baseIds.has(w.base)&&clean(w.name,50)&&clean(w.description,400)).map(w=>({id:w.id,name:clean(w.name,50),base:w.base,description:clean(w.description,400)})):[];
 const worlds=new Set([...baseIds,...custom.map(w=>w.id)]);
 const library=Array.isArray(raw.library)?raw.library.slice(0,80).filter(c=>/^[\w-]{1,80}$/.test(c?.id)&&worlds.has(c.world)&&c.kind==='demo').map(c=>({id:c.id,title:clean(c.title)||'DEMO',world:c.world,kind:'demo',duration:[5,10,15].includes(c.duration)?c.duration:5,format:c.format==='9:16'?'9:16':'16:9',fan:validFan(fanName(c.fan))?fanName(c.fan):''})):fallback.library;
 const clipIds=new Set(library.map(c=>c.id));
 const rules=Array.isArray(raw.rules)?raw.rules.slice(0,40).filter(r=>/^[\w-]{1,80}$/.test(r?.id)&&['gift','user','threshold','manual'].includes(r.type)&&clipIds.has(r.clip)).map(r=>({id:r.id,type:r.type,clip:r.clip,gift:GIFTS.some(g=>g.id===r.gift)?r.gift:'rose',user:validFan(fanName(r.user))?fanName(r.user):'',threshold:Math.max(1,Math.min(1000000,Number(r.threshold)||1)),enabled:r.enabled===true})):fallback.rules.filter(r=>clipIds.has(r.clip));
 return {custom,library,rules,world:worlds.has(raw.world)?raw.world:'vampire',duration:[5,10,15].includes(raw.duration)?raw.duration:5,format:raw.format==='9:16'?'9:16':'16:9',styleLock:raw.styleLock!==false,identityLock:raw.identityLock!==false};
}
export function serializableDemoState(state){
 const library=state.library.filter(c=>c.kind==='demo').map(({id,title,world,kind,duration,format,fan})=>({id,title,world,kind,duration,format,fan})),ids=new Set(library.map(c=>c.id));
 return {version:1,world:state.world,duration:state.duration,format:state.format,styleLock:state.styleLock,identityLock:state.identityLock,custom:state.custom,library,rules:state.rules.filter(r=>ids.has(r.clip))};
}
export function matchDemoRules(rules,event){
 if(event?.demo!==true)return [];
 return rules.filter(r=>r.enabled&&(
  r.type==='manual'?event.type==='manual'&&event.rule===r.id:
  event.type==='gift'&&(r.type==='gift'?event.gift===r.gift&&Number(event.quantity)>=r.threshold:
  r.type==='user'?validFan(r.user)&&fanName(event.user).toLowerCase()===r.user.toLowerCase():
  r.type==='threshold'&&Number(event.coins)>=r.threshold)
 ));
}
export function validateDemoFile(file,type){
 const limit=type==='image'?10*1024*1024:100*1024*1024;
 return !!file&&file.size>0&&file.size<=limit&&(type==='image'?['image/jpeg','image/png','image/webp'].includes(file.type):['video/mp4','video/webm','video/ogg','video/quicktime'].includes(file.type));
}
