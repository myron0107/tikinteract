import {english} from './language-en.js?v=2';
import {romanian} from './language-ro.js?v=1';
import {extraEnglish} from './language-extra.js?v=1';
import {studioEnglish} from './language-studio.js?v=1';
import {adminEnglish} from './language-admin.js?v=1';
import {runtimeEnglish} from './language-runtime.js?v=1';

export const englishCopy={...Object.fromEntries(Object.entries(romanian).filter(([en,ro])=>en!==ro).map(([en,ro])=>[ro,en])),...english,...extraEnglish,...studioEnglish,...adminEnglish,...runtimeEnglish};
const roPatterns=[
    [/^TEAM (RED|BLUE) (?:WINS|CÂȘTIGĂ)$/,m=>`ECHIPA ${m[1]} CÂȘTIGĂ`],
    [/^TEAM (RED|BLUE)$/,m=>`ECHIPA ${m[1]}`],
    [/^RESULT \/ RUN (\d+)$/,m=>`REZULTAT / RUNDĂ ${m[1]}`],
    [/^REZULTAT \/ RUN (\d+)$/,m=>`REZULTAT / RUNDĂ ${m[1]}`],
    [/^(.+) — by TikInteract$/,m=>`${m[1]} — de TikInteract`],
    [/^(.+) — joc LIVE$/,m=>`${m[1]} — joc LIVE`]
];
const enPatterns=[
    [/^(\d[\d., ]*) monede$/,m=>`${m[1]} coins`],
    [/^(\d[\d., ]*) punct(e)?$/,m=>`${m[1]} points`],
    [/^Top (\d+) · Clasament all-time$/,m=>`Top ${m[1]} · All-time leaderboard`],
    [/^Locul (\d+)(.*)$/,m=>`Rank ${m[1]}${m[2]}`],
    [/^Deschide profilul TikTok (.+)$/,m=>`Open TikTok profile ${m[1]}`],
    [/^Colecția de cadouri a lui (.+)$/,m=>`Gift collection for ${m[1]}`],
    [/^Meniu cont: (.+)$/,m=>`Account menu: ${m[1]}`],
    [/^Actualizat la (.+)$/,m=>`Updated at ${m[1]}`],
    [/^Top (\d+) streameri$/,m=>`Top ${m[1]} creators`],
    [/^(\d+) streamer(i)? activ(i)?$/,m=>`${m[1]} active ${m[2]?'creators':'creator'}`],
    [/^Deschide în Studio: (.+)$/,m=>`Open in Studio: ${m[1]}`],
    [/^Adaugă la favorite: (.+)$/,m=>`Add to favorites: ${m[1]}`],
    [/^Elimină din favorite: (.+)$/,m=>`Remove from favorites: ${m[1]}`],
    [/^(TEAM|ECHIPA) (RED|BLUE) CÂȘTIGĂ$/,m=>`TEAM ${m[2]} WINS`],
    [/^REZULTAT \/ (RUN|RUNDA|RUNDĂ) (\d+)$/,m=>`RESULT / RUN ${m[2]}`],
    [/^Scrie (RED|BLUE) în chat și intră în cursă\.$/,m=>`Type ${m[1]} in chat to join the race.`],
    [/^(.+) a intrat în TEAM (RED|BLUE)\.$/,m=>`${m[1]} joined TEAM ${m[2]}.`],
    [/^Următoarea cursă în (\d+) secunde\.$/,m=>`Next race in ${m[1]} seconds.`],
    [/^([\d.,]+) secunde nitro$/,m=>`${m[1]} seconds of nitro`],
    [/^([\d., ]+) m · ([\d., ]+) puncte$/,m=>`${m[1]} m · ${m[2]} points`],
    [/^([\d., ]+) monede din cadouri$/,m=>`${m[1]} gift coins`],
    [/^([\d., ]+) like-uri$/,m=>`${m[1]} likes`],
    [/^(.+) · Cadouri primite în Studio$/,m=>`${m[1]} · Gifts received in Studio`],
    [/^(.+) · Colecție salvată pe acest dispozitiv$/,m=>`${m[1]} · Collection saved on this device`],
    [/^Se încarcă colecția (.+)…$/,m=>`Loading the collection for ${m[1]}…`],
    [/^Se încarcă (.+)\.\.\.$/,m=>`Loading ${m[1]}...`],
    [/^(Clasament all-time|Clasament ultimele (?:24 de ore|7 zile|30 de zile)) · (\d+) profil(uri)? public(e)?$/,m=>`${englishCopy[m[1]]} · ${m[2]} public ${m[3]?'profiles':'profile'}`],
    [/^(?:Vezi |Redă )?(.+) — (Cursa de noapte|Jocul complet|Cursa în mișcare|Bulevardul de zi|În mișcare|RED pe o roată|BLUE pe o roată|Nova și Vex|Nova în acțiune|Vex o încurcă)$/,m=>(m[0].startsWith('Vezi ')?'View ':m[0].startsWith('Redă ')?'Play ':'')+m[1]+' — '+({'Cursa de noapte':'Night race','Jocul complet':'Full game','Cursa în mișcare':'Race in motion','Bulevardul de zi':'Daytime boulevard','În mișcare':'In motion','RED pe o roată':'RED wheelie','BLUE pe o roată':'BLUE wheelie','Nova și Vex':'Nova and Vex','Nova în acțiune':'Nova in action','Vex o încurcă':'Vex gets in her way'}[m[2]])],
    [/^(Galerie|Detalii|Clip din|Coperta|Prezintă) (.+)$/,m=>({'Galerie':'Gallery','Detalii':'Details','Clip din':'Clip from','Coperta':'Cover for','Prezintă':'Show'}[m[1]])+' '+m[2]],
    [/^(.+) — (?:de|by) TikInteract$/,m=>`${m[1]} — by TikInteract`],
    [/^(.+) — joc LIVE$/,m=>`${m[1]} — LIVE game`],
    [/^Echipa (RED|BLUE)$/,m=>`Team ${m[1]}`],
    [/^([\d., ]+) (monedă|monede)(.*)$/,m=>`${m[1]} ${m[2]==='monedă'?'coin':'coins'}${mapped(m[3],englishCopy,[])}`],
    [/^×([\d., ]+) primit(e)?$/,m=>`×${m[1]} received`],
    [/^([\d., ]+) (recente|cadouri în catalog|tipuri de cadouri|sunete)$/,m=>`${m[1]} ${({'recente':'recent','cadouri în catalog':'gifts in catalog','tipuri de cadouri':'gift types','sunete':'sounds'})[m[2]]}`],
    [/^([\d., ]+) cadouri de explorat · Colecție pentru fiecare streamer$/,m=>`${m[1]} gifts to explore · A collection for every streamer`],
    [/^Arată mai multe \((\d+)\)$/,m=>`Show more (${m[1]})`],
    [/^Colecția @(.+)$/,m=>`Collection @${m[1]}`],
    [/^De la (.+)$/,m=>`From ${m[1]}`],
    [/^Preluat de la TikTok · (.+)$/,m=>`Retrieved from TikTok · ${m[1]}`],
    [/^([\d., ]+) mesaje necitite$/,m=>`${m[1]} unread messages`],
    [/^Actualizat (.+)$/,m=>`Updated ${m[1]}`],
    [/^Începutul conversației · (.+)$/,m=>`Start of conversation · ${m[1]}`],
    [/^Ciornă v(.+)$/,m=>`Draft v${m[1]}`],
    [/^([\d., ]+) jocuri în catalog și arhivă$/,m=>`${m[1]} games in catalog and archive`],
    [/^Mută în (sus|jos): (.+)$/,m=>`Move ${m[1]==='sus'?'up':'down'}: ${m[2]}`],
    [/^Mută (.+) în (sus|jos)$/,m=>`Move ${mapped(m[1],englishCopy,[])} ${m[2]==='sus'?'up':'down'}`],
    [/^Ultima: (.+)$/,m=>`Last: ${m[1]}`],
    [/^Până la (.+)$/,m=>`Until ${m[1]}`],
    [/^([\d–-]+) din (\d+) conturi$/,m=>`${m[1]} of ${m[2]} accounts`],
    [/^Scrie (.+) pentru confirmare$/,m=>`Type ${m[1]} to confirm`],
    [/^Ultimul motiv: (.+)$/,m=>`Last reason: ${m[1]}`],
    [/^Acest cont deține (\d+) fișiere în Supabase Storage\. Mută sau elimină fișierele din Supabase înainte de ștergere\. Păstrează imaginile folosite pe site\.$/,m=>`This account owns ${m[1]} files in Supabase Storage. Move or remove them before deletion. Preserve images used on the website.`],
    [/^Creată (.+) · (.+)$/,m=>`Created ${m[1]} · ${m[2]}`],
    [/^Activare până la: (.+)$/,m=>`Activate by: ${m[1]}`],
    [/^(.+) · (.+) · activare (.+)$/,m=>`${m[1]} · ${m[2]} · activation ${mapped(m[3],englishCopy,[])}`],
    [/^Am păstrat primele (\d+) favorite\. Limita este de (\d+) sunete\.$/,m=>`Kept the first ${m[1]} favourites. The limit is ${m[2]} sounds.`],
    [/^(.+) este deja la favorite$/,m=>`${m[1]} is already in favourites`],
    [/^Adaugă (.+) la favorite$/,m=>`Add ${m[1]} to favourites`],
    [/^Elimină (.+) din favorite$/,m=>`Remove ${m[1]} from favourites`],
    [/^Ai ajuns la limita de (\d+) favorite\. Elimină un sunet favorit înainte să adaugi altul\.$/,m=>`You have reached the limit of ${m[1]} favourites. Remove one before adding another.`],
    [/^(.+) a fost (adăugat la|eliminat din) favorite\.$/,m=>`${m[1]} has been ${m[2]==='adăugat la'?'added to':'removed from'} favourites.`],
    [/^Redă (.+)$/,m=>`Play ${m[1]}`],
    [/^Se redă „(.+)”\.$/,m=>`Playing “${m[1]}”.`],
    [/^Sunetul integrat „(.+)” nu s-a putut încărca\. Verifică fișierul (.+)\.$/,m=>`Built-in sound “${m[1]}” could not be loaded. Check file ${m[2]}.`],
    [/^(\d+) de sunete integrate\. Alege un buton pentru redare\.$/,m=>`${m[1]} built-in sounds. Choose a button to play.`],
    [/^Conectat la @(.+); statisticile se salvează\.$/,m=>`Connected to @${m[1]}; statistics are being saved.`],
    [/^Stare: conectat la @(.+)$/,m=>`Status: connected to @${m[1]}`],
    [/^Stare: conectare la @(.+)\.\.\.$/,m=>`Status: connecting to @${m[1]}...`],
    [/^Profil TikTok găsit: @(.+)$/,m=>`TikTok profile found: @${m[1]}`],
    [/^Profil găsit, poza nu este disponibilă: @(.+)$/,m=>`Profile found, photo unavailable: @${m[1]}`],
    [/^Poza de profil a lui @(.+)$/,m=>`Profile picture of @${m[1]}`],
    [/^a trimis (.+) like-uri$/,m=>`sent ${m[1]} likes`],
    [/^a trimis (.+)$/,m=>`sent ${m[1]}`],
    [/^(Nu am putut reda sunetul|Topul nu s-a putut încărca|Topul nu s-a putut inițializa|Nu am putut salva profilul|LIVE conectat, dar statisticile nu se salvează|Timpul LIVE nu s-a putut salva|Un cadou nu s-a putut înregistra|Eroare TikTok LIVE|Nu am putut încărca profilul|Profilul nu s-a putut publica automat|Nu am putut salva numele|Eroare la logare|Nu am putut trimite linkul de recuperare|Nu am putut schimba parola|Eroare la creare cont): (.+)$/,m=>({'Nu am putut reda sunetul':'Could not play sound','Topul nu s-a putut încărca':'Could not load leaderboard','Topul nu s-a putut inițializa':'Could not initialise leaderboard','Nu am putut salva profilul':'Could not save profile','LIVE conectat, dar statisticile nu se salvează':'LIVE connected, but statistics are not being saved','Timpul LIVE nu s-a putut salva':'Could not save LIVE time','Un cadou nu s-a putut înregistra':'Could not record a gift','Eroare TikTok LIVE':'TikTok LIVE error','Nu am putut încărca profilul':'Could not load profile','Profilul nu s-a putut publica automat':'Could not automatically publish profile','Nu am putut salva numele':'Could not save name','Eroare la logare':'Sign-in error','Nu am putut trimite linkul de recuperare':'Could not send recovery link','Nu am putut schimba parola':'Could not change password','Eroare la creare cont':'Registration error'}[m[1]])+': '+m[2]],
    [/^(\d+) (ore|zile|luni)$/,m=>`${m[1]} ${{ore:'hours',zile:'days',luni:'months'}[m[2]]}`],
    [/^(\d+) octombrie (\d{4})$/,m=>`${m[1]} October ${m[2]}`],
    [/^Ai nevoie de (.+)\. Activează o cheie de acces în pagina PLAY PASS\.$/,m=>`You need ${m[1]}. Activate an access key on the PLAY PASS page.`],
    [/^În direct de (.+)$/,m=>`Live for ${m[1]}`],
    [/^([\d., ]+) monede strânse în această sesiune$/,m=>`${m[1]} coins collected in this session`],
    [/^Eroare logare Google: (.+)$/,m=>`Google sign-in error: ${m[1]}`],
    [/^Cadou TikTok pentru (.+)$/,m=>`TikTok gift for ${mapped(m[1],englishCopy,[])}`],
    [/^(.+) · ([+−-][\d.,]+)( m)?$/,m=>`${mapped(m[1],englishCopy,[])} · ${m[2]}${m[3]||''}`],
    [/^(.+) · ([\d.,]+) monede · #(.+)$/,m=>`${m[1]} · ${m[2]} coins · #${m[3]}`],
    [/^Cadou ID (.+)$/,m=>`Gift ID ${m[1]}`],
    [/^(RON|EUR|USD|lei) \/ lună$/,m=>`${m[1]} / month`],
    [/^([\d.,]+) cadouri · ([\d.,]+) afișate$/,m=>`${m[1]} gifts · ${m[2]} shown`],
    [/^([\d.,]+) cadouri găsite$/,m=>`${m[1]} gifts found`],
    [/^(\d+) (.+) (\d+) favorite$/,m=>`${m[1]} ${m[2]} ${m[3]} favourites`]
];
function mapped(value,map,patterns){
    const trimmed=value.trim();if(!trimmed)return value;
    const key=trimmed.replace(/\s+/g,' ');let result=map[key];
    if(result===undefined)for(const [pattern,format]of patterns){const match=key.match(pattern);if(match){result=format(match);break;}}
    if(result===undefined)return value;
    const start=value.indexOf(trimmed);return value.slice(0,start)+result+value.slice(start+trimmed.length);
}
const monthPairs=[['ianuarie','January'],['februarie','February'],['martie','March'],['aprilie','April'],['mai','May'],['iunie','June'],['iulie','July'],['august','August'],['septembrie','September'],['octombrie','October'],['noiembrie','November'],['decembrie','December'],['ian.','Jan'],['feb.','Feb'],['mar.','Mar'],['apr.','Apr'],['iun.','Jun'],['iul.','Jul'],['aug.','Aug'],['sept.','Sept'],['oct.','Oct'],['nov.','Nov'],['dec.','Dec']];
function dateMonths(value,language){
    if(!/\b\d{1,2} [a-z]/i.test(value))return value;
    const pairs=monthPairs.map(([ro,en])=>language==='ro'?[en,ro]:[ro,en]);
    for(const [source,target]of pairs.sort((a,b)=>b[0].length-a[0].length))value=value.replace(new RegExp('(\\b\\d{1,2} )'+source.replace('.','\\.')+'(?=[,\\s]|$)','gi'),(_,day)=>day+target);
    return value;
}
export function localizeText(value,language='ro'){
    const studioNames={'Game Center':['Jocuri','Games'],'Deschide Game Center':['Deschide Jocuri','Open Games'],'Adaugă jocuri cu ★ din Game Center.':['Adaugă jocuri cu ★ din Jocuri.','Add games with ★ from Games.']};
    const replacement=studioNames[String(value).trim()];if(replacement)return String(value).replace(String(value).trim(),replacement[language==='en'?1:0]);
    const ro=mapped(dateMonths(String(value),'ro'),romanian,roPatterns);
    return language==='en'?dateMonths(mapped(ro,englishCopy,enPatterns),'en'):ro;
}
