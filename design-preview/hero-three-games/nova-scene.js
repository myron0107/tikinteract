// The preview shares the game's authored Vex choreography and original sprite sheets.
// No game session, LIVE transport or storage is created.
import {WinShow,showFrame} from '../../GAME/NOVA-VEX/src/wins.js';
const base=new URL('../../GAME/NOVA-VEX/art/',import.meta.url);
const picture=name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error(name));image.src=new URL(name,base);});
const metadata=async name=>{const response=await fetch(new URL(name,base));if(!response.ok)throw Error(name);return response.json();};
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export async function createNovaScene(){
  const [background,atlas,rival,board,reactions,props,meta,rig,reactionData,gifts]=await Promise.all([
    picture('district.webp'),picture('atlas.webp'),picture('rival.webp'),picture('board.webp'),picture('reactions.webp'),picture('physical-gifts.webp'),metadata('metadata.json'),metadata('rig.json'),metadata('reactions-metadata.json'),metadata('physical-gifts-metadata.json')
  ]);
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');
  const sprites={...meta.sprites,...reactionData.sprites};
  const show=new WinShow({shipBounds:rig.board,props:{board,rival},rivalPoses:rig.poses});
  function sprite(name,x,feet,height,rotation=0){const s=sprites[name],image=s.sheet==='reaction'?reactions:atlas,width=height*s.w/s.h;ctx.save();ctx.translate(x,feet-height/2);ctx.rotate(rotation);ctx.drawImage(image,s.x,s.y,s.w,s.h,-width/2,-height/2,width,height);ctx.restore();}
  function jetpack(x,feet,t){const s=gifts.sprites.jetpack,width=61,height=width*s.h/s.w,py=feet-74;ctx.drawImage(props,s.x,s.y,s.w,s.h,x+15-width/2,py-height/2,width,height);for(const outlet of [.255,.765]){const ox=x+15+(outlet-.5)*width,oy=py+(.945-.5)*height,length=35+Math.sin(t*35)*5,g=ctx.createLinearGradient(0,oy,0,oy+length);g.addColorStop(0,'#fffbd0');g.addColorStop(.3,'#ffc45a');g.addColorStop(1,'#ff5c3600');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(ox-4,oy);ctx.quadraticCurveTo(ox-8,oy+length*.45,ox,oy+length);ctx.quadraticCurveTo(ox+8,oy+length*.45,ox+4,oy);ctx.fill();}}
  return {canvas,phase:'jump',draw(time){
    // A landscape camera crops the portrait world, preserving the character proportions.
    const scale=canvas.width/540;ctx.setTransform(scale,0,0,scale,0,-280*scale);
    const bgHeight=background.height*540/background.width,shift=(Math.sin(time*.13)*.5+.5)*(bgHeight-960);
    ctx.drawImage(background,0,-shift,540,bgHeight);ctx.fillStyle='#07132A22';ctx.fillRect(0,0,540,960);
    for(const [x,y]of [[60,395],[445,590],[360,350],[125,675]])sprite('grass',x,y+Math.sin(time*.5+x)*3,43);
    if(time<1.8){
      const p=smooth(time/1.8),x=180+70*p,feet=550-39*p-Math.sin(p*Math.PI)*76;
      sprite('grass',180,570,45);sprite('grass',250,533,45);sprite(p<.5?'rise':'fall',x,feet,140,(p-.5)*.09);this.phase='jump';
    }else if(time<3.2){
      const p=(time-1.8)/1.4,feet=511-Math.sin(p*Math.PI)*18;
      jetpack(250,feet,time);sprite('rise',250,feet,140,Math.sin(time*4)*.035);sprite('grass',250,533,45);this.phase='jetpack';
    }else{
      const p=Math.max(0,Math.min(1,(time-3.2)/4.8));
      const job={kind:'theft',clock:0,duration:4.8},sim={clock:p*4.8,settings:{effectsIntensity:.85}},hero={x:210,y:310},frame=showFrame(job,sim.clock);
      // Identical coordinates and pose scaling to the existing homepage presentation.
      ctx.save();ctx.translate(-96,0);ctx.scale(1.65,1.65);sprite('grass',hero.x,hero.y+27,40);sprite(frame.pose,hero.x+frame.offsetX,hero.y+frame.recoil,88*(1-frame.squash),frame.tilt);show.theft(ctx,sim,job,hero,hero,frame);ctx.restore();this.phase=frame.phase;
    }
    return canvas;
  }};
}
