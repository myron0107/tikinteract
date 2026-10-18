// Generated sprites provide the artwork; this layer only animates/composites it.
export const EFFECT_NAMES=Object.freeze(['nitro','boost','impact','shield']);
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const noise=value=>{const n=Math.sin(value*127.1+31.7)*43758.5453;return n-Math.floor(n);};

export function createRaceEffects(ctx,pose,{contributionStyle={}}={}) {
    const hintStyle={duration:.55,opacity:.65,scale:1.2,outline:false,...contributionStyle};
    const sprites=Object.fromEntries(EFFECT_NAMES.map(name=>{const image=new Image();image.src=`../../assets/neon-race2/effects/${name}.webp`;return[name,image];}));
    let contributionRound=null,contributionTotals=[],contributions=[];
    function contributionHints(state,time,reduced) {
        if(contributionRound!==state.round){
            contributionRound=state.round;
            contributionTotals=state.teams.map(team=>({likes:team.likes,coins:team.coins}));
            contributions=state.teams.map(()=>({likes:null,coins:null}));
        }
        state.teams.forEach((team,index)=>{
            const car=pose(state,index);
            for(const kind of ['likes','coins']){
                const delta=team[kind]-contributionTotals[index][kind];
                contributionTotals[index][kind]=team[kind];
                // Coalesce a busy LIVE into at most two tiny hints per car.
                if(delta>0&&!state.paused)contributions[index][kind]={at:time};
                const hint=contributions[index][kind];
                if(!hint)continue;
                const age=time-hint.at;
                if(age<0||age>=hintStyle.duration){contributions[index][kind]=null;continue;}
                const progress=age/hintStyle.duration,gift=kind==='coins';
                const x=car.x+car.width*.14+(gift?26:0)-(reduced?0:progress*6);
                const y=car.y-16-(reduced?0:progress*20);
                ctx.save();ctx.globalAlpha=hintStyle.opacity*(1-progress*progress);
                ctx.fillStyle=gift?'#f2cc8f':index?'#a9cdff':'#ff8b9a';
                ctx.translate(x,y);ctx.scale(hintStyle.scale,hintStyle.scale);
                if(hintStyle.outline){ctx.shadowColor='#253d6099';ctx.shadowBlur=3;}
                if(gift){
                    ctx.lineWidth=1.5;ctx.strokeStyle=ctx.fillStyle;
                    ctx.strokeRect(-6,-2,12,9);ctx.strokeRect(-7,-5,14,3);
                    ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(0,7);ctx.moveTo(0,-5);ctx.bezierCurveTo(-10,-5,-4,-13,0,-5);ctx.bezierCurveTo(4,-13,10,-5,0,-5);ctx.stroke();
                }else{
                    ctx.beginPath();ctx.moveTo(0,6);ctx.bezierCurveTo(-15,-3,-6,-12,0,-5);ctx.bezierCurveTo(6,-12,15,-3,0,6);
                    if(hintStyle.outline){ctx.strokeStyle='#fff5';ctx.lineWidth=1.2;ctx.stroke();}
                    ctx.fill();
                }
                ctx.restore();
            }
        });
    }
    function sprite(name,x,y,width,height,alpha=1) {
        const image=sprites[name];
        if(!image.complete||!image.naturalWidth||alpha<=0)return;
        ctx.save();ctx.globalAlpha=clamp(alpha);ctx.drawImage(image,x,y,width,height);ctx.restore();
    }
    function jet(name,car,time,power) {
        const nitro=name==='nitro',scale=car.exhaust?.scale??1;
        const length=(nitro?185:120)*(1+Math.sin(time*29)*.08)*(.65+.35*power)*scale;
        const height=(nitro?24+power*9:19+power*5)*scale,y=car.foot-car.height*.19;
        if(car.exhaust){
            ctx.save();ctx.translate(car.exhaust.x,car.exhaust.y);ctx.rotate(car.exhaust.angle);
            sprite(name,-length+2,-height*.5,length,height,nitro?.95:.8);
            ctx.restore();
        }else sprite(name,car.x-length+8,y-height*.5,length,height,nitro?.95:.8);
        // Light falls onto the asphalt rather than a large glow over the car.
        ctx.save();ctx.globalAlpha=.14*(.35+.65*power);ctx.fillStyle=nitro?'#7fdfff':'#ffb86d';
        ctx.beginPath();ctx.ellipse((car.exhaust?.x??car.x)-length*.32,car.foot-2,length*.55,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    function streaks(car,time,color,intensity) {
        ctx.save();
        for(let i=0;i<12;i++){
            const phase=(time*(1.4+noise(i)*.7)+noise(i+10))%1;
            const x=car.x-phase*(170+intensity*90),y=car.foot-15-noise(i+20)*car.height*.75;
            ctx.globalAlpha=(1-phase)*.32*intensity;ctx.fillStyle=color;
            ctx.fillRect(x,y,9+noise(i+30)*24,1+noise(i+40));
        }
        ctx.restore();
    }
    function bolt(from,to,time,alpha) {
        ctx.save();ctx.globalAlpha=alpha*.6;ctx.strokeStyle='#c8b5ff';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(from.x,from.y);
        for(let i=1;i<9;i++){const p=i/9,jitter=(noise(i+Math.floor(time*24))-.5)*22;ctx.lineTo(from.x+(to.x-from.x)*p+jitter,from.y+(to.y-from.y)*p+jitter);}
        ctx.lineTo(to.x,to.y);ctx.stroke();ctx.restore();
    }
    return {
        images:Object.values(sprites),
        behind(state,time,reduced=false) {
            if(state.finished)return;
            state.teams.forEach((team,index)=>{
                // Match the speed shown beside the car, including rounding during fade.
                const car=pose(state,index),speed=Math.round(state.speed(index));
                const clock=reduced?0:time;
                if(speed>=150){const power=clamp((speed-150)/50);jet('nitro',car,clock,power);if(!reduced)streaks(car,clock,'#9ceaff',.5+power*.5);}
                else if(speed>=100)jet('boost',car,clock,clamp((speed-100)/50));
                if(state.comeback(index)>0&&!reduced){
                    streaks(car,clock,index?'#8cbaff':'#ff697c',1.35);
                    // A fine double afterimage stays behind the body silhouette.
                    ctx.save();ctx.strokeStyle=index?'#8cbaff55':'#ff697c55';ctx.lineWidth=1;
                    for(let i=0;i<2;i++){ctx.beginPath();ctx.moveTo(car.x-100-i*38,car.foot-5-i*6);ctx.lineTo(car.x+car.width*.7,car.foot-5-i*6);ctx.stroke();}ctx.restore();
                }
            });
            if(!reduced)state.lastAttack.forEach((at,index)=>{
                const age=state.elapsed-at;
                if(age<0||age>.3)return;
                const attacker=pose(state,index),victim=pose(state,1-index);
                bolt({x:attacker.x+attacker.width*.8,y:attacker.y+attacker.height*.5},{x:victim.x+victim.width*.55,y:victim.y+victim.height*.45},time,1-age/.3);
            });
        },
        foreground(state,time,reduced=false) {
            if(state.finished)return;
            state.teams.forEach((team,index)=>{
                const car=pose(state,index),hit=clamp((team.hitFlashUntil-state.elapsed)/.55),shield=clamp((team.shieldUntil-state.elapsed)/.55);
                if(shield>0){
                    const width=car.width*1.13,height=car.height*1.28;
                    sprite('shield',car.x-(width-car.width)*.5,car.y-(height-car.height)*.5,width,height,(.4+shield*.5)*(reduced?1:.95+Math.sin(time*18)*.05));
                }
                if(hit>0){
                    const size=145+(1-hit)*35;
                    sprite('impact',car.x+car.width*.57-size*.5,car.y+car.height*.46-size*.5,size,size,hit*.8);
                    if(!reduced){
                        ctx.save();ctx.globalAlpha=hit*.55;ctx.strokeStyle='#c6acff';ctx.lineWidth=1.3;
                        ctx.beginPath();ctx.ellipse(car.x+car.width*.5,car.foot-2,car.width*(.3+(1-hit)*.16),5+(1-hit)*11,0,0,Math.PI*2);ctx.stroke();ctx.restore();
                    }
                }
            });
            contributionHints(state,time,reduced);
        }
    };
}

// Victory has a separate animation clock, so it can run during the result countdown.
export function createVictoryEffects(canvas) {
    const ctx=canvas.getContext('2d');
    let round=null,started=0;
    return {
        draw(state,time,reduced=false) {
            ctx.clearRect(0,0,canvas.width,canvas.height);
            if(!state.finished){round=null;return;}
            if(round!==state.round){round=state.round;started=time;}
            if(reduced||state.winner===null)return;
            const age=time-started;
            if(age<0||age>6.5)return;
            ctx.save();ctx.scale(canvas.width/540,canvas.height/960);
            const colors=state.winner===0?['#ff697c','#f3d5dc','#ac344f']:['#8cbaff','#d5edff','#427eae'];
            const fade=clamp((6.5-age)/1.5);
            for(let i=0;i<36;i++){
                const delay=noise(i+70)*1.2,t=age-delay;
                if(t<0||t>5)continue;
                const side=i%2?1:-1,origin=side<0?30:510;
                const x=origin+side*(-1)*(26+noise(i)*80)*t+Math.sin(t*2+i)*12;
                const y=240+noise(i+10)*120-(110+noise(i+20)*80)*t+54*t*t;
                ctx.save();ctx.globalAlpha=fade*.7;ctx.translate(x,y);ctx.rotate(t*(noise(i+40)-.5)*7);ctx.fillStyle=colors[i%3];
                ctx.fillRect(-2,-3,2.5+noise(i+50)*2,5+noise(i+60)*5);ctx.restore();
            }
            ctx.restore();
        }
    };
}
