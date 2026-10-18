import test from 'node:test';
import assert from 'node:assert/strict';
import {NeonRace2} from '../assets/neon-race2-engine.js';

test('Neon Race 2: viewers must join before contributing; batched likes and gift repeats affect their team',()=>{
    const race=new NeonRace2();
    assert.equal(race.event({type:'like',username:'alice',likeCount:50}),false);
    race.event({type:'chat',username:'@Alice',message:'red',displayName:'Alice'});
    race.event({type:'like',username:'alice',likeCount:25});
    assert.equal(race.speed(0),55);
    race.event({type:'gift',username:'Alice',diamondCount:10,repeatCount:3});
    assert.equal(race.teams[0].nitroSeconds,0);
    assert.equal(race.speed(0),85);
    assert.equal(race.teams[1].distance,0);
    assert.equal(race.top(0)[0].coins,30);
    assert.equal(race.top(0)[0].gifts,3);
    race.event({type:'gift',username:'Alice',coins:70});
    assert.equal(race.teams[0].nitroSeconds,3);
    assert.equal(race.speed(0),200);
    assert.equal(race.event({type:'like',username:'alice',likeCount:NaN}),false);
});
test('Neon Race 2: finish uses crossing time, awards one win and carries supporter totals to the next round',()=>{
    const race=new NeonRace2();
    race.contribute(1,'gift',100,'alice','Alice');
    race.teams[1].distance=3999;
    while(!race.finished)race.step(.25);
    assert.equal(race.winner,1);
    assert.deepEqual(race.wins,[0,1]);
    assert.equal(race.teams[1].distance,4000);
    assert.equal(race.contribute(0,'gift',1000),false);
    for(let i=0;i<20;i++)race.step(.25,false);
    assert.deepEqual(race.wins,[0,1]);
    race.reset();
    assert.equal(race.top(1)[0].coins,100);
    assert.equal(race.teams[1].distance,0);
    assert.equal(race.time,120);
});
test('Neon Race 2: pauses freeze the race; equal teams draw; auto next starts only after the result countdown',()=>{
    const race=new NeonRace2();
    race.paused=true;race.step(.25);
    assert.equal(race.time,120);
    assert.equal(race.contribute(0,'like',25),false);
    race.paused=false;
    while(!race.finished)race.step(.25);
    assert.equal(race.winner,null);
    assert.deepEqual(race.wins,[0,0]);
    for(let i=0;i<59;i++)race.step(.25);
    assert.equal(race.round,1);
    race.step(.25);
    assert.equal(race.round,2);
});
test('Neon Race 2: membership is locked per round; players rejoin each round and rankings persist',()=>{
    const race=new NeonRace2();
    race.join('alice','RED');race.event({type:'like',username:'alice',likeCount:20});
    race.join('alice','BLUE');race.event({type:'gift',username:'alice',coins:5});
    assert.equal(race.top(0)[0].likes,20);
    assert.equal(race.top(0)[0].coins,5);
    assert.equal(race.top(1).length,0);
    race.reset();
    assert.equal(race.members.size,0);
    assert.equal(race.event({type:'like',username:'alice',likeCount:25}),false);
    race.join('alice','BLUE');race.event({type:'gift',username:'alice',coins:5});
    assert.equal(race.top(1)[0].coins,5);
    race.clearSupporters();
    assert.equal(race.top(0).length,0);
    assert.equal(race.top(1).length,0);
});

test('Neon Race 2: speed tiers, physical distance, grace periods, nitro activation and fade match Race 1',()=>{
    const race=new NeonRace2();
    assert.equal(race.visualCarLeft(0),8);assert.equal(race.visualCarLeft(1),8);
    race.step(.25);assert.equal(race.teams[0].distance,50/3.6*.25);
    race.contribute(0,'like',4);assert.equal(race.speed(0),50);
    race.contribute(0,'like',1);assert.equal(race.speed(0),51);
    race.contribute(0,'like',5000);assert.equal(race.speed(0),100);
    race.contribute(0,'gift',49);assert.equal(race.speed(0),149);
    race.contribute(0,'gift',50);assert.equal(race.speed(0),150);assert.equal(race.teams[0].nitroSeconds,0);
    race.contribute(0,'gift',1);assert.equal(race.speed(0),200);assert.equal(race.teams[0].nitroSeconds,3);
    for(let i=0;i<8;i++)race.step(.25);
    assert(race.speed(0)>150&&race.speed(0)<200);
    for(let i=0;i<20;i++)race.step(.25);
    assert(race.speed(0)<150);
    race.contribute(0,'gift',1);assert.equal(race.teams[0].nitroSeconds,.03);
});

test('Neon Race 2: new gifts trigger one speed hit after cooldown; active nitro shields it',()=>{
    const race=new NeonRace2();
    race.contribute(1,'like',250);assert.equal(race.speed(1),100);
    race.contribute(0,'gift',25);assert.equal(race.speed(1),75);
    race.contribute(0,'gift',25);assert.equal(race.speed(1),75);
    for(let i=0;i<20;i++)race.step(.25);
    race.contribute(1,'gift',100);
    const before=race.speed(1);
    race.contribute(0,'gift',25);
    assert.equal(race.speed(1),before);
    assert(race.teams[1].shieldUntil>race.elapsed);
});

test('Neon Race 2: timeout uses 70% distance / 30% points, not distance alone',()=>{
    const race=new NeonRace2();
    race.teams[0].distance=2000;race.teams[1].distance=1900;race.teams[1].score=100;
    race.time=.01;race.step(.01);
    assert.equal(race.winner,1);assert.equal(race.resultReason,'time');
});

test('Neon Race 2: Top 5 preserves full received totals separately from capped race inputs, including during pause',()=>{
    const race=new NeonRace2();race.join('alice','RED');
    race.event({type:'like',username:'alice',likeCount:20000});
    assert.equal(race.teams[0].score,5000);assert.equal(race.top(0)[0].likes,20000);
    race.event({type:'gift',username:'alice',diamondCount:10000,repeatCount:5});
    assert.equal(race.teams[0].coins,40000);assert.equal(race.top(0)[0].coins,50000);assert.equal(race.top(0)[0].gifts,5);
    race.paused=true;
    race.event({type:'gift',username:'alice',diamondCount:10,repeatCount:3});
    assert.equal(race.teams[0].coins,40000);assert.equal(race.top(0)[0].gifts,8);
});
