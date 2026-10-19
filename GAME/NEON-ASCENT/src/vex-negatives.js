import {clamp,lerp} from './config.js';
import {giftFrame,ease,isVexNegative,VEX_BOARD_RELEASE,VEX_TOUCHDOWN} from './gift-motion.js';

// Every downward gift is a complete Vex scene, sharing the paid travel clock.
export class VexNegatives {
  constructor(renderer){this.r=renderer;}
  actorOffset(name){
    const s=this.r.sprites[name],scale=90/(s.h*(s.vexFeet.v-s.vexHead));
    return {x:(s.novaFeet.u-s.vexFeet.u)*s.w*scale,y:(s.novaFeet.v-s.vexFeet.v)*s.h*scale,scale};
  }
  contactScene(f,x,y){
    if(!['vortex','meteor'].includes(f.kind))return null;
    const q=f.time/f.contact,ride=f.kind==='vortex';
    const mix=ride?ease((q-.74)/.10):ease((q-.70)/.12);
    const names=ride?['rideCatch','rideHold']:['pushTouch','pushExtend'];
    const alpha=ease((q-.38)/.14)*(1-ease(ride?(f.progress-VEX_BOARD_RELEASE)/.035:f.progress/.025));
    const from=this.actorOffset(names[0]),to=this.actorOffset(names[1]);
    return {names,mix,alpha,heroX:f.bx-x+f.side*lerp(from.x,to.x,mix),heroY:f.by-5-y+lerp(from.y,to.y,mix)};
  }
  paintContact(ctx,f){
    const pair=f.pair;if(!pair||pair.alpha<=0)return;
    ctx.save();ctx.translate(f.bx,f.by-5);ctx.scale(f.side,1);
    for(const [i,name]of pair.names.entries()){
      const s=this.r.sprites[name],scale=this.actorOffset(name).scale,alpha=pair.alpha*(i?pair.mix:1-pair.mix);
      if(alpha>0)this.r.sprite(name,(.5-s.vexFeet.u)*s.w*scale,(.5-s.vexFeet.v)*s.h*scale,s.w*scale,s.h*scale,0,alpha,ctx);
    }
    ctx.restore();
  }
  frame(sim,x=0,y=0){
    const a=sim.active;if(!a||!isVexNegative(a.kind))return null;
    const f=giftFrame(a),q=f.time/f.contact,side=a.startX>240?-1:1;
    const arrive=ease(q*2),leave=f.exit,baseX=clamp(x+side*83,60,420);
    let bx=lerp(side>0?565:-85,baseX,arrive)+side*leave*leave*380;
    let by=y+7+Math.sin(sim.clock*6)*1.3-leave*leave*55;
    const cast=ease((q-.55)/.45),retract=1-ease(f.progress/.32);
    let pose=q>.48&&f.progress<.5?{anvil:'vexThrow',wind:'vexPush',vortex:'vexPull',meteor:'vexPush'}[a.kind]:'idle';
    let height=90,bank=side*((1-arrive)*-.13+leave*.15);
    let boardX=bx,boardY=by,boardSize=94,phase=f.stage;
    if(a.kind==='vortex'){
      const pickup=ease((q-.48)/.52),toss=ease((f.progress-VEX_BOARD_RELEASE)/.16);
      boardSize=lerp(94,142,pickup);
      boardX=lerp(bx,x,pickup)+side*toss*toss*330;
      boardY=y+7-toss*84-leave*leave*55;
      bx=boardX+side*28*pickup;by=boardY;
      pose=q<.48?'idle':f.progress<VEX_BOARD_RELEASE?'vexPull':toss<.8?'vexPush':'idle';
      bank=side*(-.06*pickup+.12*toss);
      phase=q<.48?'arrival':q<1?'pickup':f.progress<VEX_BOARD_RELEASE?'ride':f.progress<VEX_TOUCHDOWN?'throw':'land';
    }
    if(a.kind==='meteor'){
      const reach=ease((q-.48)/.52),recoil=ease(f.progress/.3);
      const touch=this.actorOffset('pushTouch');
      bx=lerp(bx,x-side*touch.x,reach)-side*ease((q-.68)/.32)*9+side*recoil*32;
      // Vex stays at the ledge where he shoved her. He never follows her fall.
      by=y+7-Math.min(650,Math.max(0,a.startY-sim.player.y))-leave*leave*55;
      boardX=bx;boardY=by;pose=q>.48&&f.progress<.16?'vexPush':'idle';
      bank=side*(-.09*reach+.14*recoil);
      phase=q<.48?'arrival':q<1?'push':f.progress<VEX_TOUCHDOWN?'freefall':'land';
    }
    const lean=side*(a.kind==='vortex'?.12:-.09)*cast*(1-leave);
    const source=this.r.rivalPoses[pose],anchor=source.hand||{u:.25,v:.57};
    const localX=(anchor.u-.5)*height*source.w/source.h*side*(source.mirror?-1:1),localY=(anchor.v-1)*height;
    const hand={x:bx+Math.cos(lean)*localX-Math.sin(lean)*localY,y:by-5+Math.sin(lean)*localX+Math.cos(lean)*localY};
    const frame={...f,kind:a.kind,side,bx,by,boardX,boardY,boardSize,phase,pose,height,bank,cast,retract,lean,
      alpha:clamp(f.time/.12,0,1)*(1-leave),hand};
    frame.pair=this.contactScene(frame,x,y);return frame;
  }
  hero(sim){
    const f=this.frame(sim);if(!f)return null;
    const result={x:0,y:0,rotation:0,sx:1,sy:1,alpha:1,stableBody:true,pose:f.time<f.contact*.62?'idle':'reactStart'};
    if(f.kind==='vortex'){
      const pickup=ease((f.time/f.contact-.48)/.52),p=f.progress;
      const held=this.actorOffset('rideHold'),seatX=f.side*(28+held.x),seatY=2+held.y;
      if(p<VEX_BOARD_RELEASE){
        Object.assign(result,{x:seatX*pickup,y:seatY*pickup-Math.sin(pickup*Math.PI)*20,rotation:-f.side*.07*pickup,pose:pickup>.08?'reactStart':'idle'});
      }else{
        const t=clamp((p-VEX_BOARD_RELEASE)/(VEX_TOUCHDOWN-VEX_BOARD_RELEASE),0,1),settle=f.exit;
        Object.assign(result,{x:seatX*(1-ease(t))-f.side*39*Math.sin(t*Math.PI),y:seatY*(1-ease(t))-Math.sin(t*Math.PI)*67+Math.sin(settle*Math.PI)*8,
          rotation:-f.side*Math.sin(t*Math.PI)*.7,sx:1+Math.sin(settle*Math.PI)*.10,sy:1-Math.sin(settle*Math.PI)*.13,
          pose:p>=VEX_TOUCHDOWN?'reactRecover':t<.22?'reactStart':'fall'});
      }
      if(f.pair?.alpha>0)Object.assign(result,{x:lerp(result.x,f.pair.heroX,f.pair.alpha),y:lerp(result.y,f.pair.heroY,f.pair.alpha),alpha:1-f.pair.alpha});
      return {...result,flip:f.side};
    }
    if(!f.moving&&f.time<f.contact){
      if(f.pair?.alpha>0)Object.assign(result,{x:f.pair.heroX*f.pair.alpha,y:f.pair.heroY*f.pair.alpha,alpha:1-f.pair.alpha});
      return {...result,flip:f.side};
    }
    const p=f.progress,release=1-f.exit;
    result.pose=p>.82?'reactRecover':'fall';
    if(f.kind==='anvil')Object.assign(result,{x:-f.side*Math.sin(p*Math.PI)*18,rotation:-f.side*Math.sin(p*Math.PI)*.6*release});
    if(f.kind==='wind'){
      const push=ease(p/.14)*(1-ease((p-.48)/.5));
      Object.assign(result,{x:-f.side*push*21,rotation:-f.side*push*.35,y:Math.sin(p*Math.PI)*3});
    }
    if(f.kind==='meteor'){
      const airborne=clamp(p/VEX_TOUCHDOWN,0,1),settle=f.exit;
      const touch=this.actorOffset('pushTouch'),extended=this.actorOffset('pushExtend');
      const releaseX=f.side*(-touch.x-9+extended.x),releaseY=2+extended.y;
      Object.assign(result,{x:releaseX*(1-ease(p/.75))-f.side*Math.sin(airborne*Math.PI)*53,y:releaseY*(1-ease(p/.15))-Math.sin(airborne*Math.PI)*11+Math.sin(settle*Math.PI)*8,
        rotation:-f.side*Math.sin(airborne*Math.PI)*.52,pose:p>=VEX_TOUCHDOWN?'reactRecover':p<.075?'reactStart':'fall',
        sx:1+Math.sin(settle*Math.PI)*.1,sy:1-Math.sin(settle*Math.PI)*.13});
      result.alpha=1-f.pair.alpha;
    }
    return {...result,flip:result.pose.startsWith('react')?f.side:1};
  }
  behind(ctx,sim,x,y){
    const f=this.frame(sim,x,y);if(!f)return;
    ctx.save();ctx.globalAlpha*=f.alpha;
    const wake=f.stage==='release'?-f.side:f.side,speed=f.stage==='release'?f.exit:1-ease(f.time/f.contact*2);
    if(speed>.02&&sim.settings.effectsIntensity>0){
      ctx.strokeStyle='#d5a7ff';ctx.lineWidth=2;ctx.lineCap='round';
      for(let i=0;i<3;i++){
        ctx.beginPath();ctx.moveTo(f.bx+wake*39,f.by+3+i*5);ctx.lineTo(f.bx+wake*(55+speed*56+i*9),f.by+3+i*5);ctx.stroke();
      }
    }
    this.r.winShow.board(ctx,f.boardX,f.boardY,f.boardSize,f.bank,sim.clock,.8+f.exit*2+(f.phase==='ride'?.7:0));
    ctx.save();ctx.globalAlpha*=1-(f.pair?.alpha||0);
    if(ctx.globalAlpha>0)this.r.winShow.rival(ctx,f.bx,f.by-5,f.height,f.pose,f.lean,f.side);
    ctx.restore();this.paintContact(ctx,f);
    ctx.restore();
  }
  prop(name,x,y,w,h,rotation=0,alpha=1){
    const s=this.r.actionSprites[name],fit=Math.min(w/s.w,h/s.h);
    this.r.sprite(name,x,y,s.w*fit,s.h*fit,rotation,alpha);
  }
  front(ctx,sim,x,y){
    const f=this.frame(sim,x,y);if(!f)return;
    ctx.save();ctx.globalAlpha*=f.alpha;
    if(f.kind==='anvil'){
      const target={x:x+f.side*4,y:y+5},cast=f.cast;
      let px=lerp(f.hand.x,target.x,cast),py=lerp(f.hand.y,target.y,cast)-Math.sin(cast*Math.PI)*33;
      if(f.time>=f.contact){px=target.x-f.side*ease(f.progress)*65;py=target.y+f.progress*45;}
      this.prop('banana',px,py,48,43,-f.side*(cast*3+f.progress*4),1-ease(f.progress/.48));
    }
    if(f.kind==='wind'){
      const extension=f.cast*f.retract,start={x:f.hand.x-f.side*22,y:f.hand.y};
      const gx=lerp(start.x,x+f.side*20,extension),gy=lerp(start.y,y-48,extension);
      const end={x:gx+f.side*22,y:gy};
      ctx.lineWidth=3;ctx.strokeStyle='#9585bb';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(f.hand.x,f.hand.y);
      for(let i=1;i<=12;i++){
        const p=i/12;ctx.lineTo(lerp(f.hand.x,end.x,p),lerp(f.hand.y,end.y,p)+(i%2?4:-4)*extension);
      }ctx.stroke();
      this.prop('glove',gx,gy,51,58,f.side*Math.PI/2);
    }
    if(['vortex','meteor'].includes(f.kind)){
      const falling=f.kind==='meteor'?f.progress/VEX_TOUCHDOWN:(f.progress-VEX_BOARD_RELEASE)/(VEX_TOUCHDOWN-VEX_BOARD_RELEASE);
      if(falling>0&&falling<1&&sim.settings.effectsIntensity>0){
        const h=this.hero(sim);ctx.strokeStyle='#c4ecff';ctx.lineWidth=1.4;ctx.lineCap='round';ctx.globalAlpha*=Math.sin(falling*Math.PI)*.6*sim.settings.effectsIntensity;
        for(let i=0;i<4;i++){
          const dx=(i-1.5)*31;ctx.beginPath();ctx.moveTo(x+h.x+dx,y+h.y-107-i%2*13);ctx.lineTo(x+h.x+dx,y+h.y-85-i%2*13);ctx.stroke();
        }
      }
      if(f.progress>=VEX_TOUCHDOWN){
        const age=f.time-(f.contact+(f.end-f.contact)*VEX_TOUCHDOWN),p=clamp(age/.4,0,1);
        ctx.fillStyle='#c6c3ff';ctx.globalAlpha=f.alpha*(1-p)*.38*sim.settings.effectsIntensity;
        for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(x+(i-1)*(9+p*20),y+3-p*9,5+p*10,2+p*3,0,0,Math.PI*2);ctx.fill();}
      }
    }
    ctx.restore();
  }
}
