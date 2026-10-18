// Original procedural sound design. No downloads or external audio services.
export const AUDIO_DEFAULTS=Object.freeze({master:70,engine:20,effects:40});
const ENGINE_PROFILES=Object.freeze({
    car:Object.freeze({motorInitial:78,subInitial:40,motorBase:48,motorPerSpeed:.61,subBase:25,subPerSpeed:.28,filterBase:650,filterRange:950,filterQ:.65,subGain:.55}),
    motorcycle:Object.freeze({motorInitial:140.5,subInitial:68,motorBase:88,motorPerSpeed:1.05,subBase:44,subPerSpeed:.48,filterBase:1000,filterRange:1800,filterQ:1.1,subGain:.2})
});
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
function snapshot(state,autoNext=true) {
    return {round:state.round,paused:state.paused,finished:state.finished,next:Math.ceil(state.nextIn),autoNext,
        teams:state.teams.map((team,i)=>({speed:Math.round(state.speed(i)),likes:team.likes,coins:team.coins,attack:state.lastAttack[i],shield:team.shieldUntil,comeback:state.comeback(i)}))};
}
export class RaceAudio {
    constructor(context=null,{engineProfile='car'}={}) {
        this.context=context;this.initialized=false;this.enabled=false;this.activation=0;
        this.engineProfile=Object.hasOwn(ENGINE_PROFILES,engineProfile)?ENGINE_PROFILES[engineProfile]:ENGINE_PROFILES.car;
        this.levels={...AUDIO_DEFAULTS};this.previous=null;this.wasActive=false;
        this.voices=new Set();this.lastCue=new Map();this.lastEngineUpdate=-Infinity;
    }
    init() {
        if(this.initialized)return;
        this.context ||= new (globalThis.AudioContext||globalThis.webkitAudioContext)();
        const ctx=this.context;
        this.master=ctx.createGain();this.engineBus=ctx.createGain();this.effectsBus=ctx.createGain();
        this.master.gain.value=0;this.engineBus.gain.value=0;this.effectsBus.gain.value=0;
        this.limiter=ctx.createDynamicsCompressor();
        this.limiter.threshold.value=-12;this.limiter.knee.value=6;this.limiter.ratio.value=16;
        this.limiter.attack.value=.003;this.limiter.release.value=.18;
        this.engineBus.connect(this.master);this.effectsBus.connect(this.master);
        this.master.connect(this.limiter);this.limiter.connect(ctx.destination);
        this.noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
        const samples=this.noise.getChannelData(0);let seed=731;
        for(let i=0;i<samples.length;i++){seed=(seed*1664525+1013904223)>>>0;samples[i]=seed/2147483648-1;}
        // A single shared engine follows the faster car, avoiding two beating tones.
        this.engines=[0].map(()=>{
            const output=ctx.createGain(),filter=ctx.createBiquadFilter();
            output.gain.value=0;filter.type='lowpass';filter.frequency.value=this.engineProfile.filterBase;filter.Q.value=this.engineProfile.filterQ;
            const motor=ctx.createOscillator(),sub=ctx.createOscillator(),subGain=ctx.createGain();
            motor.type='sawtooth';sub.type='triangle';subGain.gain.value=this.engineProfile.subGain;
            motor.connect(filter);sub.connect(subGain);subGain.connect(filter);filter.connect(output);output.connect(this.engineBus);
            motor.frequency.value=this.engineProfile.motorInitial;
            sub.frequency.value=this.engineProfile.subInitial;
            motor.start();sub.start();
            const air=ctx.createBufferSource(),airFilter=ctx.createBiquadFilter(),airGain=ctx.createGain();
            air.buffer=this.noise;air.loop=true;airFilter.type='bandpass';airFilter.frequency.value=1400;airFilter.Q.value=.5;airGain.gain.value=0;
            air.connect(airFilter);airFilter.connect(airGain);airGain.connect(this.effectsBus);air.start();
            return {motor,sub,output,filter,air,airGain,airFilter};
        });
        this.initialized=true;this.applyLevels();
    }
    applyLevels() {
        if(!this.initialized)return;
        const now=this.context.currentTime;
        for(const [node,key]of [[this.master,'master'],[this.engineBus,'engine'],[this.effectsBus,'effects']]){
            const value=this.levels[key]/100;
            node.gain.cancelScheduledValues(now);
            if(value===0)node.gain.setValueAtTime(0,now);else node.gain.setTargetAtTime(value,now,.02);
        }
    }
    setLevels(levels) {
        let changed=false;
        for(const key of ['master','engine','effects'])if(levels[key]!==undefined){const value=clamp(levels[key],0,100);if(this.levels[key]!==value){this.levels[key]=value;changed=true;}}
        if(changed)this.applyLevels();
    }
    async setEnabled(enabled,state) {
        if(enabled){
            this.init();
            if(!this.enabled){this.activation++;this.enabled=true;this.previous=snapshot(state);this.wasActive=false;}
            return this.resume(state);
        }else{
            this.activation++;this.enabled=false;this.stopEffects();this.silenceEngines();this.wasActive=false;
            if(this.initialized&&typeof this.context.startRendering!=='function')await this.context.suspend();
            return false;
        }
    }
    async resume(state) {
        if(!this.enabled||!this.initialized)return false;
        const activation=this.activation,offline=typeof this.context.startRendering==='function';
        try {if(!offline)await this.context.resume();}
        catch(error){
            if(activation!==this.activation||error.name==='NotAllowedError')return false;
            throw error;
        }
        // An autoplay request can stay pending until a click. A later mute must win.
        if(activation!==this.activation||!this.enabled){
            if(!this.enabled&&!offline&&this.context.state==='running')await this.context.suspend();
            return false;
        }
        if(!offline&&this.context.state!=='running')return false;
        if(this.startedActivation!==activation){
            this.startedActivation=activation;this.previous=snapshot(state);this.wasActive=false;
            if(!state.paused&&!state.finished)this.playEffect('start');
        }
        this.sync(state);
        return true;
    }
    voice(source,filter,gain) {
        while(this.voices.size>=24){const oldest=this.voices.values().next().value;try{oldest.source.stop(this.context.currentTime);}catch{}this.voices.delete(oldest);}
        const voice={source,filter,gain};this.voices.add(voice);
        source.onended=()=>{source.disconnect();filter?.disconnect();gain.disconnect();this.voices.delete(voice);};
        return voice;
    }
    tone(frequency,duration,volume,type='sine',delay=0,endFrequency=frequency) {
        const ctx=this.context,at=ctx.currentTime+delay;
        const source=ctx.createOscillator(),gain=ctx.createGain();source.type=type;
        source.frequency.setValueAtTime(frequency,at);source.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),at+duration);
        gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
        source.connect(gain);gain.connect(this.effectsBus);this.voice(source,null,gain);
        source.start(at);source.stop(at+duration+.02);
    }
    sweep(duration,volume,from,to,delay=0) {
        const ctx=this.context,at=ctx.currentTime+delay;
        const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.noise;
        filter.type='bandpass';filter.Q.value=.8;filter.frequency.setValueAtTime(from,at);filter.frequency.exponentialRampToValueAtTime(to,at+duration);
        gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
        source.connect(filter);filter.connect(gain);gain.connect(this.effectsBus);this.voice(source,filter,gain);
        source.start(at);source.stop(at+duration+.02);
    }
    playEffect(kind,team=0) {
        if(!this.enabled||!this.initialized)return false;
        const now=this.context.currentTime,key=kind+':'+team;
        const cooldown=({like:.2,gift:.25,nitro:.7,boost:.7,attack:.3,shield:.3,comeback:3,victory:3,countdown:.5,start:.4,resume:.3})[kind]??.2;
        if(now-(this.lastCue.get(key)??-Infinity)<cooldown)return false;
        this.lastCue.set(key,now);
        if(['nitro','attack','shield','comeback'].includes(kind))this.duckUntil=now+.4;
        if(kind==='nitro'){this.sweep(.65,.3,450,4800);this.tone(75,.45,.16,'triangle',0,310);this.tone(420,.4,.055,'sine',.09,1500);}
        else if(kind==='boost'){this.sweep(.24,.16,250,1500);this.tone(85,.22,.11,'triangle',0,230);}
        else if(kind==='attack'){this.sweep(.24,.34,3100,170);this.tone(150,.27,.2,'triangle',0,38);this.tone(790,.12,.07,'sawtooth',.025,130);}
        else if(kind==='shield'){this.tone(880,.3,.15,'sine',0,1320);this.tone(1760,.34,.09,'sine',.05,880);this.sweep(.17,.1,2200,650);}
        else if(kind==='comeback'){[220,277.18,329.63,440].forEach((note,i)=>this.tone(note,.24,.12,'triangle',i*.09,note*1.5));this.sweep(.45,.17,400,3200);}
        else if(kind==='victory'){[261.63,329.63,392,523.25,659.25,783.99].forEach((note,i)=>this.tone(note,.6,.14,'triangle',i*.11));[261.63,329.63,392].forEach(note=>this.tone(note,1.1,.065,'sine',.6));}
        else if(kind==='gift'){this.tone(880,.16,.085,'sine');this.tone(1320,.24,.055,'sine',.065);}
        else if(kind==='like')this.tone(620,.045,.035,'sine',0,850);
        else if(kind==='start'){[196,293.66,587.33].forEach((note,i)=>this.tone(note,.25,.13,'triangle',i*.15));}
        else if(kind==='resume'){this.tone(330,.13,.09,'sine');this.tone(495,.18,.09,'sine',.08);}
        else if(kind==='countdown')this.tone(660,.11,.11,'sine');
        return true;
    }
    stopEffects() {
        if(!this.initialized)return;
        for(const voice of this.voices){try{voice.source.stop(this.context.currentTime);}catch{}}
        this.voices.clear();
    }
    silenceEngines() {
        if(!this.initialized)return;
        const now=this.context.currentTime;
        this.engines.forEach(engine=>{engine.output.gain.cancelScheduledValues(now);engine.output.gain.setTargetAtTime(0,now,.012);engine.airGain.gain.cancelScheduledValues(now);engine.airGain.gain.setTargetAtTime(0,now,.012);});
        this.lastEngineUpdate=-Infinity;
    }
    sync(state,{hidden=false,autoNext=true}={}) {
        const current=snapshot(state,autoNext),previous=this.previous;
        this.previous=current;
        if(!this.enabled||!this.initialized)return;
        // Do not queue race effects while browser autoplay permission is pending.
        if(this.context.state==='suspended'&&typeof this.context.startRendering!=='function')return;
        const suppressed=hidden||current.paused;
        if(suppressed&&!this.suppressed){this.stopEffects();this.silenceEngines();}
        this.suppressed=suppressed;
        const active=!hidden&&!current.paused&&!current.finished;
        if(active){
            if(previous?.round!==current.round){this.stopEffects();this.playEffect('start');}
            else if(previous?.paused)this.playEffect('resume');
            if(previous&&!previous.finished&&!previous.paused&&!hidden&&previous.round===current.round){
                current.teams.forEach((team,i)=>{
                    const before=previous.teams[i];
                    if(team.speed>=150&&before.speed<150)this.playEffect('nitro',i);
                    else if(team.speed>=100&&team.speed<150&&before.speed<100)this.playEffect('boost',i);
                    if(Number.isFinite(team.attack)&&team.attack!==before.attack)this.playEffect(current.teams[1-i].shield>state.elapsed?'shield':'attack',i);
                    if(team.comeback>before.comeback)this.playEffect('comeback',i);
                    if(team.coins>before.coins)this.playEffect('gift',i);
                    else if(team.likes>before.likes)this.playEffect('like',i);
                });
            }
            if(this.context.currentTime-this.lastEngineUpdate>=.07){
                const now=this.context.currentTime;this.lastEngineUpdate=now;
                const engine=this.engines[0],speed=Math.max(...current.teams.map(team=>team.speed)),power=clamp((speed-50)/150);
                engine.motor.frequency.setTargetAtTime(this.engineProfile.motorBase+speed*this.engineProfile.motorPerSpeed,now,.08);
                engine.sub.frequency.setTargetAtTime(this.engineProfile.subBase+speed*this.engineProfile.subPerSpeed,now,.1);
                engine.filter.frequency.setTargetAtTime(this.engineProfile.filterBase+power*this.engineProfile.filterRange,now,.1);
                const duck=now<(this.duckUntil??0)?.6:1;
                engine.output.gain.setTargetAtTime((.11+power*.035)*duck,now,.035);
                engine.airFilter.frequency.setTargetAtTime(speed>=150?2600:speed>=100?1300:700,now,.1);
                engine.airGain.gain.setTargetAtTime(speed>=150?.065:speed>=100?.026:.006,now,.05);
            }
        }else if(this.wasActive||!previous){this.silenceEngines();this.stopEffects();}
        if(!hidden&&!current.paused&&current.finished){
            if(previous&&!previous.finished)this.playEffect('victory');
            if(current.autoNext&&current.next>0&&current.next<=3&&current.next!==previous?.next)this.playEffect('countdown');
        }
        this.wasActive=active;
    }
    async dispose() {
        this.activation++;this.enabled=false;this.stopEffects();
        if(!this.initialized)return;
        this.engines.forEach(engine=>{engine.motor.stop();engine.sub.stop();engine.air.stop();});
        if(this.context.state!=='closed'&&typeof this.context.close==='function')await this.context.close().catch(()=>{});
    }
}
