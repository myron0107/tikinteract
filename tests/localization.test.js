import test from 'node:test';import assert from 'node:assert/strict';
import {localizeText,englishCopy} from '../assets/language-copy.js';
import {romanian} from '../assets/language-ro.js';
import {COPY,text,distance,quantity} from '../GAME/NOVA-VEX/src/copy.js';
import {NEON_GIFTS,GIFT_DESCRIPTIONS_EN} from '../GAME/NOVA-VEX/src/gift-definitions.js';

test('both interface languages cover navigation, resources, access and administration',()=>{
 const pairs=[['Autentificare / Cont','Sign in / Account'],['Game Center','Games'],['Audio Center','Audio Center'],['PRICING','PRICING'],['Mesaje și suport','Messages and support'],['Echipă și grade','Team and roles'],['Caută un cadou…','Search for a gift…'],['Răspuns către utilizator','Reply to user'],['Sunet oprit','Sound off']];
 for(const [original,en]of pairs){assert.equal(localizeText(original,'en'),en);assert.equal(localizeText(original,'ro'),original==='Game Center'?'Jocuri':romanian[original]||original);}
 for(const [ro,en]of Object.entries(englishCopy)){assert.equal(typeof en,'string',ro);assert(en.trim(),ro);assert(!/[�]|\?(?:ndep|năl|Spa\?)/.test(en),ro);}
 assert.equal(localizeText('  Got an access key?\n','ro'),'  Ai o cheie de acces?\n');
 assert.equal(localizeText('19 October 2026','ro'),'19 octombrie 2026');
 assert.equal(localizeText('3 ianuarie 2025, 12:04','en'),'3 January 2025, 12:04');
});

test('race results, countdowns and contributions preserve teams, identities and amounts',()=>{
 const pairs=[['TEAM RED CÂȘTIGĂ','TEAM RED WINS'],['TEAM BLUE CÂȘTIGĂ','TEAM BLUE WINS'],['REZULTAT / RUN 02','RESULT / RUN 02'],['Următoarea cursă în 15 secunde.','Next race in 15 seconds.'],['Ajutor a intrat în TEAM RED.','Ajutor joined TEAM RED.'],['150 monede din cadouri','150 gift coins'],['Rose · 1 monede · #5655','Rose · 1 coins · #5655'],['Împingerea lui Vex · −150 m','Vex Push · −150 m'],['RON / lună','RON / month']];
 for(const [ro,en]of pairs)assert.equal(localizeText(ro,'en'),en);
 assert.equal(localizeText('TEAM RED CÂȘTIGĂ','ro'),'ECHIPA RED CÂȘTIGĂ');
 assert.equal(localizeText('REZULTAT / RUN 02','ro'),'REZULTAT / RUNDĂ 02');
 assert.equal(localizeText('NEON INTERACT','en'),'NEON INTERACT');
 assert.equal(localizeText('Rose','ro'),'Rose');
});

test('NOVA has complete Romanian and English controls, gifts and landscape labels',()=>{
 assert.deepEqual(Object.keys(COPY.ro).sort(),Object.keys(COPY.en).sort());
 for(const key of Object.keys(COPY.ro))for(const lang of ['ro','en'])assert(text(key,lang)&&text(key,lang)!==key,key+' '+lang);
 for(const [key,gift]of Object.entries(NEON_GIFTS)){assert.equal(text(key,'ro'),gift.name);assert.equal(text(key,'en'),gift.en);assert(GIFT_DESCRIPTIONS_EN[key],key);}
 assert.equal(text('earth','ro'),'Cartier neon');assert.equal(text('earth','en'),'Neon District');
 assert.equal(quantity(1234.5,'ro'),'1.234,5');assert.equal(quantity(1234.5,'en'),'1,234.5');
 assert.equal(distance(1234.9,'ro'),'1.234');assert.equal(distance(1234.9,'en'),'1,234');
});
