import {TRACK_LAYOUT,drawInteractRoad} from './interact-track.js?v=1';
import nightCars from './neon-race2/cars/manifest.js?v=1';
import {createRaceEffects} from './neon-race2-effects.js?v=4';

// The homepage city and road, with custom illustrated Night Run car sprites.
export function createNightRenderer(canvas) {
    const ctx=canvas.getContext('2d');
    let clock=0,lastTime=0;
    const wheelAngles=[0,0];
    const images=nightCars.map(car=>{const image=new Image();image.src='../../assets/neon-race2/cars/'+car.file;return image;});
    const effects=createRaceEffects(ctx,pose);
    function city() {
        const sky = ctx.createLinearGradient(0,0,0,400);
        sky.addColorStop(0,'#090911');sky.addColorStop(1,'#30131f');
        ctx.fillStyle=sky;ctx.fillRect(0,0,1200,900);
        for (let i=0;i<36;i++) {
            ctx.fillStyle=`rgba(240,236,255,${.12 + (i%4)*.08})`;
            ctx.beginPath();ctx.arc((i*193+41)%1200,35+(i*47)%210,i%3===0?1.5:1,0,Math.PI*2);ctx.fill();
        }
        const glow=ctx.createRadialGradient(950,210,4,950,210,220);
        glow.addColorStop(0,'#ff33442b');glow.addColorStop(1,'#ff334400');
        ctx.fillStyle=glow;ctx.fillRect(700,0,500,440);
        ctx.strokeStyle='#ff65734d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(974,171,47,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='#ff65731a';ctx.beginPath();ctx.arc(974,171,60,0,Math.PI*2);ctx.stroke();
        for (let i=0;i<20;i++) {
            const x=i*90-(clock*15)%90-90, h=50+(i*43)%145;
            ctx.fillStyle=i%2?'#15121d':'#1b1520';ctx.fillRect(x,365-h,80,h);
            for (let col=0;col<4;col++) for(let row=0;row<Math.floor(h/23)-1;row++) {
                ctx.fillStyle=(row+col+i)%3?'#f1eaff10':'#ff4d5d42';
                ctx.fillRect(x+10+col*16,380-h+row*23,6,9);
            }
        }
        ctx.fillStyle='#09090d';ctx.fillRect(0,360,1200,32);
        ctx.fillStyle='#ff334470';ctx.fillRect(0,389,1200,2);
    }
    function fallback(x,foot,width,color) {
        ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,foot-65,width,45,16);ctx.fill();
        ctx.fillStyle='#282832';ctx.beginPath();ctx.roundRect(x+width*.25,foot-95,width*.45,50,15);ctx.fill();
        ctx.fillStyle='#09090e';for(const wheel of [.2,.8]){ctx.beginPath();ctx.arc(x+width*wheel,foot-15,23,0,Math.PI*2);ctx.fill();}
    }
    function vehicle(image,index,x,foot,width,speed) {
        const color=index?'#b8d4ff':'#ff3344';
        ctx.save();ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(x+width*.5,foot-1,width*.4,3,0,0,Math.PI*2);ctx.fill();
        if (!image?.complete || !image.naturalWidth) {fallback(x,foot,width,color);ctx.restore();return;}
        const height=width*image.naturalHeight/image.naturalWidth;
        const y=foot-height;
        ctx.drawImage(image,x,y,width,height);
        for(const wheel of nightCars[index].wheels) {
            const sx=wheel.x*image.naturalWidth,sy=wheel.y*image.naturalHeight;
            const sourceRadius=wheel.radius*image.naturalWidth*.94;
            const radius=wheel.radius*width*.94;
            ctx.save();ctx.translate(x+wheel.x*width,y+wheel.y*height);
            ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.clip();ctx.rotate(wheelAngles[index]);
            ctx.drawImage(image,sx-sourceRadius,sy-sourceRadius,sourceRadius*2,sourceRadius*2,-radius,-radius,radius*2,radius*2);ctx.restore();
        }
        const beam=ctx.createLinearGradient(x+width*.9,0,x+width*1.5,0);
        beam.addColorStop(0,index?'#b8d4ff20':'#ffccd520');beam.addColorStop(1,'#f1eeff00');
        ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(x+width*.95,foot-height*.4);ctx.lineTo(x+width*1.5,foot-height*.6);ctx.lineTo(x+width*1.5,foot-4);ctx.closePath();ctx.fill();
        ctx.restore();
    }
    function audience() {
        for(let i=0;i<5;i++) {
            const p=(clock*.21+i*.21)%1,x=1050-p*400,y=340-p*150;
            ctx.save();ctx.globalAlpha=Math.sin(p*Math.PI)*.5;ctx.translate(x,y);ctx.scale(1.2,1.2);
            ctx.fillStyle=i%2?'#f6f1f8':'#ff4455';ctx.beginPath();ctx.moveTo(0,5);ctx.bezierCurveTo(-20,-7,-8,-18,0,-9);ctx.bezierCurveTo(8,-18,20,-7,0,5);ctx.fill();ctx.restore();
        }
    }

    function pose(state,index) {
        const width=460,height=width*nightCars[index].size[1]/nightCars[index].size[0];
        const foot=TRACK_LAYOUT.lanes[index].foot;
        return {x:state.visualCarLeft(index)/100*1200,y:foot-height,foot,width,height};
    }

    return {
        images:[...images,...effects.images],
        pose,
        draw(state, time, {effectsTime=time,reduced=false}={}) {
            const dt=Math.max(0,Math.min(.25,time-lastTime));lastTime=time;
            if(!state.paused&&!state.finished){
                const fastest=Math.max(state.speed(0),state.speed(1));
                const rush=Math.min(3.3,1+Math.max(0,fastest-50)/85);
                clock+=dt*(.9+rush*.6);
                state.teams.forEach((_,i)=>wheelAngles[i]=(wheelAngles[i]+dt*(4+state.speed(i)*.08))%(Math.PI*2));
            }
            ctx.setTransform(canvas.width/1200,0,0,canvas.height/900,0,0);
            city();drawInteractRoad(ctx,clock);audience();
            effects.behind(state,effectsTime,reduced);
            state.teams.forEach((team,index)=>{
                const {x,foot,width,height}=pose(state,index);
                const color=index?'#8cbaff':'#ff485e';
                ctx.save();
                ctx.fillStyle=index?'#6b9fff30':'#ff334430';ctx.shadowColor=color;ctx.shadowBlur=15;
                ctx.beginPath();ctx.ellipse(x+width*.5,foot-3,width*.34,5,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
                ctx.restore();
                vehicle(images[index],index,x,foot,width,state.speed(index));
            });
            effects.foreground(state,effectsTime,reduced);
            if(Math.max(...state.teams.map(team=>team.distance))>3500||state.finished){
                const x=1128;
                const tileHeight=(TRACK_LAYOUT.bottom-TRACK_LAYOUT.top)/24;
                ctx.globalAlpha=.65;for(let row=0;row<24;row++)for(let col=0;col<2;col++){ctx.fillStyle=(row+col)%2?'#f0e7f4':'#14111a';ctx.fillRect(x+col*12,TRACK_LAYOUT.top+row*tileHeight,12,tileHeight);}ctx.globalAlpha=1;
            }
        }
    };
}
