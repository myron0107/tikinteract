// Switch the viewport without replacing the game or its live session.
const allowed = new Set(['portrait','landscape']);
let format = new URLSearchParams(location.search).get('format') === 'landscape' ? 'landscape' : 'portrait';
export const gameFormat = () => format;
export const gameSize = () => format === 'landscape' ? {width:960,height:540} : {width:540,height:960};
function apply(next) {
    if (!allowed.has(next)) return;
    format = next;
    document.documentElement.dataset.gameFormat = format;
    window.dispatchEvent(new CustomEvent('tikinteract:game-format',{detail:{format,...gameSize()}}));
    window.dispatchEvent(new Event('resize'));
}
window.addEventListener('message',event => {
    if (parent !== window && event.source === parent && event.origin === location.origin && event.data?.type === 'tikinteract:format') apply(event.data.format);
});
const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('./game-format.css?v=1',import.meta.url).href;
document.head.append(stylesheet);
document.documentElement.dataset.gameFormat = format;
window.TikInteractGameFormat = Object.freeze({get:gameFormat,size:gameSize,set:next=>{if(parent===window)apply(next);}});
