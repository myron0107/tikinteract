import {ACTIONS,clamp} from './config.js';
import {giftFrame,ease,isVexNegative} from './gift-motion.js';
import {VexNegatives} from './vex-negatives.js';
const TAU=Math.PI*2;
export class NeonGiftFX {
  constructor(renderer){this.r=renderer;this.bursts=[];this.vex=new VexNegatives(renderer);}
  event(e){
    if(['reset','roundStart'].includes(e.kind))this.bursts=[];
    if(e.kind==='giftContact'){this.bursts.push({kind:e.action,clock:e.clock});if(this.bursts.length>8)this.bursts.shift();}
  }
  shake(sim){
    const a=sim.active;if(!a||sim.paused)return 0;
    const t=a.elapsed-a.travelAt,force={anvil:1.2,wind:3}[a.kind]||0;
    return t>=0&&t<.24?Math.sin(t*90)*force*(1-t/.24)*sim.settings.effectsIntensity:0;
  }
  art(name,x,y,w,h,rotation=0,alpha=1,ctx=this.r.ctx){
    const s=this.r.actionSprites[name];if(!s)return;
    const fit=Math.min(w/s.w,h/s.h);this.r.sprite(name,x,y,s.w*fit,s.h*fit,rotation,alpha,ctx);
  }
  ring(ctx,x,y,rx,ry,color,alpha=1,width=2){
    ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.stroke();ctx.restore();
  }
  line(ctx,points,color,width){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
  }
  hero(sim){
    if(isVexNegative(sim.active?.kind))return this.vex.hero(sim);
    const a=sim.active,f=giftFrame(a);
    const result={x:0,y:0,rotation:0,sx:1,sy:1,alpha:1};if(!f)return result;
    const pulse=Math.sin(Math.PI*f.enter),release=1-f.exit;
    if(a.kind==='balloon'){
      const squish=f.time<f.contact?pulse*.2:Math.sin(f.progress*Math.PI)*-.09*release;
      Object.assign(result,{y:f.time<f.contact?pulse*13:0,sx:1+squish*.6,sy:1-squish,pose:f.stage==='arrive'?'land':'rise'});
    }
    if(a.kind==='magnet')Object.assign(result,{rotation:Math.sin(f.progress*TAU)*.075*release,pose:f.moving?'rise':undefined});
    if(a.kind==='cloud')Object.assign(result,{rotation:Math.sin(f.time*5)*.045*f.enter*release,pose:f.moving?'rise':undefined});
    if(a.kind==='rocket'){
      const into=ease(f.time/Math.max(.1,f.contact)),out=ease((f.progress-.58)/.35);
      if(f.stage==='arrive')Object.assign(result,{x:-45*into,sx:1-into*.9,sy:1-into*.85,alpha:1-into});
      else Object.assign(result,{x:45*(1-out)*release,sx:.1+out*.9,sy:.15+out*.85,alpha:out});
    }
    return result;
  }
  behind(ctx,sim,x,y){
    if(isVexNegative(sim.active?.kind)){this.vex.behind(ctx,sim,x,y);return;}
    const a=sim.active,f=giftFrame(a);if(!f)return;
    ctx.save();ctx.globalAlpha=1-f.exit;const t=f.time;
    if(a.kind==='magnet'){
      const hx=clamp(x+68,55,425),hy=y-185,cast=ease(t/(f.contact*.65));
      ctx.fillStyle='#152d42';ctx.fillRect(hx-37,hy-42,480-hx+37,14);
      ctx.fillStyle='#5fdef2';ctx.fillRect(hx-37,hy-42,480-hx+37,3);
      for(let i=0;i<3;i++){ctx.fillStyle='#bbf6ff';ctx.beginPath();ctx.arc(hx-25+i*22,hy-35,2,0,TAU);ctx.fill();}
      const endX=x+16+(hx-x-16)*cast,endY=y-51+(hy-y+51)*cast;
      this.line(ctx,[[x+16,y-51],[endX,endY]],'#102638',7);this.line(ctx,[[x+16,y-51],[endX,endY]],'#b4f8ff',3);
      if(cast>.85){this.art('grapple',hx,hy,65,70,0,ease((cast-.85)/.15));this.ring(ctx,hx,hy-18,24,6,'#58f0ff',.55,3);}
      if(f.moving)for(let i=0;i<3;i++){
        const p=(t*1.6+i/3)%1;this.ring(ctx,x+16+(hx-x-16)*p,y-51+(hy-y+51)*p,5,3,'#fff6b7',.7,2);
      }
    }
    if(a.kind==='cloud'){
      // One local transform for the pack AND its exhaust. Anchor measurements
      // are relative to the cropped jetpack sprite, never to the actor's feet.
      const source=this.r.actionSprites.jetpack,width=40,height=width*source.h/source.w;
      const arrival=(1-f.enter)*65,tilt=-arrival*.006+this.hero(sim).rotation;
      ctx.save();ctx.translate(x+arrival,y-48);ctx.rotate(tilt);
      this.r.sprite('jetpack',0,0,width,height);
      if(t>f.contact*.65){
        const strength=ease((t-f.contact*.65)/.3)*(1-f.exit);
        for(const [i,u]of [.255,.765].entries()){
          const nx=(u-.5)*width,ny=(.945-.5)*height,len=(25+Math.sin(t*42+i)*4)*strength;
          const g=ctx.createLinearGradient(0,ny,0,ny+Math.max(1,len));g.addColorStop(0,'#fff7c4');g.addColorStop(.25,'#ffd15b');g.addColorStop(.65,'#ff753cc9');g.addColorStop(1,'#ff453600');
          ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(nx-2.6,ny);ctx.quadraticCurveTo(nx-4,ny+len*.4,nx,ny+len);ctx.quadraticCurveTo(nx+4,ny+len*.4,nx+2.6,ny);ctx.fill();
          this.line(ctx,[[nx,ny],[nx+Math.sin(t*40)*.6,ny+len*.55]],'#fff6cb',1.2);
        }
      }
      ctx.restore();
    }
    if(a.kind==='rocket'){
      const entrance=f.stage==='arrive'?f.enter:Math.max(0,1-f.progress*3),exit=ease((f.progress-.35)/.3)*(1-f.exit);
      this.art('gate',x-45,y-42,100,152,0,entrance);this.art('gate',x+45,y-42,100,152,0,exit);
      for(let i=0;i<8;i++){
        const angle=i/8*TAU+t*3,gx=f.progress>.45?x+45:x-45;
        this.ring(ctx,gx+Math.cos(angle)*33,y-42+Math.sin(angle)*56,2.4,3.5,'#cba1ff',Math.max(entrance,exit)*.8,2);
      }
    }
    ctx.restore();
  }
  objects(ctx,sim,x,y){
    if(isVexNegative(sim.active?.kind))return;
    const a=sim.active,f=giftFrame(a);if(!f)return;const alpha=1-f.exit,t=f.time;
    if(a.kind==='balloon'){
      const compression=f.stage==='arrive'?Math.sin(f.enter*Math.PI):0,departure=f.stage==='travel'?ease(f.progress*3)*110:0;
      // Articulated top plate / stretching coil / fixed bottom plate.
      const s=this.r.actionSprites.springPad,width=100,coil=22-compression*13+Math.sin(f.progress*Math.PI)*10;
      const bottom=y+45+departure,opacity=alpha*(1-ease(f.progress*2.5));
      ctx.save();ctx.globalAlpha*=opacity;
      for(const [sourceY,sourceH,targetY,targetH]of [[0,.3,bottom-10-coil-10,10],[.3,.47,bottom-10-coil,coil],[.77,.23,bottom-10,10]]){
        ctx.drawImage(this.r.actionAtlas,s.x,s.y+s.h*sourceY,s.w,s.h*sourceH,x-width/2,targetY,width,targetH);
      }
      ctx.restore();
      if(f.moving&&f.progress<.4)for(let i=0;i<3;i++)this.line(ctx,[[x-27+i*27,y+10+f.progress*100],[x-27+i*27,y+25+f.progress*100]],'#b1f9ff',2);
    }
  }
  front(ctx,sim,x,y){
    this.vex.front(ctx,sim,x,y);
    const detail=sim.settings.effectsIntensity;ctx.save();
    this.bursts=this.bursts.filter(b=>sim.clock-b.clock<.55);
    for(const burst of this.bursts){
      const p=(sim.clock-burst.clock)/.55;ctx.globalAlpha=(1-p)*detail;const color=ACTIONS[burst.kind].color;
      if(burst.kind==='meteor')continue;
      if(['anvil','wind'].includes(burst.kind))for(let i=0;i<7;i++){
        const angle=i/7*TAU;
        this.line(ctx,[[x+Math.cos(angle)*(27+p*10),y-48+Math.sin(angle)*(27+p*10)],[x+Math.cos(angle)*(36+p*45),y-48+Math.sin(angle)*(36+p*45)]],color,3*(1-p)+.5);
      }else this.ring(ctx,x,y-3,25+p*48,7+p*13,color,1-p,2);
    }
    ctx.restore();
  }
}
