import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {arrangeStudioPanels} from '../assets/studio-structure.js';

function setup(){
 const panels=Object.fromEntries(['games','audio','controls','streamer','stats','feed'].map(id=>[id,{id}]));
 const hosts={};let moves=0;
 for(const side of ['left','right'])hosts[side]={children:[],append(node){moves++;const old=node.parentElement;if(old)old.children.splice(old.children.indexOf(node),1);this.children.push(node);node.parentElement=this;}};
 for(const[side,ids]of Object.entries({left:['games','audio'],right:['controls','streamer','stats','feed']}))for(const id of ids)hosts[side].append(panels[id]);moves=0;
 return{hosts,panels,moves:()=>moves};
}
test('current HTML and both historical default configurations require zero panel moves',()=>{
 for(const layout of [
  {left:['games','audio'],right:['controls','streamer','stats','feed']},
  {left:['games','controls'],right:['streamer','audio','stats','feed']},
  {left:['games','audio','streamer'],right:['controls','stats','feed']}
 ]){
  const s=setup();arrangeStudioPanels(layout,s.hosts,s.panels);arrangeStudioPanels(layout,s.hosts,s.panels);assert.equal(s.moves(),0);
 }
});
test('custom administration layouts move original panels once and remain stable on refresh',()=>{
 const s=setup(),layout={left:['audio','streamer','games'],right:['stats','controls','feed']};
 arrangeStudioPanels(layout,s.hosts,s.panels);
 assert.deepEqual(s.hosts.left.children.map(n=>n.id),layout.left);
 assert.deepEqual(s.hosts.right.children.map(n=>n.id),layout.right);
 assert.equal(s.hosts.left.children[1],s.panels.streamer);
 const count=s.moves();arrangeStudioPanels(layout,s.hosts,s.panels);assert.equal(s.moves(),count);
});
test('Studio serves the current navigation, icons and controls directly in HTML',()=>{
 const html=readFileSync(new URL('../live-studio.html',import.meta.url),'utf8');
 const rail=html.slice(html.indexOf('<aside class="studio-app-rail"'),html.indexOf('</aside>',html.indexOf('<aside class="studio-app-rail"')));
 assert.equal((rail.match(/data-studio-tab=/g)||[]).length,3);
 assert.equal((rail.match(/class="studio-nav-icon/g)||[]).length,3);
 assert(rail.includes('PANOU DE SUNETE'));assert(rail.includes('sw-rail-footer'));
 assert(html.includes('id="creator-orientation"'));assert(html.includes('class="compact-connect-row"'));
 assert(!html.includes('id="tiktok-gifts-panel"'));
 const script=readFileSync(new URL('../assets/creator-platform.js',import.meta.url),'utf8');
 assert(!script.includes('root.innerHTML='));assert(!script.includes('creator-connection-host'));
});
