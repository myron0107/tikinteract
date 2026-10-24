/* Shared geometry for Studio page windows and STREAM canvas panels. */
(()=>{
 const clamp=(value,min,max)=>Math.max(min,Math.min(value,Math.max(min,max)));
 function resize(rect,corner,dx,dy,bounds){
  const minW=Math.min(bounds.minWidth||160,bounds.right-bounds.left),minH=Math.min(bounds.minHeight||96,bounds.bottom-bounds.top);
  const maxW=bounds.maxWidth||bounds.right-bounds.left,maxH=bounds.maxHeight||bounds.bottom-bounds.top;
  let left=rect.x,top=rect.y,right=rect.x+rect.w,bottom=rect.y+rect.h;
  if(corner.includes('w'))left=clamp(left+dx,Math.max(bounds.left,right-maxW),right-minW);
  else right=clamp(right+dx,left+minW,Math.min(bounds.right,left+maxW));
  if(corner.includes('n'))top=clamp(top+dy,Math.max(bounds.top,bottom-maxH),bottom-minH);
  else bottom=clamp(bottom+dy,top+minH,Math.min(bounds.bottom,top+maxH));
  return{x:left,y:top,w:right-left,h:bottom-top};
 }
 globalThis.TikInteractWindowGeometry=Object.freeze({resize});
})();
