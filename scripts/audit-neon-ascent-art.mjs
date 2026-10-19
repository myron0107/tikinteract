import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {World} from '../GAME/NEON-ASCENT/src/world.js';
import {NEON_GIFTS} from '../GAME/NEON-ASCENT/src/gift-definitions.js';

const root='GAME/NEON-ASCENT',read=file=>JSON.parse(fs.readFileSync(root+'/'+file,'utf8'));
const art=JSON.parse(fs.readFileSync(root+'/art/manifest.js','utf8').replace(/^window.__NEON_ASCENT_ASSETS=/,'').replace(/;\s*$/,''));
const generated=read('art/generated-manifest.json'),zones=read('art/zones.json'),actions=read(art.actionMetadata);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex');
const unique=new Set(),world=new World();
const samples={abyss:-1200,crystal:-700,lava:-200,earth:0,grass:150,clouds:500,space:1100,cosmos:2200};
assert.equal(zones.length,8);
for(const zone of zones){
  assert.equal(art.backgrounds[zone.id],zone.file);assert.equal(world.biome(samples[zone.id]),zone.id);
  if(zone.min!==null)assert.equal(world.biome(zone.min),zone.id);
  if(zone.maxExclusive!==null)assert.equal(world.biome(zone.maxExclusive-1e-5),zone.id);
  const digest=hash(zone.file);assert(!unique.has(digest),'A zone reuses another zone image');unique.add(digest);
}
assert.equal(unique.size,8);
assert(!art.anvil&&!art.meteor,'Retired gift objects must not load');
const images=[art.atlas,art.rival,art.board,art.actions,art.blast,art.reactions,art.vexActions,art.interactions,...Object.values(art.backgrounds)];
const audit=images.map(file=>{
  const name=path.basename(file,'.webp'),entry=generated.find(item=>item.name===name);
  assert(entry,'Missing generated-art provenance for '+file);
  const source='art/source/'+entry.source;assert(fs.existsSync(root+'/'+source),'Missing generated PNG master');
  const bytes=fs.readFileSync(root+'/'+file);assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  return{file,sha256:hash(file),source,sourceSha256:hash(source),generator:'OpenAI built-in imagegen',transparentRatio:entry.transparentRatio};
});
const vexActions=read(art.vexMetadata);
const interactions=read(art.interactionMetadata),sceneIcons={vexCarry:'rideHold',vexShove:'pushTouch'};
for(const gift of Object.values(NEON_GIFTS))assert(actions.sprites[gift.sprite]||interactions.sprites[sceneIcons[gift.sprite]],'Missing generated gift sprite: '+gift.sprite);
for(const pose of ['pushTouch','pushExtend','rideCatch','rideHold']){
  const s=interactions.sprites[pose];assert(s?.sheet==='interaction'&&s.novaFeet&&s.vexFeet,'Missing paired contact pose: '+pose);
  for(const point of [s.novaFeet,s.vexFeet])assert(point.u>0&&point.u<1&&point.v>0&&point.v<=1,'Invalid feet anchor: '+pose);
}
for(const pose of ['vexThrow','vexPush','vexPull','vexDive'])assert(vexActions.poses[pose]?.w>0&&vexActions.poses[pose].sheet==='vexAction','Missing Vex action pose: '+pose);
const reactions=read(art.reactionMetadata);
for(const name of ['reactStart','reactPull','reactRecover'])assert(reactions.sprites[name]?.w>0&&reactions.sprites[name]?.h>0&&reactions.sprites[name].sheet==='reaction','Missing main-character reaction: '+name);
assert.equal(Object.keys(NEON_GIFTS).length,11);
const result={passed:true,zones,gifts:Object.fromEntries(Object.entries(NEON_GIFTS).map(([key,gift])=>[key,{name:gift.name,sprite:gift.sprite}])),images:audit};
fs.writeFileSync(root+'/art/image-audit.json',JSON.stringify(result,null,2)+'\n');
console.log('Verified 8 unique generated zone images, 11 generated gift icons, and source PNG provenance for all '+audit.length+' runtime art files.');
