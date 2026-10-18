import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceAudio} from '../assets/neon-race2-audio.js';
import {NeonRace2} from '../assets/neon-race2-engine.js';

function monitor(race){
    const audio=new RaceAudio({currentTime:0}),events=[];
    audio.enabled=true;audio.initialized=true;audio.lastEngineUpdate=0;
    audio.stopEffects=()=>{};audio.silenceEngines=()=>{};
    audio.playEffect=kind=>{events.push(kind);return true;};
    audio.sync(race);events.length=0;
    return {audio,events};
}

function pendingAudio(){
    const requests=[],events=[];
    const context={currentTime:0,state:'suspended',
        resume(){return new Promise(resolve=>requests.push(()=>{this.state='running';resolve();}));},
        async suspend(){this.state='suspended';}
    };
    const audio=new RaceAudio(context);
    audio.initialized=true;audio.lastEngineUpdate=0;
    audio.stopEffects=()=>{};audio.silenceEngines=()=>{};
    audio.playEffect=kind=>{events.push(kind);return true;};
    return {audio,context,requests,events};
}

test('a pending autoplay request keeps mute usable and cannot turn sound back on later',async()=>{
    const race=new NeonRace2(),{audio,context,requests,events}=pendingAudio();
    const startup=audio.setEnabled(true,race);
    assert.equal(audio.enabled,true);
    race.contribute(0,'gift',500);audio.sync(race);
    assert.deepEqual(events,[],'blocked autoplay must not queue effects');
    await audio.setEnabled(false,race);
    requests[0]();await startup;
    assert.equal(audio.enabled,false);
    assert.equal(context.state,'suspended');
    race.paused=true;audio.sync(race);race.paused=false;race.reset();audio.sync(race);
    assert.deepEqual(events,[]);
});

test('a trusted-interaction retry unlocks pending audio once without replaying blocked race events',async()=>{
    const race=new NeonRace2(),{audio,requests,events}=pendingAudio();
    const startup=audio.setEnabled(true,race);
    race.contribute(0,'gift',500);audio.sync(race);
    const interaction=audio.resume(race);
    requests[1]();await interaction;
    requests[0]();await startup;
    assert.equal(audio.enabled,true);
    assert.deepEqual(events,['start']);
});

test('an autoplay permission rejection keeps audio ready for the next interaction',async()=>{
    const race=new NeonRace2(),{audio,context,requests,events}=pendingAudio();
    const resume=context.resume;
    context.resume=()=>Promise.reject(Object.assign(new Error('Gesture required'),{name:'NotAllowedError'}));
    assert.equal(await audio.setEnabled(true,race),false);
    assert.equal(audio.enabled,true);
    context.resume=resume;
    const retry=audio.resume(race);requests[0]();await retry;
    assert.deepEqual(events,['start']);
});

test('race audio follows the 100/150 speed tiers and does not replay sustained boosts each frame',()=>{
    const race=new NeonRace2(),{audio,events}=monitor(race);
    race.contribute(0,'like',250);audio.sync(race);
    assert(events.includes('boost'));assert(!events.includes('nitro'));
    events.length=0;
    race.contribute(0,'gift',50);audio.sync(race);
    assert(events.includes('nitro'));
    events.length=0;
    for(let i=0;i<30;i++)audio.sync(race);
    assert.equal(events.length,0);
    race.paused=true;audio.sync(race);
    race.paused=false;audio.sync(race);
    assert.deepEqual(events,['resume']);
});

test('one engine follows either faster car without doubling when both cars accelerate',()=>{
    const race=new NeonRace2(),{audio}=monitor(race);
    const parameter=()=>({value:0,setTargetAtTime(value){this.value=value;}});
    const engine={motor:{frequency:parameter()},sub:{frequency:parameter()},filter:{frequency:parameter()},output:{gain:parameter()},airFilter:{frequency:parameter()},airGain:{gain:parameter()}};
    audio.engines=[engine];
    let speeds=[50,50];race.speed=i=>speeds[i];
    const update=()=>{audio.context.currentTime+=.1;audio.sync(race);return {pitch:engine.motor.frequency.value,volume:engine.output.gain.value,air:engine.airGain.gain.value};};
    const idle=update();
    speeds=[150,50];const red=update();
    speeds=[50,150];const blue=update();
    speeds=[150,150];const both=update();
    assert(red.pitch>idle.pitch);
    assert.deepEqual(blue,red);
    assert.deepEqual(both,red);
});

test('motorcycle engine profile has a higher rev range and sharper harmonics than the car profile',()=>{
    const parameter=()=>({value:0,setTargetAtTime(value){this.value=value;}});
    const createEngine=()=>({motor:{frequency:parameter()},sub:{frequency:parameter()},filter:{frequency:parameter()},output:{gain:parameter()},airFilter:{frequency:parameter()},airGain:{gain:parameter()}});
    const race=new NeonRace2();
    let speed=50;race.speed=()=>speed;
    const car=new RaceAudio({currentTime:0}),motorcycle=new RaceAudio({currentTime:0},{engineProfile:'motorcycle'});
    for(const audio of [car,motorcycle]){
        audio.enabled=true;audio.initialized=true;audio.lastEngineUpdate=-Infinity;
        audio.stopEffects=()=>{};audio.silenceEngines=()=>{};audio.playEffect=()=>true;
        audio.engines=[createEngine()];
    }
    car.sync(race);motorcycle.sync(race);
    assert(motorcycle.engines[0].motor.frequency.value>car.engines[0].motor.frequency.value);
    assert(motorcycle.engines[0].filter.frequency.value>car.engines[0].filter.frequency.value);
    const motorcycleIdle=motorcycle.engines[0].motor.frequency.value;
    speed=150;race.speed=()=>speed;
    for(const audio of [car,motorcycle]){audio.context.currentTime+=.1;audio.sync(race);}
    assert(motorcycle.engines[0].motor.frequency.value>motorcycleIdle);
    assert(motorcycle.engines[0].motor.frequency.value-car.engines[0].motor.frequency.value>
        motorcycleIdle-car.engines[0].motor.frequency.value);
});

test('race audio distinguishes actual speed hits, nitro shields and comeback activation',()=>{
    const race=new NeonRace2(),{audio,events}=monitor(race);
    race.contribute(0,'gift',25);audio.sync(race);
    assert(events.includes('attack'));
    race.contribute(0,'gift',100);audio.sync(race);events.length=0;
    race.contribute(1,'gift',25);audio.sync(race);
    assert(events.includes('shield'));assert(!events.includes('attack'));
    race.teams[1].distance=100;
    race.contribute(0,'gift',500);audio.sync(race);
    assert(events.includes('comeback'));
    events.length=0;audio.sync(race);assert.equal(events.length,0);
});

test('race audio plays one victory, individual countdown ticks and a new-round cue; muted events are not replayed',()=>{
    const race=new NeonRace2(),{audio,events}=monitor(race);
    race.finish(0);audio.sync(race);audio.sync(race);
    assert.equal(events.filter(kind=>kind==='victory').length,1);
    race.nextIn=3;audio.sync(race);audio.sync(race);
    race.nextIn=2;audio.sync(race);
    assert.equal(events.filter(kind=>kind==='countdown').length,2);
    race.reset();audio.sync(race);assert.equal(events.at(-1),'start');
    audio.enabled=false;events.length=0;
    race.contribute(0,'gift',500);audio.sync(race);assert.equal(events.length,0);
    audio.enabled=true;audio.sync(race);assert.equal(events.length,0);
});
