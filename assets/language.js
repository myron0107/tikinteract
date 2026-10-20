import {english} from './language-en.js?v=1';

const preferenceKey='tikinteract_language';
const texts=new WeakMap(),attributes=new WeakMap();
const attributeNames=['title','placeholder','aria-label','alt'];
const ignored='script,style,code,pre,textarea,[contenteditable="true"],[translate="no"],#header-account-name,#account-display-name,#account-avatar-display,#tiktok-profile-name,.leaderboard-avatar,.header-account-avatar,a[href^="https://www.tiktok.com/@"],.support-message-body,.support-message-text,.support-message-content,.audio-sound-card h4';
let language='ro',queued=false;
try{if(localStorage.getItem(preferenceKey)==='en')language='en';}catch{}

function translate(value){
    const trimmed=value.trim(),key=trimmed.replace(/\s+/g,' ');
    let result=english[key];
    if(result===undefined){
        const patterns=[
            [/^(\d[\d., ]*) monede$/,m=>`${m[1]} coins`],
            [/^Top (\d+) · Clasament all-time$/,m=>`Top ${m[1]} · All-time leaderboard`],
            [/^Locul (\d+)(.*)$/,m=>`Rank ${m[1]}${m[2]}`],
            [/^Deschide profilul TikTok (.+)$/,m=>`Open TikTok profile ${m[1]}`],
            [/^Colecția de cadouri a lui (.+)$/,m=>`Gift collection for ${m[1]}`],
            [/^Meniu cont: (.+)$/,m=>`Account menu: ${m[1]}`],
            [/^Actualizat la (.+)$/,m=>`Updated at ${m[1]}`],
            [/^Top (\d+) streameri$/,m=>`Top ${m[1]} creators`],
            [/^(\d+) streameri activi$/,m=>`${m[1]} active creators`],
            [/^Deschide în Studio: (.+)$/,m=>`Open in Studio: ${m[1]}`],
            [/^Adaugă la favorite: (.+)$/,m=>`Add to favorites: ${m[1]}`],
            [/^Elimină din favorite: (.+)$/,m=>`Remove from favorites: ${m[1]}`]
        ];
        for(const [pattern,format] of patterns){const match=key.match(pattern);if(match){result=format(match);break;}}
    }
    if(result===undefined)return value;
    return value.slice(0,value.indexOf(trimmed))+result+value.slice(value.indexOf(trimmed)+trimmed.length);
}

function targetValue(state,current){
    if(!state || (current!==state.ro && current!==state.en))state={ro:current,en:translate(current)};
    return {state,value:language==='en'?state.en:state.ro};
}

function apply(root=document.body){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
        if(!node.nodeValue.trim() || node.parentElement?.closest(ignored))continue;
        const next=targetValue(texts.get(node),node.nodeValue);texts.set(node,next.state);
        if(node.nodeValue!==next.value)node.nodeValue=next.value;
    }
    const elements=[...(root instanceof Element?[root]:[]),...root.querySelectorAll('[title],[placeholder],[aria-label],[alt]')];
    for(const element of elements){
        if(element.closest(ignored))continue;
        const saved=attributes.get(element)||new Map();attributes.set(element,saved);
        for(const attr of attributeNames){
            const current=element.getAttribute(attr);if(!current)continue;
            const next=targetValue(saved.get(attr),current);saved.set(attr,next.state);
            if(current!==next.value)element.setAttribute(attr,next.value);
        }
    }
}

function close(){
    const menu=document.getElementById('language-menu');if(menu)menu.hidden=true;
    document.querySelector('.language-trigger')?.setAttribute('aria-expanded','false');
}

function choose(next,{persist=true}={}){
    if(!['ro','en'].includes(next))return;
    language=next;document.documentElement.lang=language;
    if(persist){try{localStorage.setItem(preferenceKey,language);}catch{}}
    document.querySelectorAll('[data-language-label]').forEach(node=>{node.textContent=language.toUpperCase();});
    document.querySelectorAll('[data-language-flag]').forEach(image=>{image.src=`assets/language-${language}.svg`;});
    document.querySelector('.language-trigger')?.setAttribute('aria-label',language==='en'?'Choose language: English':'Alege limba: Română');
    document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-checked',String(button.dataset.language===language)));
    apply();
    const title=document.querySelector('title');if(title){const nextTitle=targetValue(texts.get(title),title.textContent);texts.set(title,nextTitle.state);title.textContent=nextTitle.value;}
    window.dispatchEvent(new CustomEvent('tikinteract:language',{detail:{language}}));
}

function initialize(){
    const picker=document.querySelector('.language-picker'),trigger=picker?.querySelector('.language-trigger'),menu=picker?.querySelector('.language-menu');
    if(trigger&&menu){
        const open=()=>{
            window.closeAccountMenu?.();window.setGetAppMenu?.(false);
            menu.hidden=false;trigger.setAttribute('aria-expanded','true');
            menu.style.left='';menu.style.right='';
            const bounds=menu.getBoundingClientRect(),parent=picker.getBoundingClientRect();
            if(bounds.left<8){menu.style.left=`${8-parent.left}px`;menu.style.right='auto';}
            else if(bounds.right>innerWidth-8){menu.style.left=`${innerWidth-8-bounds.width-parent.left}px`;menu.style.right='auto';}
        };
        trigger.addEventListener('click',()=>{if(menu.hidden)open();else close();});
        picker.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{choose(button.dataset.language);close();trigger.focus();}));
        picker.addEventListener('keydown',event=>{
            const items=[...menu.querySelectorAll('[data-language]')];
            if(['Enter',' '].includes(event.key) && event.target.matches('[data-language]')){
                event.preventDefault();event.target.click();return;
            }
            if(event.key==='Escape'){event.preventDefault();close();trigger.focus();}
            if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
                event.preventDefault();open();const index=items.indexOf(document.activeElement);
                const next=event.key==='Home'?0:event.key==='End'?items.length-1:index<0?(event.key==='ArrowDown'?0:items.length-1):(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
                items[next]?.focus();
            }
        });
        picker.addEventListener('focusout',()=>queueMicrotask(()=>{if(!picker.contains(document.activeElement))close();}));
        document.addEventListener('click',event=>{if(!picker.contains(event.target))close();});
    }
    choose(language,{persist:false});
    const dirty=new Set();
    new MutationObserver(records=>{
        for(const record of records){
            const element=record.target instanceof Element?record.target:record.target.parentElement;
            if(element && !element.closest(ignored))dirty.add(element);
        }
        if(!dirty.size)return;
        if(queued)return;queued=true;
        requestAnimationFrame(()=>{
            queued=false;const roots=[...dirty].filter(element=>element.isConnected);dirty.clear();
            if(roots.length>60){apply();return;}
            roots.filter(element=>!roots.some(parent=>parent!==element && parent.contains(element))).forEach(element=>apply(element));
        });
    }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributeNames});
}

window.addEventListener('resize',close);
window.addEventListener('storage',event=>{if(event.key===preferenceKey)choose(event.newValue==='en'?'en':'ro',{persist:false});});
window.TikInteractLanguage=Object.freeze({get:()=>language,set:choose,close,translate:value=>language==='en'?translate(value):value});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
