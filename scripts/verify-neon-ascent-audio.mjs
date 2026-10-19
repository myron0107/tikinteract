import assert from 'node:assert/strict';
import {readFile, readdir, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';

const root='GAME/NOVA-VEX/audio';
const audit=JSON.parse(await readFile(root+'/sound-design.json','utf8'));
assert.equal(audit.files.length,44);
const oldHashes=new Set(await Promise.all((await readdir('GAME/SKYSHIFT-INTERACT/audio')).filter(x=>x.endsWith('.mp3')).map(async file=>createHash('sha256').update(await readFile('GAME/SKYSHIFT-INTERACT/audio/'+file)).digest('hex'))));
for(const entry of audit.files){
    const hash=createHash('sha256').update(await readFile(root+'/'+entry.file)).digest('hex');
    assert.equal(hash,entry.sha256);
    assert(!oldHashes.has(hash),'Inherited audio still present: '+entry.file);
}
assert.equal(new Set(audit.files.map(x=>x.sha256)).size,44);
assert.equal((await readdir(root)).filter(x=>x.endsWith('.mp3')).length,44);

const browser=await openSkyShiftBrowser('neon-ascent-audio-qa');
const {page,evaluate,waitFor}=browser;
const check=async(expression,message)=>assert(await evaluate(expression),message);
try {
    await page('Page.navigate',{url:(process.env.SKYSHIFT_URL||'http://127.0.0.1:3001')+'/GAME/NOVA-VEX/Neon-Ascent.html?qa'});
    await waitFor('!!window.__neonAscent && document.getElementById("loading").hidden');
    await evaluate('window.a=__neonAscent.audio;window.s=__neonAscent.sim;a.unlock()');
    await check('a.buffers.size===44 && a.failed.length===0 && a.context.state==="running"','All 44 new assets must load and decode');
    const decoded=await evaluate(`Array.from(a.buffers,([id,buffer])=>{
        const samples=buffer.getChannelData(0);let sum=0,peak=0;
        for(const value of samples){sum+=value*value;peak=Math.max(peak,Math.abs(value));}
        return {id,duration:buffer.duration,rms:Math.sqrt(sum/samples.length),peak,seam:Math.abs(samples[0]-samples.at(-1))};
    })`);
    for(const buffer of decoded){
        assert(buffer.rms>.015 && buffer.peak>.1 && buffer.peak<.99,JSON.stringify(buffer));
        if(buffer.id.endsWith('Bed')||buffer.id==='music')assert(buffer.seam<.08,'Loop discontinuity: '+JSON.stringify(buffer));
    }
    await evaluate('window.cues=[];window.play=a.play.bind(a);a.play=(...args)=>{cues.push(args[0]);return play(...args)};a.update(s)');
    const actions={balloon:'energy',anvil:'arrival',magnet:'drone',cloud:'board',rocket:'laser',wind:'arrival',vortex:'arrival',meteor:'arrival'};
    for(const [action,cue] of Object.entries(actions)){
        await evaluate(`cues.length=0;a.effect({kind:'effectStart',action:${JSON.stringify(action)}})`);
        assert.deepEqual(await evaluate('cues'),[cue]);
        await check('a.voices.size>0 && a.voices.size<=8','Gift audio must create bounded real buffer voices');
        await evaluate('for(const v of [...a.voices])a.stopVoice(v)');
    }
    for(const [event,cue] of Object.entries({vexGrab:'hairGrab',vexHairPull:'hairTug',vexRelease:'hairRelease',giftDeparture:'departure',trophyGain:'win',trophyTheft:'theft',alienArrival:'arrival',alienHatch:'lock',alienPunch:'strike',alienTaunt:'taunt',alienExit:'departure',trophyDescent:'ceremony',trophyCatch:'catch',championLift:'fanfare',trophyFlight:'flight',portalReset:'reset',finishReached:'finish'})){
        await evaluate(`cues.length=0;a.effect({kind:${JSON.stringify(event)}})`);
        assert.deepEqual(await evaluate('cues'),[cue]);
    }
    await evaluate('cues.length=0;a.effect({kind:"giftThrow",action:"vortex"});a.effect({kind:"giftLanding",action:"vortex"});a.effect({kind:"landing",sound:false})');
    assert.deepEqual(await evaluate('cues'),['boardThrow','land'],'Throw/landing cues must not repeat at mechanical settlement');
    for(const [action,cue] of Object.entries({balloon:'energyRelease',anvil:'glitchImpact',magnet:'hookLatch',cloud:'jetIgnite',rocket:'portalCross',wind:'gloveHit',vortex:'boardDescent',meteor:'pushContact'})){
        await evaluate(`cues.length=0;a.effect({kind:'giftContact',action:${JSON.stringify(action)}})`);
        assert.deepEqual(await evaluate('cues'),action==='anvil'?[cue,'glitch']:[cue]);
    }
    for(const [action,cue]of Object.entries({anvil:'bananaThrow',wind:'gloveSpring',vortex:'boardCatch',meteor:'pushReach'})){
        await evaluate(`cues.length=0;a.effect({kind:'giftWindup',action:${JSON.stringify(action)}})`);
        assert.deepEqual(await evaluate('cues'),[cue]);
    }
    for(const [kind,bed] of [['magnet','droneBed'],['cloud','boardBed'],['rocket','laserBed'],['meteor','fallBed'],['vortex','rideBed']]){
        await evaluate(`s.active={kind:${JSON.stringify(kind)}};a.update(s)`);
        await check(`a.bedKind===${JSON.stringify(bed)} && a.bed?.buffer===a.buffers.get(${JSON.stringify(bed)})`,'Correct continuous sound for '+kind);
    }
    await evaluate("s.active=null;a.update(s);for(const v of [...a.voices])a.stopVoice(v);window.meter=a.context.createAnalyser();meter.fftSize=2048;a.master.connect(meter);window.level=()=>{let data=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length)}");
    await check('a.bed===null && a.music?.loop===true','Travel hum must stop after gift; new music must loop');
    await waitFor('level()>.0001');
    await evaluate('s.paused=true;a.update(s)');
    await new Promise(resolve=>setTimeout(resolve,400));
    await check('a.music===null && a.bed===null && a.voices.size===0 && level()<.00001','Pause must silence music and FX');
    await evaluate('s.paused=false;a.update(s)');
    await check('a.music!==null','Music must resume after pause');
    await evaluate('a.muted=true;a.update(s);a.effect({kind:"effectStart",action:"meteor"})');
    await check('a.music===null && a.voices.size===0','Mute must silence the game including new events');
    await evaluate('a.muted=false;s.setSettings({soundEnabled:false});a.update(s)');
    await check('a.music===null && a.voices.size===0','Sound setting must mute all audio');
    await evaluate('s.setSettings({soundEnabled:true});a.route({enabled:false,volume:1});a.update(s)');
    await check('a.music===null','Platform mixer mute must stop music');
    await evaluate('a.route({enabled:true,volume:0});a.update(s)');
    await check('a.music===null','Platform mixer zero volume must stop music');
    await evaluate('a.route({enabled:true,volume:.5});a.update(s)');
    await check('a.music!==null','Platform mixer restore must resume music');
    await evaluate("for(const [id,value]of [['fx-volume','32'],['music-volume','12']]){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input'));}a.update(s)");
    await check('s.settings.soundVolume===.32 && s.settings.musicVolume===.12','Existing volume controls must adjust new audio');
    await evaluate('s.setSettings({winCountdown:3});s.phase="holding";s.hold=0;cues.length=0;a.update(s);a.update(s);s.hold=1.1;a.update(s);a.countdown=null;s.phase="playing";a.update(s)');
    assert.equal((await evaluate('cues')).filter(x=>x==='tick').length,2,'Countdown cue once per changed second, never each frame');
    await evaluate('for(let i=0;i<30;i++)a.play("energy",.3,0)');
    await check('a.voices.size<=8','Large gifts must not create unlimited audio voices');
    await evaluate('a.dispose()');
    await check('a.voices.size===0 && a.music===null && a.bed===null','Game exit must release audio');
    assert.deepEqual(browser.errors,[]);
    await mkdir('.tools/neon-ascent-qa',{recursive:true});
    await writeFile('.tools/neon-ascent-qa/audio-result.json',JSON.stringify({passed:true,decoded,checks:['44 original assets','all gifts and cinematic cues','seamless loops','audible mixer signal','pause and resume','mute and soundEnabled','platform audio routing','volume controls','countdown deduplication','voice limit','dispose']},null,2));
    console.log('NEON ASCENT: 44 physical arcade audio assets decoded; gift/cinematic cues, loops, real mixer signal, pause/mute/volume/countdown/cleanup verified.');
}finally{await browser.close();}
