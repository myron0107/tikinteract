import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';

const out='.tools/neon-ascent-qa/vex-negatives';await mkdir(out,{recursive:true});
const b=await openSkyShiftBrowser('nova-vex-negative-gifts-qa');
const {page,evaluate,waitFor}=b;
const specs={anvil:{delta:-5,pose:'vexThrow',cue:'bananaThrow',hit:'glitchImpact'},wind:{delta:-50,pose:'vexPush',cue:'gloveSpring',hit:'gloveHit'},vortex:{delta:-300,pose:'rideCatch',cue:'boardCatch',hit:'boardDescent'},meteor:{delta:-150,pose:'pushTouch',cue:'pushReach',hit:'pushContact'}};
const report=[];
try{
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await page('Page.navigate',{url:'http://localhost:3001/GAME/NEON-ASCENT/Neon-Ascent.html?qa'});
    await waitFor('!!window.__neonAscent&&document.getElementById("loading").hidden');
    await evaluate(`window.g=__neonAscent;window.s=g.sim;window.r=g.renderer;window.a=g.audio;window.cues=[];window.nodes=[];window.frames=[];const rival=r.winShow.rival.bind(r.winShow);r.winShow.rival=(ctx,x,y,...args)=>{nodes.push({x,y,pose:args[1],height:args[0]});return rival(ctx,x,y,...args)};const sprite=r.sprite.bind(r);r.sprite=(name,x,y,...args)=>{if(['pushTouch','pushExtend','rideCatch','rideHold'].includes(name))nodes.push({x,y,pose:name,height:args[1]});return sprite(name,x,y,...args)};const play=a.play.bind(a);a.play=(...args)=>{cues.push(args[0]);return play(...args)};a.unlock()`);
    for(const [side,x]of [['right',140],['left',340]])for(const [action,spec]of Object.entries(specs)){
      const id=`${width}-${side}-${action}`;
      await evaluate(`g.control({action:'session.panic'});g.control({action:'session.resume'});g.teleport(1000);r.moment=null;s.player.x=s.previous.x=${x};window.before=s.ledger.appliedMeters;cues.length=0;g.action({action:${JSON.stringify(action)},amount:2,commandId:${JSON.stringify(id)},actor:{username:'preview'}});g.advance(.0084)`);
      const timing=await evaluate('({contact:s.active.travelAt,end:s.active.travelEnd,duration:s.active.duration})');
      await evaluate(`nodes.length=0;g.advance(${timing.contact*.65}-.0084)`);
      const beforeContact=await evaluate('({distance:s.distance,nodes,cues})');
      assert.equal(beforeContact.distance,1000,'Nova must wait for Vex to make contact');
      assert(beforeContact.nodes.some(n=>n.pose===spec.pose),'Actual Vex action pose must appear: '+id);
      assert.equal(beforeContact.cues.filter(c=>c===spec.cue).length,1,'Windup sound must play once');
      assert.equal(beforeContact.cues.filter(c=>c===spec.hit).length,0,'Impact must not sound before contact');
      const stages=['vortex','meteor'].includes(action)?[['grip',timing.contact*.65],['windup',timing.contact*.9],['contact',timing.contact+.05],['travel',(timing.contact+timing.end)/2],['throw',timing.contact+(timing.end-timing.contact)*.8],['land',timing.end+.12],['departure',timing.duration-.12]]:[['windup',timing.contact*.85],['contact',timing.contact+.08],['travel',(timing.contact+timing.end)/2],['departure',timing.duration-.12]];
      for(const [stage,time]of stages){
        await evaluate(`g.advance(Math.max(0,${time}-s.active.elapsed));g.render()`);
        if(['vortex','meteor'].includes(action)){
          const scene=await evaluate('({frame:r.giftFX.vex.frame(s,200,500),hero:r.giftFX.hero(s),distance:s.distance,bed:a.bedKind})');
          const {frame:f,hero:h}=scene;
          assert(Object.values(h).every(v=>typeof v!=="number"||Number.isFinite(v)),'Finite Nova transform: '+id+'/'+stage);
          if(['grip','windup'].includes(stage)){
            assert.equal(f.pair.alpha,1,'Use actual paired hand contact, not detached character sprites');assert.equal(h.alpha,0,'Do not duplicate Nova behind the contact artwork');
            assert.equal(scene.distance,1000,'No falling while Vex is still holding/pushing');
            if(stage==='grip'){
              assert.equal(f.pair.mix,0,'Hold the first contact pose long enough to read');
              await evaluate('window.contactStart=r.giftFX.vex.frame(s,200,500).pair');
            }else{
              assert(f.pair.mix>.6,'Move from palms placed to palms extended / catch to pull');
              const start=await evaluate('contactStart');
              if(action==='meteor')assert(f.side*f.pair.heroX<f.side*start.heroX-8,'Nova slides away during a sustained push');
            }
            assert.equal(await evaluate('r.giftFX.shake(s)'),0,'No punch camera shake');
          }
          if(stage==='travel'&&action==='vortex'){
            assert.equal(f.phase,'ride');assert(Math.abs((500+h.y)-(f.boardY-5))<1,'Nova feet must stay on shared board');
            assert.equal(f.pair.alpha,1,'Keep a visible grip while riding');
            assert(Math.abs(200+h.x-f.boardX)<f.boardSize/2&&Math.abs(f.bx-f.boardX)<f.boardSize/2,'Both riders must fit on one board');
            assert.equal(scene.bed,'rideBed','Only hoverboard sound while riding');
          }
          if(stage==='travel'&&action==='meteor'){
            assert.equal(f.phase,'freefall');assert(f.boardY<250,'Vex stays above the falling Nova');assert.equal(h.pose,'fall');
            assert.equal(scene.bed,'fallBed');
          }
          if(stage==='throw'&&action==='vortex'){
            assert.equal(f.phase,'throw');assert(Math.abs(f.boardX-(200+h.x))>80,'Nova must separate from the board after Vex throws her');
            assert.equal(scene.bed,'fallBed');assert.equal(h.pose,'fall');
          }
          if(stage==='land'){
            assert.equal(scene.distance,1000+spec.delta*2,'Land at exact destination');assert.equal(h.pose,'reactRecover');assert.equal(scene.bed,'');
          }
          if(['grip','windup','travel','throw'].includes(stage)){
            await evaluate('g.control({action:"session.pause"});g.render()');
            const frozen=await evaluate('r.canvas.toDataURL()');await evaluate('g.advance(.2)');
            assert.equal(await evaluate('r.canvas.toDataURL()'),frozen,'Pause must freeze the ride/fall: '+id+'/'+stage);
            await evaluate('g.control({action:"session.resume"})');
          }
        }
        if(width===390&&side==='right'){
          await b.screenshot(`${out}/${action}-${stage}.webp`);
          await evaluate(`frames.push({action:${JSON.stringify(action)},stage:${JSON.stringify(stage)},image:r.canvas.toDataURL('image/webp',.9)})`);
        }
        assert.equal(await evaluate('s.presentationErrors'),0,'No drawing errors: '+id);
      }
      const cues=await evaluate('cues');
      for(const cue of ['arrival',spec.cue,spec.hit,'departure'])assert.equal(cues.filter(c=>c===cue).length,1,'Cue repeats: '+id+'/'+cue);
      if(action==='vortex')assert.equal(cues.filter(c=>c==='boardThrow').length,1,'Throw sound once when Nova leaves the board');
      if(['vortex','meteor'].includes(action))assert.equal(cues.filter(c=>c==='land').length,1,'Landing sound once at destination');
      await evaluate('g.control({action:"session.pause"});g.render()');
      const frozen=await evaluate('r.canvas.toDataURL()');await evaluate('g.advance(.3)');
      assert.equal(await evaluate('r.canvas.toDataURL()'),frozen,'Pause must freeze Vex and props');
      await evaluate('g.control({action:"session.resume"});g.advance(.4)');
      if(['vortex','meteor'].includes(action))assert.equal((await evaluate('cues')).filter(c=>c==='land').length,1,'No duplicate landing sound when gift finishes');
      assert.equal(await evaluate('s.ledger.appliedMeters-before'),spec.delta*2,'Gift quantity/value changed: '+id);
      assert.equal(await evaluate(`g.action({action:${JSON.stringify(action)},amount:2,commandId:${JSON.stringify(id)}})`),false,'Duplicate gift replayed');
      report.push({width,side,action,delta:spec.delta*2,pose:spec.pose,passed:true});
    }
    if(width===390){
      const sheet=await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=1040;c.height=Math.ceil(frames.length/4)*310;const ctx=c.getContext('2d');ctx.fillStyle='#091225';ctx.fillRect(0,0,c.width,c.height);for(let i=0;i<frames.length;i++){const f=frames[i],im=new Image();im.src=f.image;await im.decode();const x=i%4*260,y=Math.floor(i/4)*310;ctx.drawImage(im,0,im.height*.25,im.width,im.height*.65,x,y+24,260,280);ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(f.action+' / '+f.stage,x+9,y+16);}return c.toDataURL('image/webp',.9).split(',')[1]})()`);
      await writeFile(out+'/stages.webp',Buffer.from(sheet,'base64'));
    }
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow');
  }
  const colors=await evaluate(`(()=>{
    const results=[];
    for(const color of ['Mint','Violet','Rose','Amber','Red']){
      r.color(color);
      for(const name of ['pushTouch','pushExtend','rideCatch','rideHold']){
        const image=r.colorCache.get(color)[name],s=r.sprites[name],c=document.createElement('canvas');c.width=image.width;c.height=image.height;
        const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(r.interactionAtlas,s.x,s.y,s.w,s.h,0,0,c.width,c.height);
        const base=ctx.getImageData(0,0,c.width,c.height).data,paint=image.getContext('2d').getImageData(0,0,c.width,c.height).data;
        let changed=0,vexChanged=0,warmChanged=0;
        for(let i=0;i<base.length;i+=4){
          const diff=base[i]!==paint[i]||base[i+1]!==paint[i+1]||base[i+2]!==paint[i+2];
          if(diff)changed++;
          if(diff&&(i/4)%c.width>c.width*.66)vexChanged++;
          if(diff&&base[i]>base[i+1]*1.15&&base[i]>base[i+2]*1.1&&base[i+1]>50)warmChanged++;
        }
        results.push({color,name,changed,vexChanged,warmChanged});
      }
    }
    r.color('Cyan');return results;
  })()`);
  for(const entry of colors){assert(entry.changed>100,'Nova outfit must update: '+JSON.stringify(entry));assert.equal(entry.vexChanged,0,'Preserve Vex');assert.equal(entry.warmChanged,0,'Preserve warm skin');}
  assert.deepEqual(b.errors,[]);
  await writeFile(out+'/result.json',JSON.stringify({passed:true,report,colors},null,2));
  console.log('All four negative gifts are Vex scenes: 16 desktop/mobile/direction cases verified; new poses, contact timing, exact quantities, audio, pause and replay protection passed.');
}finally{await b.close()}
