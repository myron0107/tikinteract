// Fixed popovers follow their own button while the utilities bar moves.
(()=>{
 const entries=[['#studio-account-avatar','#studio-profile-dropdown'],['.language-trigger','#language-menu'],['#creator-inbox-bell','#studio-notifications-panel'],['[data-design-palette-toggle]','[data-design-palette-panel]']];
 const observed=new WeakSet();let frame=0,observer,bar;
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
 function sync(){
  frame=0;
  for(const [buttonSelector,panelSelector]of entries){
   const button=document.querySelector(buttonSelector),panel=document.querySelector(panelSelector);if(!button||!panel||panel.hidden)continue;
   if(!button.getClientRects().length){panel.hidden=true;button.setAttribute('aria-expanded','false');continue;}
   if(!observed.has(panel)){observed.add(panel);observer.observe(panel);}
   const put=(key,value)=>panel.style.setProperty(key,value,'important');
   put('position','fixed');put('right','auto');put('bottom','auto');put('margin','0');put('transform','none');put('max-width',Math.max(160,innerWidth-16)+'px');put('max-height',Math.max(80,innerHeight-16)+'px');put('overflow-y','auto');
   const anchor=button.getBoundingClientRect(),rail=bar.getBoundingClientRect(),size=panel.getBoundingClientRect(),below=Math.max(0,innerHeight-rail.bottom-16),above=Math.max(0,rail.top-16);
   const preferredHeight=panelSelector==='#language-menu'?120:220;
   const under=below>=preferredHeight||below>=above,available=under?below:above,height=Math.min(size.height,available);
   const x=Math.max(8,Math.min(anchor.left+anchor.width/2-size.width/2,innerWidth-size.width-8)),y=under?rail.bottom+8:Math.max(8,rail.top-height-8);
   put('left',x+'px');put('top',y+'px');put('max-height',Math.max(40,available)+'px');panel.dataset.popoverSide=under?'below':'above';
  }
 }
 function init(){
  bar=document.getElementById('studio-dock-utilities');if(!bar)return;
  observer=new ResizeObserver(schedule);observer.observe(bar);
  new MutationObserver(schedule).observe(bar,{attributes:true,subtree:true,attributeFilter:['hidden','aria-expanded']});
  new MutationObserver(schedule).observe(bar,{attributes:true,attributeFilter:['style']});
  document.addEventListener('click',event=>{const chosen=entries.find(([selector])=>event.target.closest(selector));if(chosen)for(const [selector,panelSelector]of entries){if(selector===chosen[0])continue;const panel=document.querySelector(panelSelector);if(panel)panel.hidden=true;document.querySelector(selector)?.setAttribute('aria-expanded','false');}schedule();},true);window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,{passive:true,capture:true});schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
