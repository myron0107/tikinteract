import './language.js?v=4';
export const gameText=value=>window.TikInteractLanguage?.translate(value)??value;
export const gameLocale=()=>window.TikInteractLanguage?.locale()||'ro-RO';
export function onGameLanguageChange(callback){window.addEventListener('tikinteract:language',callback);}
