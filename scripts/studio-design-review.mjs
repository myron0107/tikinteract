// Optional visual/interaction audit, invoked only by the isolated Studio fixture.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
export async function reviewStudioDesign({b,run,click}){
 const folder='.tools/studio-design-review';await mkdir(folder,{recursive:true});
 const shot=async name=>{await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');assert(await run('document.documentElement.scrollWidth<=innerWidth+1'),'Page overflow: '+name);await b.screenshot(folder+'/'+name+'.webp');};
 await run('TikInteractWorkspaces.open("live",{tab:"home"})');await shot('00-studio-home');
 await run('TikInteractAppearance.set({mode:"dark"});TikInteractWorkspaces.open("live")');await shot('01-live');
 await click('[data-studio-inspector=audience]');assert(await run('getComputedStyle(document.getElementById("studio-test-panel")).display==="none"'));await shot('01-live-audience');await click('[data-studio-inspector=game]');
 for(const dock of ['games','audio','animations']){await click('[data-design-dock='+dock+']');assert.equal(await run('document.documentElement.dataset.studioDock'),dock);}
 await click('[data-design-dock=games]');
 for(const [tab,name] of [['games','02-games'],['audio','03-sound-pad'],['animations','04-live-animations']]){await click('.studio-app-nav [data-studio-tab='+tab+']');await shot(name);}
 await click('[data-design-palette-toggle]');assert(await run('!document.querySelector("[data-design-palette-panel]").hidden'));
 assert(await run('Array.from(document.querySelectorAll("[data-design-skin]")).every(n=>n.getBoundingClientRect().width>65&&n.getBoundingClientRect().height>=90)'),'Palette previews must not inherit the legacy 16px swatch size');
 await run('document.documentElement.dataset.workspace="live";new Promise(requestAnimationFrame)');assert(await run('!document.querySelector("[data-design-palette-panel]").hidden'),'Refreshing the same workspace must keep the chooser open');
 await click('[data-design-skin=racing]');assert.equal(await run('TikInteractStudioDesign.get().skin'),'racing');assert(await run('!document.querySelector("[data-design-palette-panel]").hidden'),'Choosing a skin must not be treated as an outside click');await shot('05-live-palette');await click('[data-design-palette-toggle]');
 await run('TikInteractWorkspaces.open("ai",{tab:"generator"})');await b.waitFor('!!document.getElementById("an-prompt")');
 for(const [tab,name] of [['generator','06-ai-generator'],['universes','07-ai-universes'],['library','08-ai-library'],['credits','09-ai-credits'],['guide','10-ai-guide']]){await click('[data-ai-tab='+tab+']');await shot(name);}
 for(const [view,section,name]of [['account','profile','11-profile'],['account','preferences','12-preferences'],['account','security','13-security'],['subscription','','14-subscription'],['analytics','','15-analytics'],['support','','16-support'],['help','','17-guide'],['community','','18-community']]){
  await run(`TikInteractStudioWindows.open('${view}',{section:'${section}'})`);await b.waitFor('document.querySelector("#studio-user-dialog").open&&!document.querySelector("[data-sw-content]").hasAttribute("aria-busy")');await shot(name);await run('TikInteractStudioWindows.close({focus:false})');
 }
 const choices={live:['ice','signal','racing'],ai:['lumen','orbit','aurora']};
 for(const width of [1440,390,320])for(const mode of ['dark','light'])for(const [workspace,skins]of Object.entries(choices)){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
  await run(`TikInteractAppearance.set({mode:'${mode}'});TikInteractWorkspaces.open('${workspace}',{tab:'${workspace==='ai'?'generator':'studio'}'})`);
  for(const skin of skins){await run(`TikInteractStudioDesign.setSkin('${skin}')`);assert.equal(await run('document.documentElement.dataset.studioSkin'),skin);await shot(`${workspace}-${width}-${mode}-${skin}`);}
 }
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await run('TikInteractAppearance.set({mode:"dark"});TikInteractStudioDesign.setSkin("lumen");TikInteractWorkspaces.open("live");TikInteractStudioDesign.setSkin("ice")');
 await click('[data-design-palette-toggle]');await b.page('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});assert(await run('document.querySelector("[data-design-palette-panel]").hidden'));assert(await run('document.activeElement.matches("[data-design-palette-toggle]")'));
 await b.page('Page.reload');await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!document.querySelector("[data-sle=edit]").disabled');assert.equal(await run('TikInteractStudioDesign.get().skin'),'ice');await run('TikInteractWorkspaces.open("ai")');assert.equal(await run('TikInteractStudioDesign.get().skin'),'lumen');await run('TikInteractWorkspaces.open("live")');
 console.log('Studio design review: every route/dialog, six saved workspace palettes, Light/Dark, 1440/390/320px and keyboard dismissal passed.');
}
