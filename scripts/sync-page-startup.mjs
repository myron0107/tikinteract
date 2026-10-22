// Build-time/source sync only: the loading screen exists in the served HTML.
import {readFile,writeFile,readdir} from 'node:fs/promises';
const partial=(await readFile('partials/page-startup.html','utf8')).trim();
const paths=(await readdir('.')).filter(p=>p.endsWith('.html'));
for(const entry of await readdir('GAME',{withFileTypes:true}))if(entry.isDirectory())paths.push(`GAME/${entry.name}/index.html`);
let count=0;
for(const path of paths){
 let html;try{html=await readFile(path,'utf8');}catch{continue;}
 if(!html.includes('assets/page-startup.js'))continue;
 const root=path.startsWith('GAME/')?'../../':'',brand=path==='live-studio.html'?'studio':'site';
 const markup=partial.replaceAll('{{ROOT}}',root);
 html=html.replace(/<html\b([^>]*)>/,(_,attrs)=>`<html${attrs.replace(/\sdata-loading-brand="[^"]*"/,'')} data-loading-brand="${brand}">`);
 const existing=html.indexOf('<div id="page-startup-screen"');
 if(existing!==-1){const end=html.indexOf('<!-- /page-startup-screen -->',existing);if(end===-1)throw Error('Missing loader end marker: '+path);html=html.slice(0,existing)+markup+'\n<!-- /page-startup-screen -->'+html.slice(end+'<!-- /page-startup-screen -->'.length);}
 else html=html.replace(/<body\b[^>]*>/,match=>match+'\n'+markup+'\n<!-- /page-startup-screen -->');
 html=html.replaceAll('page-startup.css?v=1','page-startup.css?v=2');
 await writeFile(path,html,'utf8');count++;
}
console.log(`Synchronized ${count} native loading screens.`);
