import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';

const out='.tools/neon-ascent-qa/vex-drive-by';await mkdir(out,{recursive:true});
const b=await openSkyShiftBrowser('neon-ascent-vex-drive-by-qa');
const {page,evaluate,waitFor}=b;
try{
  const report=[];
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await page('Page.navigate',{url:'http://localhost:3001/GAME/NOVA-VEX/Neon-Ascent.html?qa'});
    await waitFor('!!window.__neonAscent&&document.getElementById("loading").hidden');
    await evaluate(`window.g=__neonAscent;window.s=g.sim;window.r=g.renderer;window.cues=[];window.nodes=[];window.heroPoses=[];const sprite=r.sprite.bind(r);r.sprite=(name,...args)=>{if(['idle','reactStart','reactPull','reactRecover'].includes(name))heroPoses.push(name);return sprite(name,...args)};window.onCue=r.onCue;r.onCue=e=>{cues.push(e);onCue(e)};const show=r.winShow,board=show.board.bind(show),rival=show.rival.bind(show);show.board=(ctx,x,y,...rest)=>{nodes.push({kind:'board',x,y});return board(ctx,x,y,...rest)};show.rival=(ctx,x,y,...rest)=>{nodes.push({kind:'rival',x,y,pose:rest[1],clench:rest[4]});return rival(ctx,x,y,...rest)};window.frames=[]`);
    for(const [name,x]of [['right',140],['left',340]]){
      await evaluate(`g.control({action:'session.panic'});g.control({action:'session.resume'});g.teleport(500);r.moment=null;s.player.x=s.previous.x=${x};s.wins=5;r.presentedWins=5;cues.length=0;g.action({action:'winRemove',amount:2,commandId:${JSON.stringify(name+'-'+width)},actor:{username:'preview'}});g.render()`);
      assert.equal(await evaluate('r.presentedWins'),5,'Crown display must wait for the tug');
      const duration=await evaluate('r.scoreMoment.duration');assert.equal(duration,3.5);
      for(const [label,t]of [['arrival',.14],['brake',.29],['reach',.39],['grip',.46],['tug',.55],['release',.68],['departure',.84]]){
        await evaluate(`nodes.length=0;heroPoses.length=0;g.advance(Math.max(0,${t}*r.scoreMoment.duration-(s.clock-r.scoreMoment.clock)));g.render()`);
        const state=await evaluate(`({phase:r.scoreMoment.phase,presented:r.presentedWins,nodes,heroPoses,errors:s.presentationErrors})`);
        assert.equal(state.errors,0);
        const expectedPose={grip:'reactStart',tug:'reactPull',release:'reactRecover'}[label]||'idle';
        assert(state.heroPoses.includes(expectedPose),'Main character must visibly react with '+expectedPose);
        if(['grip','tug'].includes(label)){const actor=state.nodes.find(n=>n.kind==='rival');assert.equal(actor.pose,'grab');assert(actor.clench>.7,'The hand must visibly close while holding hair');}
        const board=state.nodes.find(n=>n.kind==='board'),rival=state.nodes.find(n=>n.kind==='rival');
        assert(board&&rival,'Vex and his board must render together throughout the scene');
        assert(Math.abs(board.y-rival.y)<=8,'Vex must stay on the board');
        assert(Math.abs(board.x-rival.x)<=26,'Reaching must remain inside the board');
        assert.equal(state.presented,t<.50?5:3,'Two crowns must be applied once, at the tug');
        await b.screenshot(`${out}/${width}-${name}-${label}.webp`);
        if(width===390&&name==='right')await evaluate(`frames.push({label:${JSON.stringify(label)},image:r.canvas.toDataURL('image/webp',.9),fx:r.fxCanvas.toDataURL('image/webp',.9)})`);
      }
      await evaluate('g.control({action:"session.pause"});g.render()');
      const frozen=await evaluate('r.canvas.toDataURL()+r.fxCanvas.toDataURL()');
      await evaluate('g.advance(.4)');
      assert.equal(await evaluate('r.canvas.toDataURL()+r.fxCanvas.toDataURL()'),frozen,'Pause must freeze the board and rider');
      await evaluate('g.control({action:"session.resume"});g.advance(1)');
      assert.equal(await evaluate('r.scoreMoment'),null,'Vex must leave and release the game');
      assert.equal(await evaluate('s.wins'),3);
      const cues=await evaluate('cues.map(e=>e.kind)');
      for(const name of ['alienArrival','alienHatch','vexGrab','vexHairPull','trophyTheft','vexRelease','alienExit'])assert.equal(cues.filter(c=>c===name).length,1,'Scene cue must run once: '+name);
      assert(!cues.includes('alienTaunt')&&!cues.includes('alienPunch'),'The hair-pull scene must not punch or taunt');
      assert.equal(await evaluate(`g.action({action:'winRemove',amount:2,commandId:${JSON.stringify(name+'-'+width)}})`),false,'Duplicate commands must not replay the attack');
      report.push({width,side:name,duration,cues,passed:true});
    }
    // An old saved scene adopts the new timeline without a repeated tug/score.
    await evaluate(`g.control({action:'session.panic'});g.control({action:'session.resume'});s.wins=5;r.presentedWins=5;g.action({action:'winRemove',amount:1});g.render();Object.assign(r.scoreMoment,{cinematicVersion:2,duration:5.2,clock:s.clock-5.2*.55,cueFlags:{alienArrival:true,alienHatch:true},scoreApplied:false});cues.length=0;g.render();g.render()`);
    assert.equal(await evaluate('r.scoreMoment.duration'),3.5);
    for(const color of ['Cyan','Mint','Violet','Rose','Amber','Red']){await evaluate('s.setSettings({characterColor:'+JSON.stringify(color)+'});g.render()');assert(await evaluate('r.reactionAtlas.naturalWidth>0&&s.presentationErrors===0'));if(color!=='Cyan')assert(await evaluate('Object.keys(r.colorCache.get('+JSON.stringify(color)+')).filter(name=>name.startsWith("react")).length===3'));}
    assert.equal(await evaluate('r.presentedWins'),4);
    assert.equal(await evaluate('cues.length'),0,'Restored scene must not replay passed audio cues');
    if(width===390){
      const sheet=await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=900;c.height=990;const ctx=c.getContext('2d');ctx.fillStyle='#0b1220';ctx.fillRect(0,0,900,990);for(let i=0;i<frames.length;i++){const f=frames[i],im=new Image(),fx=new Image();im.src=f.image;fx.src=f.fx;await Promise.all([im.decode(),fx.decode()]);const x=i%3*300,y=Math.floor(i/3)*330;ctx.drawImage(im,0,im.height*.32,im.width,im.height*.45,x,y+25,300,300);ctx.drawImage(fx,0,fx.height*.32,fx.width,fx.height*.45,x,y+25,300,300);ctx.fillStyle='#fff';ctx.font='14px sans-serif';ctx.fillText(f.label,x+12,y+18);}return c.toDataURL('image/webp',.92).split(',')[1]})()`);
      await writeFile(out+'/stages.webp',Buffer.from(sheet,'base64'));
    }
  }
  assert.deepEqual(b.errors,[]);
  await writeFile(out+'/result.json',JSON.stringify({passed:true,report},null,2));
  console.log('Vex: lateral arrival/grip/hair tug/release/exit verified from both sides, desktop/mobile; board attachment, one contact, score, pause and replay protection passed.');
}finally{await b.close();}
