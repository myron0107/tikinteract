import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';

const dir='.tools/neon-ascent-qa/physical-gifts';await mkdir(dir,{recursive:true});
const browser=await openSkyShiftBrowser('neon-ascent-motion-qa');
const {page,evaluate,waitFor}=browser;
try{
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await page('Page.navigate',{url:'http://localhost:3001/GAME/NOVA-VEX/Neon-Ascent.html?qa'});
  await waitFor('!!window.__neonAscent && document.getElementById("loading").hidden');
  await evaluate(`window.g=__neonAscent;window.s=g.sim;window.r=g.renderer;window.a=g.audio;window.cues=[];window.play=a.play.bind(a);a.play=(...args)=>{cues.push(args[0]);return play(...args)};a.unlock();window.frames=[]`);
  const results=[];
  const gifts={balloon:[5,'energyRelease'],anvil:[-5,'glitchImpact'],magnet:[50,'hookLatch'],cloud:[150,'jetIgnite'],rocket:[300,'portalCross'],wind:[-50,'gloveHit'],vortex:[-300,'boardDescent'],meteor:[-150,'pushContact']};
  for(const [kind,[delta,cue]]of Object.entries(gifts)){
    await evaluate(`g.control({action:'session.panic'});g.control({action:'session.resume'});g.teleport(500);r.moment=null;cues.length=0;window.before=s.ledger.appliedMeters;g.action({action:${JSON.stringify(kind)},amount:2,commandId:${JSON.stringify('physical-'+kind)}});g.advance(.0084)`);
    const spec=await evaluate('({contact:s.active.travelAt,end:s.active.travelEnd,duration:s.active.duration,from:s.active.from,delta:s.active.applied})');
    assert.equal(spec.delta,delta*2,'Gift quantity changed');
    await evaluate(`g.advance(${spec.contact*.65}-.0084)`);
    assert.equal(await evaluate('s.distance'),spec.from,'Height moved before the object made contact: '+kind);
    assert.equal((await evaluate('cues')).filter(x=>x===cue).length,0,'Contact audio played before the object touched the runner');
    const snapshots=[];
    for(const [label,time]of [['arrive',spec.contact*.65],['contact',spec.contact+.06],['travel',(spec.contact+spec.end)/2],['release',spec.duration-.12]]){
      await evaluate(`g.advance(Math.max(0,${time}-s.active.elapsed));frames.push({kind:${JSON.stringify(kind)},stage:${JSON.stringify(label)},image:r.canvas.toDataURL('image/webp',.9)});`);
      snapshots.push(await evaluate('r.canvas.toDataURL()'));
      await browser.screenshot(dir+'/'+kind+'-'+label+'.webp');
    }
    assert.equal(new Set(snapshots).size,4,'The four animation stages must differ: '+kind);
    assert.equal((await evaluate('cues')).filter(x=>x===cue).length,1,'Contact sound must play exactly once: '+kind);
    await evaluate('g.control({action:"session.pause"});g.render()');
    const frozen=await evaluate('r.canvas.toDataURL()');
    await evaluate('g.advance(.2)');
    assert.equal(await evaluate('r.canvas.toDataURL()'),frozen,'Pause must freeze the animation: '+kind);
    await evaluate('g.control({action:"session.resume"});g.advance(.4)');
    assert.equal(await evaluate('s.ledger.appliedMeters-before'),delta*2,'Animation changed the applied gift distance');
    assert.equal(await evaluate('s.presentationErrors'),0);
    results.push({kind,...spec,stages:4,contactCue:cue});
  }
  // Inspect a compact visual sheet showing actual rendered arrival/contact/travel/release.
  const sheet=await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=880;c.height=8*290;const ctx=c.getContext('2d');ctx.fillStyle='#07101f';ctx.fillRect(0,0,c.width,c.height);for(let i=0;i<frames.length;i++){const f=frames[i],im=new Image();im.src=f.image;await im.decode();const col=i%4,row=Math.floor(i/4);ctx.drawImage(im,0,im.height*.18,im.width,im.height*.7,col*220,row*290+25,220,265);ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(f.kind+' / '+f.stage,col*220+8,row*290+17);}return c.toDataURL('image/webp',.9).split(',')[1]})()`);
  await writeFile(dir+'/animation-stages.webp',Buffer.from(sheet,'base64'));
  assert.deepEqual(browser.errors,[]);
  await writeFile(dir+'/result.json',JSON.stringify({passed:true,results},null,2));
  console.log('Verified all eight physical gift animations: anticipation, contact, travel, release; exact quantity, synced audio and pause.');
}finally{await browser.close();}
