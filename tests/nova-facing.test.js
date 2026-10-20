import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../GAME/NOVA-VEX/src/simulation.js';
import {Renderer} from '../GAME/NOVA-VEX/src/render.js';

function renderedFacing(sim,language,gift={sx:1,sy:1,alpha:1}){
 const stack=[],draws=[];let scaleX=1;
 const ctx={save(){stack.push(scaleX);},restore(){scaleX=stack.pop();},translate(){},rotate(){},scale(x){scaleX*=x;},globalAlpha:1};
 const renderer={ctx,language,sprites:Object.fromEntries(['idle','rise','fall','land'].map(pose=>[pose,{w:90,h:100}])),scoreMoment:null,giftFX:{hero:()=>gift},sprite(pose){draws.push({pose,scaleX});}};
 Renderer.prototype.character.call(renderer,sim,sim.player.x,100);
 assert.equal(draws.length,1);assert.equal(scaleX,1,'Drawing restores the canvas transform');return draws[0].scaleX;
}

for(const language of ['ro','en'])test(`Nova faces left/right during movement and keeps her last direction at rest (${language})`,()=>{
 const sim=new Simulation({autoplay:false});
 for(const [left,right,direction]of [[true,false,-1],[false,true,1],[true,false,-1]]){
  sim.input.left=left;sim.input.right=right;sim.step();
  assert.equal(sim.player.facing,direction);
  for(const vy of [-100,0,100]){sim.player.vy=vy;sim.player.squash=0;assert.equal(renderedFacing(sim,language),direction);}
  sim.releaseInput();sim.step();assert.equal(renderedFacing(sim,language),direction,'Stopping preserves the last facing');
 }
});

test('Vex gift choreography overrides walking orientation instead of flipping twice',()=>{
 const sim=new Simulation({autoplay:false});sim.player.facing=-1;
 assert.equal(renderedFacing(sim,'ro',{sx:1,sy:1,alpha:1,flip:1}),1);
 assert.equal(renderedFacing(sim,'en',{sx:1,sy:1,alpha:1,flip:-1}),-1);
 assert.equal(renderedFacing(sim,'en'),-1,'Walking orientation returns after the gift');
});
