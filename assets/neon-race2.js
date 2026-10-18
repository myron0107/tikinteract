import {NeonRace2,RACE_RULES} from './neon-race2-engine.js?v=3';
import {createNightRenderer} from './neon-race2-renderer.js?v=8';
import {createVictoryEffects} from './neon-race2-effects.js?v=4';
import {RaceAudio} from './neon-race2-audio.js?v=3';

const $ = id => document.getElementById(id);
const race = new NeonRace2();
const renderer = createNightRenderer($('raceCanvas'));
const victoryEffects = createVictoryEffects($('victoryEffects'));
const raceAudio = new RaceAudio();
const names = ['RED','BLUE'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let clock=0, effectsClock=0, last=0, lastPaint=0, lastHud=0, lastDemo=0, simulation=false, noticeUntil=0, currentSession=null;
const demoUsers = ['Pilot Luna','Night Owl','Alex','Mira','Turbo'];
function drawFrame(){
    renderer.draw(race,reduced.matches?0:clock,{effectsTime:reduced.matches?0:effectsClock,reduced:reduced.matches});
    victoryEffects.draw(race,effectsClock,reduced.matches);
}

function notice(text) {$('raceNotice').textContent=text;noticeUntil=clock+4;}
function accept(event) {
    const result=race.event(event);
    if(!result){updateHud();return;}
    notice(event.type==='chat' ? `${result.name} a intrat în TEAM ${names[result.index]}.` : `${String(event.displayName || event.username).slice(0,30)} · ${result.type==='like'?'♥ +':'✦ +'}${result.value}`);
    updateHud();
}
function renderTop(index) {
    const list=$(index?'topBlue':'topRed');
    const top=race.top(index);
    const signature=JSON.stringify(top);
    if(list.dataset.signature===signature)return;
    list.dataset.signature=signature;
    list.replaceChildren();
    if(!top.length) {const row=document.createElement('li');row.className='empty';row.textContent=`Scrie ${names[index]} în chat și intră în cursă.`;list.append(row);return;}
    top.forEach((person,i)=>{
        const row=document.createElement('li'),rank=document.createElement('span'),name=document.createElement('b');
        rank.className='supporter-rank';rank.textContent=String(i+1).padStart(2,'0');name.textContent=person.name;name.title=person.name;
        row.append(rank,name);
        for(const [field,column,icon,label]of [['coins','gifts','🎁','monede din cadouri'],['likes','likes','♥','like-uri']]){
            const stat=document.createElement('small'),symbol=document.createElement('span'),value=document.createElement('strong');
            stat.className=`supporter-${column}`;stat.setAttribute('aria-label',`${person[field].toLocaleString('ro-RO')} ${label}`);stat.title=stat.getAttribute('aria-label');
            symbol.textContent=icon;symbol.setAttribute('aria-hidden','true');value.textContent=new Intl.NumberFormat('ro-RO',{notation:person[field]>=10000?'compact':'standard',maximumFractionDigits:1}).format(person[field]);stat.append(symbol,value);row.append(stat);
        }
        list.append(row);
    });
}
function updateOverlay() {
    $('raceOverlay').hidden=!race.paused&&!race.finished;
    $('raceOverlay').classList.toggle('is-result',race.finished);
    $('raceOverlay').classList.toggle('red-win',race.finished&&race.winner===0);
    $('raceOverlay').classList.toggle('blue-win',race.finished&&race.winner===1);
    $('resultDetails').hidden=!race.finished;
    $('nextRaceCountdown').hidden=!race.finished||!$('autoNext').checked;
    $('pauseResume').hidden=!race.paused||race.finished;
    $('resultNextRace').hidden=!race.finished;
    if(!race.paused&&!race.finished)return;
    $('overlayKicker').textContent=race.finished?`REZULTAT / RUN ${String(race.round).padStart(2,'0')}`:'CONTROL CURSĂ';
    $('overlaySymbol').classList.toggle('is-pause',!race.finished);
    $('overlaySymbol').textContent=race.finished?(race.winner===null?'=':'🏆'):'';
    $('overlayTitle').textContent=race.finished?(race.winner===null?'Egalitate':`TEAM ${names[race.winner]} CÂȘTIGĂ`):'Cursă în pauză';
    $('overlayDescription').textContent=!race.finished?'Mașinile și cronometrul sunt oprite. Reia cursa când ești pregătit.':race.resultReason==='time'?'Timp expirat. Rezultat: 70% distanță + 30% puncte.':race.resultReason==='finish-points'?'Sosire simultană. Câștigă echipa cu mai multe puncte.':race.winner===null?'Ambele echipe au trecut simultan linia de finiș.':'Prima echipă care a trecut linia de finiș.';
    if(race.finished){
        race.teams.forEach((team,i)=>{$((i?'blue':'red')+'Result').textContent=`${Math.floor(team.distance).toLocaleString('ro-RO')} m · ${team.score.toLocaleString('ro-RO')} puncte`;});
        $('nextRaceSeconds').textContent=String(Math.ceil(race.nextIn));
    }
}
function updateHud() {
    $('round').textContent=String(race.round).padStart(2,'0');
    const remaining=Math.ceil(race.time);
    $('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
    $('roundState').textContent=race.paused?'CURSĂ ÎN PAUZĂ':race.finished?(race.winner===null?'EGALITATE':`TEAM ${names[race.winner]} CÂȘTIGĂ`):simulation?'SIMULARE · EVENIMENTE DE TEST':'CURSA ESTE ÎN DESFĂȘURARE';
    if(race.finished)$('raceNotice').textContent=$('autoNext').checked?`Următoarea cursă în ${Math.ceil(race.nextIn)} secunde.`:'Pornește o cursă nouă din TEST MENU.';
    else if(clock>noticeUntil)$('raceNotice').textContent='Chat-ul dă ritmul.';
    race.teams.forEach((team,i)=>{
        const prefix=i?'blue':'red';
        $(prefix+'Distance').textContent=`${Math.floor(team.distance).toLocaleString('ro-RO')} m`;
        $(prefix+'Progress').setAttribute('aria-valuenow',String(Math.floor(team.distance)));
        $(prefix+'Progress').firstElementChild.style.width=`${team.distance/RACE_RULES.finish*100}%`;
        $(prefix+'Speed').replaceChildren(document.createTextNode(String(Math.round(race.finished?0:race.speed(i)))+' '));
        const unit=document.createElement('small');unit.textContent='KM/H';$(prefix+'Speed').append(unit);
        const nitroPercent=Math.max(0,Math.min(100,team.nitroSeconds/RACE_RULES.nitroFade*100));
        $(prefix+'Nitro').firstElementChild.style.width=`${nitroPercent}%`;
        $(prefix+'Nitro').setAttribute('aria-valuenow',String(Math.round(nitroPercent)));
        $(prefix+'Nitro').setAttribute('aria-valuetext',`${team.nitroSeconds.toFixed(1)} secunde nitro`);
        const pose=renderer.pose(race,i);
        $(prefix+'Telemetry').style.left=`${(pose.x+pose.width*.5)/1200*540}px`;
        $(prefix+'Telemetry').style.top=`${(pose.y-62)/900*405}px`;
        renderTop(i);
    });
    $('wins').textContent=`RED ${race.wins[0]} : ${race.wins[1]} BLUE`;
    $('pause').textContent=race.paused?'▶ Reia cursa':'Pauză';
    $('pause').disabled=race.finished;
    updateOverlay();
    audioUpdate();
}
function resize() {
    const embedded=parent!==window;
    document.body.classList.toggle('embedded',embedded);
    const scale=Math.min(1,(innerWidth-(embedded?0:24))/540,embedded?innerHeight/960:1);
    $('shell').style.transform=`scale(${Math.max(.1,scale)})`;
    $('game-fit').style.width=`${540*scale}px`;$('game-fit').style.height=`${960*scale}px`;
    const pixelRatio=Math.min(devicePixelRatio||1,2);
    $('raceCanvas').width=Math.round(540*scale*pixelRatio);$('raceCanvas').height=Math.round(405*scale*pixelRatio);
    drawFrame();
}
function audioUpdate() {
    raceAudio.setLevels({master:$('volumeMaster').value,engine:$('volumeEngine').value,effects:$('volumeEffects').value});
    raceAudio.sync(race,{hidden:document.hidden,autoNext:$('autoNext').checked});
}
function soundLabel() {
    $('sound').textContent=raceAudio.enabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(raceAudio.enabled));audioUpdate();
}
function soundUnavailable() {
    void raceAudio.setEnabled(false,race).catch(()=>{});
    soundLabel();$('testFeedback').textContent='Sunetul nu este disponibil în acest browser.';
}
function setSound(enabled) {
    // Keep the toggle usable even when the browser leaves resume() pending.
    const request=raceAudio.setEnabled(enabled,race);
    soundLabel();
    void request.catch(soundUnavailable);
}
$('sound').onclick=()=>setSound(!raceAudio.enabled);
function unlockSound(event) {
    if(event.isTrusted&&raceAudio.enabled&&raceAudio.context?.state!=='running'){
        void raceAudio.resume(race).catch(soundUnavailable);
    }
}
const audioGestureDocuments=[document];
try {if(parent!==window)audioGestureDocuments.push(parent.document);}catch{}
for(const target of audioGestureDocuments){
    target.addEventListener('pointerdown',unlockSound,true);
    target.addEventListener('keydown',unlockSound,true);
}
function removeAudioGestures() {
    for(const target of audioGestureDocuments){
        target.removeEventListener('pointerdown',unlockSound,true);
        target.removeEventListener('keydown',unlockSound,true);
    }
}
for(const id of ['volumeMaster','volumeEngine','volumeEffects'])$(id).oninput=audioUpdate;
$('pause').onclick=()=>{if(race.finished)return;race.paused=!race.paused;updateHud();};
$('pauseResume').onclick=()=>{$('pause').click();};
$('resultNextRace').onclick=()=>{race.reset();updateHud();drawFrame();};
$('reset').onclick=()=>{race.reset();notice('Cursă nouă. Comunitatea alege ritmul.');updateHud();};
$('auto').onclick=()=>{simulation=!simulation;$('auto').textContent=`LIVE SIM: ${simulation?'ON':'OFF'}`;if(simulation)$('testFeedback').textContent='Simularea adaugă numai spectatori și contribuții de test.';updateHud();};
$('resetSupporters').onclick=()=>{race.clearSupporters();updateHud();};
document.querySelectorAll('[data-team]').forEach(button=>button.onclick=()=>{
    const index=Number(button.dataset.team),gift=button.dataset.kind==='gift',value=gift?Number($('giftValue').value):button.dataset.kind==='like25'?25:1;
    const result=race.contribute(index,gift?'gift':'like',value,`test-${index}`,`Test ${names[index]}`);
    if(result)notice(`TEST / TEAM ${names[index]} · +${value} ${gift?'puncte cadou':'likes'}`);
    else $('testFeedback').textContent='Reia cursa sau pornește o rundă nouă pentru a testa interacțiunile.';
    updateHud();
});
$('sendChat').onclick=()=>{
    const result=race.join($('chatUser').value,$('chatMessage').value);
    $('testFeedback').textContent=result?`${result.name} a intrat în TEAM ${names[result.index]}.`:'Introdu un nume și comanda RED sau BLUE.';
};
$('chatMessage').onkeydown=event=>{if(event.key==='Enter')$('sendChat').click();};
function menu(open){$('testPanel').hidden=!open;$('testToggle').setAttribute('aria-expanded',String(open));}
$('testToggle').onclick=()=>menu($('testPanel').hidden);$('testClose').onclick=()=>menu(false);
window.addEventListener('resize',resize);
reduced.addEventListener('change',drawFrame);
document.addEventListener('visibilitychange',()=>{last=0;audioUpdate();});
window.addEventListener('pagehide',()=>{removeAudioGestures();raceAudio.dispose();});
function tick(now) {
    if(!last)last=now;
    const dt=Math.min((now-last)/1000,.1);last=now;
    if(!document.hidden) {
        race.step(dt,$('autoNext').checked);
        if(!race.paused)effectsClock+=dt;
        if(!race.paused&&!race.finished)clock+=dt;
        if(simulation&&clock-lastDemo>1) {
            lastDemo=clock;
            const person=demoUsers[Math.floor(Math.random()*demoUsers.length)],team=Math.random()<.5?0:1;
            race.join(`demo-${person}`,names[team]);race.event({type:Math.random()<.15?'gift':'like',username:`demo-${person}`,displayName:`[TEST] ${person}`,likeCount:25,coins:5});
        }
        if(now-lastPaint>1000/(reduced.matches?10:30)){drawFrame();lastPaint=now;}
        raceAudio.sync(race,{hidden:false,autoNext:$('autoNext').checked});
        if(now-lastHud>150){updateHud();lastHud=now;}
    }
    requestAnimationFrame(tick);
}
// Register after the complete control panel is bound: Studio can use it immediately.
window.TikInteractGame?.register({
    viewport:{width:540,height:960},
    onChat:accept,onLike:accept,onGift:accept,
    onStatus(state) {
        if(state.connected&&state.sessionId!==currentSession) {
            simulation=false;$('auto').textContent='LIVE SIM: OFF';
            race.members.clear();race.clearSupporters();race.wins=[0,0];race.reset();
            currentSession=state.sessionId;
        }
        updateHud();
    }
});
resize();updateHud();setSound(true);renderer.images.forEach(image=>image.addEventListener('load',drawFrame));requestAnimationFrame(tick);
