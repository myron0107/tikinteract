import {localizeText} from './language-copy.js?v=6';

const preferenceKey='tikinteract_language';
const texts=new WeakMap(),attributes=new WeakMap();
const attributeNames=['title','placeholder','aria-label','aria-valuetext','alt'];
const ignored='script,style,code,pre,textarea,[contenteditable="true"],[translate="no"],#header-account-name,#account-display-name,#account-avatar-display,#tiktok-profile-name,.leaderboard-avatar,.header-account-avatar,a[href^="https://www.tiktok.com/@"]:not(.stream-tiktok-btn),.support-message-body,.support-message-text,.support-message-content,.audio-sound-card h4,.team-rankings li b,[data-native-i18n],.au-identity-name,.si-ticket>strong,.si-ticket-preview,.si-thread-heading h3,.si-message>p,.si-message header>strong,.gift-card h3,.gift-recent-info>strong,.gifts-stat:last-child>strong,[data-gifts-featured] h3,.home-gift-catalog-grid h3,.home-gifts-pick>span,.stream-creator-name,.stream-creator-handle';
let language='ro',queued=false;
try{if(localStorage.getItem(preferenceKey)==='en')language='en';}catch{}
const requestedLanguage=new URLSearchParams(location.search).get('lang');
if(['ro','en'].includes(requestedLanguage))language=requestedLanguage;

function translate(value){return localizeText(value,'en');}

function targetValue(state,current){
    if(!state || (current!==state.ro && current!==state.en))state={ro:localizeText(current,'ro'),en:translate(current)};
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
    const elements=[...(root instanceof Element?[root]:[]),...root.querySelectorAll('[title],[placeholder],[aria-label],[aria-valuetext],[alt]')];
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
    document.querySelectorAll('[data-language-flag]').forEach(image=>{image.src=new URL(`./language-${language}.svg`,import.meta.url).href;});
    document.querySelector('.language-trigger')?.setAttribute('aria-label',language==='en'?'Choose language: English':'Alege limba: Română');
    document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-checked',String(button.dataset.language===language)));
    apply();
    const title=document.querySelector('title');if(title){const nextTitle=targetValue(texts.get(title),title.textContent);texts.set(title,nextTitle.state);title.textContent=nextTitle.value;}
    window.dispatchEvent(new CustomEvent('tikinteract:language',{detail:{language}}));
    document.querySelectorAll('iframe').forEach(frame=>{try{if(new URL(frame.src,location.href).origin===location.origin)frame.contentWindow?.postMessage({type:'tikinteract:language',language},location.origin);}catch{}});
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
        picker.addEventListener('focusout',event=>{
            // During native pointer focus changes, activeElement can briefly be
            // BODY. Keep the menu open when focus moves to one of its options.
            if(event.relatedTarget instanceof Node && picker.contains(event.relatedTarget))return;
            requestAnimationFrame(()=>{if(!picker.contains(document.activeElement))close();});
        });
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
    window.TikInteractStartup?.ready('language');
}

window.addEventListener('message',event=>{if(parent!==window && event.source===parent && event.origin===location.origin && event.data?.type==='tikinteract:language' && ['ro','en'].includes(event.data.language))choose(event.data.language,{persist:false});});
window.addEventListener('resize',close);
window.addEventListener('storage',event=>{if(event.key===preferenceKey)choose(event.newValue==='en'?'en':'ro',{persist:false});});
window.TikInteractLanguage=Object.freeze({get:()=>language,set:choose,close,locale:()=>language==='en'?'en-GB':'ro-RO',translate:value=>localizeText(value,language)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
