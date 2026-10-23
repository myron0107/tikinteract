export const PANEL_DEFAULTS=[
 {id:'games',x:1,y:1,w:3,h:9},{id:'audio',x:1,y:10,w:3,h:10},
 {id:'preview',x:4,y:1,w:6,h:21},{id:'controls',x:10,y:1,w:3,h:12},
 {id:'streamer',x:10,y:13,w:3,h:5},{id:'stats',x:10,y:18,w:3,h:4},
 {id:'feed',x:10,y:22,w:3,h:7,hidden:true},{id:'animations',x:1,y:20,w:3,h:7,hidden:true}
];
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number.isFinite(n)?Math.round(n):a));
function gridLayout(value,ids){
 const out={version:1,custom:!!value?.custom,desktop:[],mobile:[],favorites:{games:[],audio:[],animations:[]}};
 for(const mode of ['desktop','mobile']){
  const seen=new Set();
  for(const p of Array.isArray(value?.[mode])?value[mode]:[]){
   if(!p||!ids.includes(p.id)||seen.has(p.id))continue;seen.add(p.id);
   const w=mode==='mobile'?12:clamp(p.w,2,12);
   out[mode].push({id:p.id,x:mode==='mobile'?1:clamp(p.x,1,13-w),y:clamp(p.y,1,400),w,h:clamp(p.h,3,40),hidden:p.hidden===true});
  }
  for(const id of ids)if(!seen.has(id)){
   const p=PANEL_DEFAULTS.find(p=>p.id===id)||{id,x:1,y:30,w:3,h:7};
   out[mode].push(mode==='mobile'?{hidden:false,...p,x:1,w:12,y:id==='preview'?1:2}:{hidden:false,...structuredClone(p)});
  }
  out[mode]=packPanels(out[mode]);
 }
 for(const kind of ['games','audio','animations'])out.favorites[kind]=[...new Set((Array.isArray(value?.favorites?.[kind])?value.favorites[kind]:[]).filter(id=>typeof id==='string'&&/^[\w.-]{1,100}$/.test(id)))].slice(0,kind==='audio'?12:40);
 return out;
}
// A fine free canvas, rather than twelve restrictive drop columns. Coordinates
// use a stable reference width; only the horizontal axis adapts to the viewport.
export const CANVAS_WIDTH={desktop:1280,mobile:384};
export const snap=n=>Math.round(n/8)*8;
export function normalizeLayout(value,ids=PANEL_DEFAULTS.map(p=>p.id)){
 const legacy=value?.version!==2?gridLayout(value,ids):null;
 const defaults=gridLayout(null,ids),out={version:2,custom:!!value?.custom,desktop:[],mobile:[],favorites:(legacy||gridLayout({favorites:value?.favorites},ids)).favorites};
 for(const mode of ['desktop','mobile']){
  const width=CANVAS_WIDTH[mode],seen=new Set(),source=legacy?.[mode]||value?.[mode]||[];
  const convert=p=>({id:p.id,x:Math.round((p.x-1)*width/12),y:(p.y-1)*36,w:Math.round(p.w*width/12-(mode==='mobile'?0:12)),h:p.h*36-12,hidden:!!p.hidden});
  for(const p of source){
   if(!p||!ids.includes(p.id)||seen.has(p.id))continue;seen.add(p.id);
   if(legacy){out[mode].push(convert(p));continue;}
   const w=clamp(p.w,mode==='mobile'?120:160,width);
   out[mode].push({id:p.id,x:clamp(p.x,0,width-w),y:clamp(p.y,0,12000),w,h:clamp(p.h,96,1800),hidden:p.hidden===true});
  }
  for(const p of defaults[mode])if(!seen.has(p.id))out[mode].push(convert(p));
 }
 return out;
}
export function overlaps(a,b){return !a.hidden&&!b.hidden&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
export function packPanels(panels,priority){
 const sorted=panels.map(p=>({...p})).sort((a,b)=>(a.id===priority?-1:b.id===priority?1:0)||a.y-b.y||a.x-b.x),placed=[];
 for(const p of sorted){if(!p.hidden){while(placed.some(q=>overlaps(p,q)))p.y++;}placed.push(p);}
 return placed;
}
export function moveFavorite(ids,id,before){const next=ids.filter(x=>x!==id),i=before?next.indexOf(before):-1;next.splice(i<0?next.length:i,0,id);return next;}
