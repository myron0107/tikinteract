import {normalizeLayout,CANVAS_WIDTH} from './studio-personalization-model.js?v=3';
export const DEFAULT_PRESET='studio-default-v1';
const all=['games','audio','animations','preview','streamer','controls','audience','stats','feed'];
export function createStudioDefaultLayout({width=1920,height=984,favorites={},ids=all}={}){
 const desktopWidth=Math.max(720,width),h=Math.max(620,height),gap=8,left=104,right=8,available=desktopWidth-left-right;
 const rows=[],add=(id,x,y,w,height)=>rows.push({id,x,y,w,h:height,hidden:false});
 if(desktopWidth>=1200){
  const lw=Math.min(390,Math.max(240,available*.218)),rw=Math.min(380,Math.max(250,available*.21)),cx=left+lw+gap,cw=available-lw-rw-gap*2,rx=cx+cw+gap,main=Math.round(h*.73),games=Math.round(h*.30),audio=Math.round(h*.43),connection=Math.min(310,Math.max(260,h*.30));
  add('games',left,4,lw,games-gap);add('audio',left,games+4,lw,audio-gap);add('animations',left,games+audio+4,lw,h-games-audio-12);
  add('preview',cx,4,cw,main-gap);add('audience',cx,main+4,cw,h-main-12);
  add('streamer',rx,52,rw,connection-gap);add('controls',rx,52+connection,rw,h-connection-60);
 }else{
  const lw=Math.min(280,available*.34),cx=left+lw+gap,cw=available-lw-gap,main=Math.max(440,h*.67);
  add('games',left,56,lw,250);add('audio',left,314,lw,320);add('animations',left,642,lw,220);
  add('preview',cx,56,cw,main);add('audience',cx,64+main,cw,260);
  const below=Math.max(878,main+332);add('streamer',left,below,lw,310);add('controls',cx,below,cw,380);
 }
 const mobileWidth=width<=700?width:384,mobileLeft=76,mw=Math.max(200,mobileWidth-mobileLeft-8),mobile=[];let y=64;
 for(const [id,ph]of [['preview',Math.max(520,Math.min(720,height-100))],['games',210],['audio',280],['animations',210],['streamer',320],['controls',320],['audience',330]]){mobile.push({id,x:mobileLeft,y,w:mw,h:ph,hidden:false});y+=ph+10;}
 const convert=(items,pixels,mode)=>ids.map(id=>{const p=items.find(p=>p.id===id);if(!p)return{id,x:0,y:0,w:200,h:180,hidden:true};return{...p,x:Math.round(p.x*CANVAS_WIDTH[mode]/pixels),y:Math.round(p.y),w:Math.round(p.w*CANVAS_WIDTH[mode]/pixels),h:Math.max(96,Math.round(p.h))};});
 return normalizeLayout({version:2,custom:true,preset:DEFAULT_PRESET,favorites,desktop:convert(rows,desktopWidth,'desktop'),mobile:convert(mobile,mobileWidth,'mobile')},ids);
}
