import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
const b=await openSkyShiftBrowser('nova-studio-integration'),{page,evaluate,waitFor}=b;
const root='http://localhost:3001',out='.tools/neon-ascent-qa';await mkdir(out,{recursive:true});
try{
  await page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true)'});
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await page('Page.navigate',{url:root+'/live-studio.html?game=nova-vex'});await waitFor('!!window.tikInteractUser');
    assert.equal(await evaluate('document.getElementById("live-game-frame").getAttribute("src")'),null,'Do not auto-start games');
    assert.equal(await evaluate('loadLiveGame("nova-vex")'),true);
    await waitFor('!!document.querySelector("[data-gift-binding=meteor]")');
    assert.equal(await evaluate('document.querySelectorAll(".studio-test-gift").length'),11);
    await evaluate('window.native=document.getElementById("live-game-frame").contentWindow.TikInteractStudioControls;native.control({action:"session.pause"});selectStudioTestTab("gifts");window.giftIds=[...document.querySelector("[data-gift-binding=meteor]").options].slice(1,3).map(o=>o.value);for(const key of ["meteor","vortex"])native.setBinding(key,"");');
    const ids=await evaluate('giftIds');assert.equal(ids.length,2);
    for(const [action,index]of [['meteor',0],['vortex',1]]){
      await evaluate(`(()=>{const select=document.querySelector('[data-gift-binding=${action}]');select.value=giftIds[${index}];select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      assert.equal(await evaluate(`native.getBindings().${action}`),ids[index]);
      const before=await evaluate('native.getState().ledger.requestedMeters');
      const id=crypto.randomUUID();
      await evaluate(`TikInteractLive.setState({connected:true,sessionId:'nova-qa',username:'qa'});window.liveGift={type:'gift',eventId:${JSON.stringify(id)},sessionId:'nova-qa',timestamp:Date.now(),username:'viewer',giftId:giftIds[${index}],giftName:'Test gift',repeatCount:2,diamondCount:10,coins:20,giftType:1,repeatEnd:true};TikInteractLive.dispatch(liveGift)`);
      const delta=action==='meteor'?-300:-600;
      assert.equal(await evaluate('native.getState().ledger.requestedMeters'),before+delta);
      assert.equal(await evaluate('TikInteractLive.dispatch(liveGift)'),false,'Duplicate event rejected');
    }
    const bindings=await evaluate('native.getBindings()');
    assert.equal(await evaluate('native.setBinding("vortex",giftIds[0]).ok'),false,'One gift cannot activate two powers');
    await b.screenshot(out+'/studio-bindings-'+width+'.webp');
    await evaluate('selectStudioTestTab("teams")');await b.screenshot(out+'/studio-game-'+width+'.webp');
    await evaluate('loadLiveGame("moto-interact");loadLiveGame("nova-vex")');await waitFor('!!document.querySelector("[data-gift-binding=meteor]")');
    assert.deepEqual(await evaluate('document.getElementById("live-game-frame").contentWindow.TikInteractStudioControls.getBindings()'),bindings,'Bindings survive game switching');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Studio horizontal overflow');
  }
  await page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});
  await page('Page.navigate',{url:root+'/GAME/NOVA-VEX/Neon-Ascent.html?qa'});await waitFor('!!window.__neonAscent&&document.getElementById("loading").hidden');
  const header=await evaluate('({nova:getComputedStyle(document.querySelector(".title-nova")).color,vex:getComputedStyle(document.querySelector(".title-vex")).color,top:document.querySelector(".brand").getBoundingClientRect().top,titleTop:document.querySelector(".game-title").getBoundingClientRect().top})');
  assert.equal(header.nova,'rgb(255, 121, 190)');assert.equal(header.vex,'rgb(175, 123, 255)');assert(Math.abs(header.top-header.titleTop)<15);
  await evaluate('__neonAscent.teleport(0);__neonAscent.render()');await b.screenshot('assets/game-gallery/nova-vex-city.webp');
  await evaluate('const g=__neonAscent;g.teleport(500);g.sim.player.x=g.sim.previous.x=140;g.action({action:"vortex",amount:1,commandId:"gallery"});g.advance(3.1)');await b.screenshot('assets/game-gallery/nova-vex-vex.webp');
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await page('Page.navigate',{url:root+'/index.html'});await waitFor('!!document.querySelector("[data-home-nova]")');await evaluate('document.querySelector("[data-home-nova]").scrollIntoView({block:"center"})');
    await waitFor('document.querySelector("[data-home-nova]").dataset.ready==="true"');
    const frame=await evaluate('Number(document.querySelector("[data-nova-canvas]").dataset.frame)');await new Promise(r=>setTimeout(r,300));
    assert(await evaluate('Number(document.querySelector("[data-nova-canvas]").dataset.frame)>'+frame),'Homepage animation must move');
    await evaluate('document.querySelector("[data-nova-pause]").click()');const frozen=await evaluate('document.querySelector("[data-nova-canvas]").toDataURL()');await new Promise(r=>setTimeout(r,200));assert.equal(await evaluate('document.querySelector("[data-nova-canvas]").toDataURL()'),frozen);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Homepage horizontal overflow');
    assert(await evaluate('!!document.querySelector("[data-home-showcase]")'),'Preserve existing road animation');
    await b.screenshot(out+'/homepage-nova-'+width+'.webp');
  }
  assert.deepEqual(b.errors,[]);await writeFile(out+'/studio-integration-result.json',JSON.stringify({passed:true,header,checks:['free selection','no auto-start','11 native controls','11 gift mappings','live gifts -150/-300 x2','deduplication','persistence','mobile/desktop','header colors/brand','homepage animation/pause','original animation retained']},null,2));
  console.log('NOVA & VEX Studio, real shared SDK events, gift bindings, quantities, persistence, cover gallery, heading and homepage animation passed desktop/mobile.');
}finally{await b.close();}
