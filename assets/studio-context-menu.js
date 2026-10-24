// Disable the browser context menu only inside Studio, including embedded games.
(()=>{
 if(document.body?.dataset.page!=='studio')return;
 const observed=new WeakSet();
 const disable=event=>event.preventDefault();
 function attach(doc){if(!doc||observed.has(doc))return;observed.add(doc);doc.addEventListener('contextmenu',disable,{capture:true});}
 function frameLoaded(frame){try{attach(frame.contentDocument);}catch{/* External frames keep their own browser permissions. */}}
 attach(document);
 document.querySelectorAll('iframe').forEach(frameLoaded);
 document.addEventListener('load',event=>{if(event.target instanceof HTMLIFrameElement)frameLoaded(event.target);},true);
})();
