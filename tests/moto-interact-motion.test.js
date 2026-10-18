import test from 'node:test';
import assert from 'node:assert/strict';
import {wheelieTarget,approachWheelie,wheeliePoint} from '../assets/moto-interact-motion.js';
import {NeonRace2} from '../assets/neon-race2-engine.js';

test('Moto Interact only lifts on active nitro and lowers as the actual speed fades',()=>{
    const race=new NeonRace2();
    race.contribute(0,'gift',50);
    assert.equal(wheelieTarget(race.speed(0),race.teams[0].nitroSeconds),0);
    race.contribute(0,'gift',50);
    assert.equal(wheelieTarget(race.speed(0),race.teams[0].nitroSeconds),26);
    let previous=26,intermediate=false;
    for(let i=0;i<40;i++){
        race.step(.1,false);
        const angle=wheelieTarget(race.speed(0),race.teams[0].nitroSeconds);
        assert(angle<=previous+1e-8);
        if(angle>0&&angle<26)intermediate=true;
        previous=angle;
    }
    assert(intermediate,'lowering must follow the fade rather than snap from full lift');
    assert.equal(previous,0);
    assert.equal(wheelieTarget(200,0),0);
});

test('Moto Interact wheelie keeps rear tire grounded and raises the front contact',()=>{
    const rear={x:180,y:620},front={x:390,y:620};
    for(const angle of [0,8,15,26]){
        assert.deepEqual(wheeliePoint(rear.x,rear.y,angle,rear.x,rear.y),rear);
        const lifted=wheeliePoint(front.x,front.y,angle,rear.x,rear.y);
        assert(lifted.y<=front.y);
        if(angle>0)assert(lifted.y<front.y-20);
    }
});

test('Moto Interact smooths lifting and lowering and freezes the lift when paused',()=>{
    let angle=0;
    for(let i=0;i<10;i++){const next=approachWheelie(angle,26,.1);assert(next>angle&&next<26);angle=next;}
    assert(angle>25);
    assert.equal(approachWheelie(angle,0,0),angle);
    const descending=approachWheelie(angle,0,.1);
    assert(descending>0&&descending<angle);
    for(let i=0;i<20;i++)angle=approachWheelie(angle,0,.1);
    assert(angle<.1);
});
