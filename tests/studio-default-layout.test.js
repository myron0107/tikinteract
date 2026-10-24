import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioDefaultLayout,DEFAULT_PRESET} from '../assets/studio-default-layout.js';
import {overlaps,normalizeLayout} from '../assets/studio-personalization-model.js';
test('DEFAULT matches the three-column reference without copying personal content',()=>{
 const layout=createStudioDefaultLayout(),panels=layout.desktop.filter(p=>!p.hidden),get=id=>panels.find(p=>p.id===id);
 assert.equal(layout.preset,DEFAULT_PRESET);assert.equal(panels.length,7);
 assert(get('games').x<get('preview').x);assert(get('preview').x<get('streamer').x);assert(get('audio').y>get('games').y);assert(get('animations').y>get('audio').y);assert(get('audience').y>get('preview').y);assert(get('controls').y>get('streamer').y);
 for(const [i,a]of panels.entries())for(const b of panels.slice(i+1))assert.equal(overlaps(a,b),false,`${a.id}/${b.id}`);
 assert.deepEqual(layout.favorites,{games:[],audio:[],animations:[]});assert.equal(normalizeLayout(layout,layout.desktop.map(p=>p.id)).preset,DEFAULT_PRESET);
});
test('DEFAULT keeps phone/tablet panels in bounds and stacks them for scrolling',()=>{
 for(const width of [320,390,700,768,1024,1366,1920]){
  const l=createStudioDefaultLayout({width,height:800,favorites:{games:['nova-vex'],audio:['applause'],animations:['my-video']}}),mode=width<=700?'mobile':'desktop',limit=mode==='mobile'?384:1280,panels=l[mode].filter(p=>!p.hidden);
  for(const p of panels){assert(p.x>=0&&p.x+p.w<=limit);assert(p.w>=120&&p.h>=96);}
  for(const [i,a]of panels.entries())for(const b of panels.slice(i+1))assert.equal(overlaps(a,b),false,`${width}: ${a.id}/${b.id}`);
  assert.deepEqual(l.favorites.animations,['my-video']);if(mode==='mobile')assert(Math.max(...panels.map(p=>p.y+p.h))>800);
 }
});
