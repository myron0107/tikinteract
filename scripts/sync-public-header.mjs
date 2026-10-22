// Update the static headers from one source. No runtime replacement, framework
// or public build service is required to serve these native HTML pages.
import {readFile,writeFile,readdir} from 'node:fs/promises';
const template=(await readFile('partials/public-header.html','utf8')).trim();
const pages=['index.html','about.html','guide.html','privacy-policy.html','terms-of-use.html','updates.html','404.html'];
for(const entry of await readdir('GAME',{withFileTypes:true}))if(entry.isDirectory()){
 const path=`GAME/${entry.name}/index.html`;
 try{if(/game-page-brand|game-presentation/.test(await readFile(path,'utf8')))pages.push(path);}catch{}
}
for(const path of pages){
 let html=await readFile(path,'utf8');const root=path.startsWith('GAME/')?'../../':'';
 const header=template.replaceAll('{{ROOT}}',root);
 const old=html.match(/<header\b[^>]*class="[^"]*(?:template-header|public-info-site-header|error-header)[^"]*"[^>]*>[\s\S]*?<\/header>/);
 if(old)html=html.replace(old[0],header);
 else{
  html=html.replace(/<nav\b[^>]*class="[^"]*game-page-nav[^"]*"[^>]*>[\s\S]*?<\/nav>/,'');
  html=html.replace(/<body\b[^>]*>/,match=>match+'\n'+header);
 }
 html=html.replace(/<body\b([^>]*)>/,(_,attrs)=>'<body'+(attrs.includes('class=')?attrs.replace(/class="([^"]*)"/,(_,v)=>`class="${v.includes('has-public-header')?v:v+' has-public-header'}"`):attrs+' class="has-public-header"')+'>');
 if(path.startsWith('GAME/')&&!html.includes('game-presentation-back')){
  const back=`<a class="game-page-back game-presentation-back" href="${root}index.html?view=catalog"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m8 5-5 5 5 5m-5-5h14" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Înapoi la jocuri</span></a>`;
  html=html.replace(/<main\b[^>]*class="[^"]*game-presentation[^"]*"[^>]*>/,match=>match+'\n'+back);
 }
 for(const [file,type]of [['public-header.css','style'],['ui-controls.css','style'],['public-header.js','script']]){
  const version=type==='style'?3:1;
  if(!html.includes('assets/'+file))html=html.replace('</head>',type==='style'?`<link rel="stylesheet" href="${root}assets/${file}?v=${version}"></head>`:`<script defer src="${root}assets/${file}?v=${version}"></script></head>`);
 }
 if(!html.includes('assets/page-startup.js')){
  const early=`<link rel="stylesheet" href="${root}assets/page-startup.css?v=1"><script src="${root}assets/page-startup.js?v=1"></script>`;
  html=html.replace(/<meta\b[^>]*name="viewport"[^>]*>/,match=>match+early);
 }
 if(!html.includes('font-awesome/'))html=html.replace('</head>','<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"></head>');
 await writeFile(path,html,'utf8');
}
console.log(`Synchronized ${pages.length} static public headers.`);
