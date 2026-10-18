import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {NeonRace2} from '../assets/neon-race2-engine.js';

const source=readFileSync(new URL('../GAME/NEON-RACE/Neon-Race.html',import.meta.url),'utf8');
function extract(name){const start=source.indexOf(`function ${name}(`);assert(start>=0,name);const end=source.indexOf('\nfunction ',start+10);return source.slice(start,end);}
function original(race){
    const nodes=new Map();
    const node=()=>({textContent:'',className:'',children:[],classList:{add(){},remove(){},toggle(){}},append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},replaceChildren(){this.children=[];}});
    const context={teams:structuredClone(race.teams).map(team=>({...team,giftEvents:[]})),gameClock:0,remaining:120,active:true,paused:false,auto:false,last:1000,autoClock:0,autoRestartAt:0,round:1,attack:{lastAt:[-Infinity,-Infinity]},names:['RED','BLUE'],lastLikeSound:0,lastGiftSound:0,
        $:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},document:{createElement:node,querySelector:node},performance:{now:()=>1000},pulse(){},soundEffect(){},log(){},render(){},animateCarWheels(){},raceAudioFrame(){},requestAnimationFrame(){},reset(){throw new Error('Unexpected restart');}};
    vm.createContext(context);
    const constants=source.match(/const DURATION=.*;/)[0]+'\n'+source.match(/const METERS_PER_SPEED_SECOND=.*;/)[0]+'\n'+source.match(/const ATTACK_POINTS=.*;/)[0];
    vm.runInContext(constants+'\n'+['cruisingSpeed','rawSpeed','speedOf','comebackPercent','checkAttack','interact','visualCarLeft','end','tick'].map(extract).join('\n'),context);
    return {context,nodes};
}

test('Race 2 matches the actual Race 1 engine over a full scripted race, including attacks, nitro fade and comeback',()=>{
    const race=new NeonRace2(),{context,nodes}=original(race);
    for(let frame=0;frame<480&&!race.finished;frame++){
        const actions=[];
        if(frame%4===0)actions.push([frame%8===0?0:1,'like',25]);
        if(frame%11===0)actions.push([1,'gift',1]);
        if(frame%31===0)actions.push([0,'gift',25]);
        if(frame===30||frame===80||frame===160)actions.push([1,'gift',500]);
        if(frame===120||frame===240)actions.push([0,'gift',1000]);
        for(const [team,type,value]of actions){race.contribute(team,type,value);context.interact(team,type==='like'?'likesBatch':'gift','LIVE viewer',value);}
        race.step(.25,false);context.tick(1250+frame*250);
        for(let i=0;i<2;i++){
            for(const field of ['distance','score','likePower','giftSpeed','nitroSeconds','pendingGiftPoints','attackPoints'])assert(Math.abs(race.teams[i][field]-context.teams[i][field])<1e-7,`${field}, team ${i}, frame ${frame}`);
            assert(Math.abs(race.speed(i)-context.speedOf(context.teams[i]))<1e-7,`speed, team ${i}, frame ${frame}`);
            assert(Math.abs(race.visualCarLeft(i)-context.visualCarLeft(i))<1e-7,`visual position, team ${i}, frame ${frame}`);
        }
        assert.equal(race.finished,!context.active);
    }
    assert(race.finished);
    const winner=nodes.get('winner').textContent;
    assert(winner.includes(race.winner===null?'TIE':race.winner===0?'RED':'BLUE'));
});
