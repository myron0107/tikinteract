import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/studio-window-geometry.js';
const {resize}=globalThis.TikInteractWindowGeometry;
const bounds={left:0,top:0,right:1440,bottom:1000,minWidth:240,minHeight:150};
test('All four corners resize while preserving the opposite corner',()=>{
 const r={x:300,y:200,w:500,h:400};
 for(const corner of ['nw','ne','sw','se']){
  const next=resize(r,corner,corner.includes('w')?-70:70,corner.includes('n')?-50:50,bounds);
  assert.equal(next.w,570);assert.equal(next.h,450);
  if(corner.includes('w'))assert.equal(next.x+next.w,r.x+r.w);else assert.equal(next.x,r.x);
  if(corner.includes('n'))assert.equal(next.y+next.h,r.y+r.h);else assert.equal(next.y,r.y);
 }
});
test('Resizing reaches every viewport edge, including coordinate zero, without escaping it',()=>{
 const r={x:300,y:200,w:500,h:400};
 for(const corner of ['nw','ne','sw','se']){
  const next=resize(r,corner,corner.includes('w')?-10000:10000,corner.includes('n')?-10000:10000,bounds);
  assert(next.x>=0&&next.y>=0&&next.x+next.w<=1440&&next.y+next.h<=1000);
  if(corner.includes('w'))assert.equal(next.x,0);else assert.equal(next.x+next.w,1440);
  if(corner.includes('n'))assert.equal(next.y,0);else assert.equal(next.y+next.h,1000);
 }
});
test('Opposite edges remain anchored at minimum sizes and STREAM height caps',()=>{
 const r={x:300,y:200,w:500,h:400};
 for(const corner of ['nw','ne','sw','se']){
  const next=resize(r,corner,corner.includes('w')?10000:-10000,corner.includes('n')?10000:-10000,bounds);
  assert.equal(next.w,240);assert.equal(next.h,150);
  assert.equal(corner.includes('w')?next.x+next.w:next.x,corner.includes('w')?r.x+r.w:r.x);
  assert.equal(corner.includes('n')?next.y+next.h:next.y,corner.includes('n')?r.y+r.h:r.y);
 }
 const tall=resize(r,'se',0,10000,{...bounds,bottom:13800,maxHeight:1800});assert.equal(tall.h,1800);
});
