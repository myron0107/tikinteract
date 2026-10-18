// Neon Race 1 rules, independent of rendering and LIVE transport.
export const RACE_RULES = Object.freeze({duration:120, finish:4000, base:50, likeMax:100, giftMax:150, nitroMax:200, likesPerSpeed:5, likeDecay:12, likeWindow:3, keepLikes:10, giftDecay:6, giftGrace:3, nitroThreshold:100, nitroSecondsPerPoint:.03, nitroFade:1.5, attackPoints:25, attackCooldown:5, countdown:15});
const R = RACE_RULES;
const amount = (value, max = 1000000) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(0, Math.floor(Number(value)))) : 0;
const identity = value => String(value || '').trim().replace(/^@/, '').toLowerCase().slice(0,80);
export class NeonRace2 {
    constructor() {
        this.members = new Map(); this.supporters = new Map();
        this.wins = [0,0]; this.round = 0; this.reset();
    }
    reset() {
        this.round++; this.members.clear();
        this.time=R.duration; this.elapsed=0; this.finished=false; this.paused=false;
        this.winner=null; this.resultReason=null; this.nextIn=R.countdown;
        this.lastAttack=[-Infinity,-Infinity];
        this.teams=[0,1].map(()=>({distance:0,score:0,likePower:0,likeTaps:0,likeEvents:[],recentLikes:0,lastQualifiedAt:0,giftSpeed:R.base,lastGiftAt:0,nitroSeconds:0,nitroUnlocked:false,totalGiftPoints:0,pendingGiftPoints:0,attackPoints:0,hitFlashUntil:0,shieldUntil:0,likes:0,coins:0}));
    }
    join(username,message,displayName=username) {
        const key=identity(username),command=String(message||'').trim().toUpperCase();
        const requested=['RED','!RED','ROSU','ROȘU','1'].includes(command)?0:['BLUE','!BLUE','ALBASTRU','2'].includes(command)?1:-1;
        if(!key||requested<0||this.finished)return false;
        const index=this.members.get(key)??requested;
        this.members.set(key,index); // First choice stays locked until the next round.
        return {key,index,name:String(displayName||username).slice(0,40)};
    }
    record(index,type,value,key,name,gifts=1) {
        if(!key)return;
        const id=`${index}:${key}`;
        let person=this.supporters.get(id);
        if(!person){person={key,name:String(name||key).slice(0,80),team:index,likes:0,gifts:0,coins:0,order:this.supporters.size};this.supporters.set(id,person);}
        person.name=String(name||person.name).slice(0,80);
        if(type==='like')person.likes+=value;
        else {person.coins+=value;person.gifts+=gifts;}
    }
    event(event) {
        if(event.type==='chat')return this.join(event.username,event.message,event.displayName);
        if(!['like','gift'].includes(event.type))return false;
        const key=identity(event.username),index=this.members.get(key);
        if(index===undefined)return false;
        const gifts=Math.max(1,amount(event.repeatCount,1000));
        const giftPoints=event.diamondCount===undefined?event.coins:Math.max(1,amount(event.diamondCount))*gifts;
        const value=event.type==='like'?amount(event.likeCount):Math.max(1,amount(giftPoints,Number.MAX_SAFE_INTEGER));
        if(!value)return false;
        // Rankings count received events while paused/between rounds, as in Race 1.
        this.record(index,event.type,value,key,event.displayName||event.username,gifts);
        return this.contribute(index,event.type,value);
    }
    contribute(index,type,value,key,name,gifts=1) {
        if(![0,1].includes(index)||!['like','gift'].includes(type)||this.finished||this.paused)return false;
        value=amount(value,type==='like'?5000:40000);
        if(!value)return false;
        const team=this.teams[index]; team.score+=value;
        if(type==='like') {
            team.likes+=value; team.likeEvents.push({at:this.elapsed,count:value}); team.likeTaps+=value;
            const steps=Math.floor(team.likeTaps/R.likesPerSpeed);
            team.likePower=Math.min(R.likeMax-R.base,team.likePower+steps);
            team.likeTaps-=steps*R.likesPerSpeed;
        } else {
            team.coins+=value;
            team.giftSpeed=Math.max(team.giftSpeed,Math.min(R.giftMax,Math.max(team.giftSpeed,R.base+team.likePower)+value));
            team.lastGiftAt=this.elapsed; team.totalGiftPoints+=value;
            if(this.elapsed-this.lastAttack[index]>=R.attackCooldown){team.attackPoints+=value;this.attack(index);}
            if(team.nitroUnlocked)team.nitroSeconds=Math.min(this.time,team.nitroSeconds+value*R.nitroSecondsPerPoint);
            else {
                team.pendingGiftPoints+=value;
                if(team.pendingGiftPoints>=R.nitroThreshold){team.nitroUnlocked=true;team.nitroSeconds=Math.min(this.time,team.nitroSeconds+team.pendingGiftPoints*R.nitroSecondsPerPoint);team.pendingGiftPoints=0;}
            }
        }
        this.record(index,type,value,key,name,gifts);
        return {index,type,value};
    }
    speed(index) {
        const team=this.teams[index];
        const cruise=Math.min(R.giftMax,Math.max(R.base+team.likePower,team.giftSpeed));
        const power=team.nitroSeconds>0?Math.min(1,team.nitroSeconds/R.nitroFade):0;
        return cruise+(R.nitroMax-cruise)*power;
    }
    attack(index) {
        const attacker=this.teams[index],victim=this.teams[1-index];
        if(this.elapsed-this.lastAttack[index]<R.attackCooldown||attacker.attackPoints<R.attackPoints)return;
        attacker.attackPoints=0; this.lastAttack[index]=this.elapsed;
        if(victim.nitroSeconds>0){victim.shieldUntil=this.elapsed+.55;return;}
        const before=this.speed(1-index),target=Math.max(R.base,before*.75);
        const factor=before>R.base?(target-R.base)/(before-R.base):0;
        victim.likePower=Math.max(0,victim.likePower*factor);
        victim.giftSpeed=R.base+(victim.giftSpeed-R.base)*factor;
        victim.hitFlashUntil=this.elapsed+.55;
    }
    comeback(index) {
        const team=this.teams[index],other=this.teams[1-index];
        if(this.finished||team.nitroSeconds<=0||team.distance>=other.distance)return 0;
        const advantage=team.score-other.score;
        return advantage>=1000?30:advantage>=500?20:advantage>=100?10:0;
    }
    visualCarLeft(index) {
        const positions=this.teams.map(team=>Math.min(1,team.distance/R.finish));
        const middle=8+(positions[0]+positions[1])/2*46;
        const gap=Math.min(44,Math.abs(positions[0]-positions[1])*260);
        return Math.max(4,Math.min(56,middle+Math.sign(positions[index]-positions[1-index])*gap/2));
    }
    finish(winner) {
        if(this.finished)return;
        const reached=winner!==undefined;
        this.resultReason=reached?'finish':'time';
        if(winner===-1&&this.teams[0].score!==this.teams[1].score){winner=this.teams[0].score>this.teams[1].score?0:1;this.resultReason='finish-points';}
        const maxPoints=Math.max(1,...this.teams.map(team=>team.score));
        this.weightedScores=this.teams.map(team=>70*Math.min(1,team.distance/R.finish)+30*team.score/maxPoints);
        if(!reached){const difference=this.weightedScores[0]-this.weightedScores[1];winner=Math.abs(difference)<.000001?(this.teams[0].score===this.teams[1].score?-1:this.teams[0].score>this.teams[1].score?0:1):difference>0?0:1;}
        this.finished=true; this.winner=winner<0?null:winner;
        if(this.winner!==null)this.wins[this.winner]++;
    }
    step(dt,autoNext=true) {
        if(!Number.isFinite(dt)||dt<=0||this.paused)return;
        dt=Math.min(dt,.25);
        if(this.finished){this.nextIn=Math.max(0,this.nextIn-dt);if(autoNext&&this.nextIn===0)this.reset();return;}
        const step=Math.min(dt,this.time);
        this.time=Math.max(0,this.time-step); this.elapsed+=step;
        const before=this.teams.map(team=>team.distance);
        const gains=this.teams.map((team,i)=>{const regular=this.speed(i)/3.6*step;return regular+Math.min(regular*this.comeback(i)/100,Math.max(0,before[1-i]-before[i]));});
        const fractions=this.teams.map((team,i)=>gains[i]>0?(R.finish-before[i])/gains[i]:Infinity);
        this.teams.forEach((team,i)=>{
            team.distance=Math.min(R.finish,team.distance+gains[i]);
            team.likeEvents=team.likeEvents.filter(event=>this.elapsed-event.at<R.likeWindow);
            team.recentLikes=team.likeEvents.reduce((sum,event)=>sum+event.count,0);
            if(team.recentLikes>=R.keepLikes)team.lastQualifiedAt=this.elapsed;
            if(this.elapsed-team.lastQualifiedAt>R.likeWindow)team.likePower=Math.max(0,team.likePower-R.likeDecay*step);
            if(this.elapsed-team.lastGiftAt>R.giftGrace)team.giftSpeed=Math.max(R.base,team.giftSpeed-R.giftDecay*step);
            team.nitroSeconds=Math.max(0,team.nitroSeconds-step);
        });
        if(this.teams.some(team=>team.distance>=R.finish))this.finish(Math.abs(fractions[0]-fractions[1])<1e-9?-1:fractions[0]<fractions[1]?0:1);
        else if(this.time<=0)this.finish();
    }
    top(index){return [...this.supporters.values()].filter(person=>person.team===index).sort((a,b)=>(b.likes+b.coins)-(a.likes+a.coins)||a.order-b.order).slice(0,5);}
    clearSupporters(){this.supporters.clear();}
}
