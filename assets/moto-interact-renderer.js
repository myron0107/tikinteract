import {MOTO_TRACK_LAYOUT as TRACK_LAYOUT,drawMotoBoulevard} from './moto-interact-track.js?v=2';
import bikes from './moto-interact/bikes/manifest.js?v=3';
import {createRaceEffects} from './neon-race2-effects.js?v=6';
import {wheelieTarget,approachWheelie,wheeliePoint} from './moto-interact-motion.js?v=1';

export function createMotoRenderer(canvas) {
    const ctx=canvas.getContext('2d');
    const scenery=new Image();scenery.src='../../assets/moto-interact/scenery/day-boulevard.webp';
    const images=bikes.map(bike=>{const image=new Image();image.src='../../assets/moto-interact/bikes/'+bike.file;return image;});
    const effects=createRaceEffects(ctx,pose,{contributionStyle:{duration:.8,opacity:.9,scale:1.65,outline:true}});
    const wheelAngles=[0,0],wheelies=[0,0];
    let clock=0,lastTime=0,round=null;

    function pose(state,index) {
        const bike=bikes[index],width=330,height=width*bike.size[1]/bike.size[0];
        const foot=TRACK_LAYOUT.lanes[index].foot,x=state.visualCarLeft(index)/100*1200;
        const y=foot-bike.contact.y*height;
        const pivotX=x+bike.contact.x*width,pivotY=foot,angle=wheelies[index];
        const helmet=wheeliePoint(x+width*.51,y,angle,pivotX,pivotY);
        const nozzle={x:x+bike.exhaust.x*width,y:y+bike.exhaust.y*height};
        const exhaust={...wheeliePoint(nozzle.x,nozzle.y,angle,pivotX,pivotY),angle:-angle*Math.PI/180,scale:.72};
        return {x,y:Math.min(y,helmet.y),foot,width,height,angle,pivotX,pivotY,spriteY:y,nozzle,exhaust};
    }
    function audience() {
        for(let i=0;i<5;i++) {
            const p=(clock*.21+i*.21)%1,x=1050-p*400,y=340-p*150;
            ctx.save();ctx.globalAlpha=Math.sin(p*Math.PI)*.78;ctx.translate(x,y);ctx.scale(1.55,1.55);
            ctx.shadowColor='#263f6788';ctx.shadowBlur=3;
            ctx.fillStyle=i%2?'#fff1f5':'#f63c64';ctx.strokeStyle='#ffffff99';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(0,5);ctx.bezierCurveTo(-20,-7,-8,-18,0,-9);ctx.bezierCurveTo(8,-18,20,-7,0,5);ctx.stroke();ctx.fill();ctx.restore();
        }
    }

    function vehicle(state,index) {
        const car=pose(state,index),bike=bikes[index],image=images[index];
        const {x,spriteY:y,foot,width,height,angle,pivotX,pivotY}=car;
        ctx.save();ctx.fillStyle='#0009';
        ctx.beginPath();ctx.ellipse(x+width*.47,foot+1,width*(.38-angle*.003),4,0,0,Math.PI*2);ctx.fill();ctx.restore();
        if(!image.complete||!image.naturalWidth)return;
        ctx.save();ctx.translate(pivotX,pivotY);ctx.rotate(-angle*Math.PI/180);ctx.translate(-pivotX,-pivotY);
        // Daylight exposure lifts the dark bodywork and rider without changing the skin.
        // Wheel crops inherit the same treatment so their animated hubs stay consistent.
        ctx.filter='brightness(1.3) contrast(.92) saturate(.96)';
        ctx.drawImage(image,x,y,width,height);
        for(const wheel of bike.wheels){
            const sx=wheel.x*image.naturalWidth,sy=wheel.y*image.naturalHeight;
            const sourceRadius=wheel.radius*image.naturalWidth,radius=wheel.radius*width;
            ctx.save();ctx.translate(x+wheel.x*width,y+wheel.y*height);
            ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.clip();ctx.rotate(wheelAngles[index]);
            ctx.drawImage(image,sx-sourceRadius,sy-sourceRadius,sourceRadius*2,sourceRadius*2,-radius,-radius,radius*2,radius*2);ctx.restore();
        }
        ctx.filter='none';
        // Small tail outlet gives the jet a visible attachment above the rear tire.
        ctx.fillStyle='#19171e';ctx.fillRect(car.nozzle.x,car.nozzle.y-3.5,9,7);
        ctx.fillStyle='#817986';ctx.fillRect(car.nozzle.x-1,car.nozzle.y-2.5,2,5);
        ctx.restore();
    }
    return {
        images:[scenery,...images,...effects.images],pose,
        draw(state,time,{effectsTime=time,reduced=false}={}) {
            if(round!==state.round){round=state.round;wheelies.fill(0);wheelAngles.fill(0);lastTime=time;}
            const dt=Math.max(0,Math.min(.25,time-lastTime));lastTime=time;
            if(!state.paused&&!state.finished){
                const fastest=Math.max(state.speed(0),state.speed(1));
                const rush=Math.min(3.3,1+Math.max(0,fastest-50)/85);
                clock+=dt*(.9+rush*.6);
                state.teams.forEach((team,index)=>{
                    const target=wheelieTarget(state.speed(index),team.nitroSeconds);
                    wheelies[index]=reduced?target:approachWheelie(wheelies[index],target,dt);
                    wheelAngles[index]=(wheelAngles[index]+dt*(4+state.speed(index)*.08))%(Math.PI*2);
                });
            }
            ctx.setTransform(canvas.width/1200,0,0,canvas.height/900,0,0);
            drawMotoBoulevard(ctx,scenery,reduced?0:clock);audience();
            effects.behind(state,effectsTime,reduced);
            state.teams.forEach((_,index)=>vehicle(state,index));
            effects.foreground(state,effectsTime,reduced);
            if(Math.max(...state.teams.map(team=>team.distance))>3500||state.finished){
                ctx.save();ctx.globalAlpha=.7;
                const tileHeight=(TRACK_LAYOUT.bottom-TRACK_LAYOUT.top)/24;
                for(let row=0;row<24;row++)for(let col=0;col<2;col++){ctx.fillStyle=(row+col)%2?'#f0eef4':'#17212b';ctx.fillRect(1128+col*12,TRACK_LAYOUT.top+row*tileHeight,12,tileHeight);}
                ctx.restore();
            }
        }
    };
}
