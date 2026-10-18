// Preserve each game's editorial details and rebuild its shared presentation.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const template=await readFile(path.join(root,'scripts/game-presentation.template.html'),'utf8');
const manifest=JSON.parse(await readFile(path.join(root,'assets/game-gallery/manifest.json'),'utf8'));
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for (const [game,folder] of [['neon-race','NEON-RACE'],['neon-riders','NEON-RIDERS'],['country-derby','COUNTRY-DERBY']]) {
    const filename=path.join(root,'GAME',folder,'index.html');
    const source=await readFile(filename,'utf8');
    const get=pattern=>{const match=source.match(pattern);if(!match)throw new Error(`Missing presentation content: ${filename}`);return match[1];};
    const modes=manifest.filter(item=>item.game===game);
    const title=get(/<h1 class="game-page-title">([\s\S]*?)<\/h1>/);
    const details=[...source.matchAll(/<section class="game-page-info-card">[\s\S]*?<\/section>/g)].map(match=>match[0]).join('\n');
    if (!details || !modes.length) throw new Error(`Missing details or images: ${game}`);
    const thumbnails=modes.map((mode,index)=>`                        <button class="game-gallery-item" type="button" data-gallery-image="../../assets/game-gallery/${mode.file}" data-gallery-label="${escape(title)} — ${escape(mode.label)}" data-gallery-mode="${escape(mode.label)}" aria-label="Vezi ${escape(title)} — ${escape(mode.label)}" aria-pressed="${index===0}">
                            <img src="../../assets/game-gallery/${mode.thumbnail}" alt="${escape(title)} — ${escape(mode.label)}" width="360" height="640" loading="lazy" decoding="async">
                            <span>${escape(mode.label)}</span>
                        </button>`).join('\n');
    const values={title,description:get(/<meta name="description" content="([^"]*)"/),tag:get(/<span class="game-page-tag">([\s\S]*?)<\/span>/),summary:get(/<p class="game-page-summary">([\s\S]*?)<\/p>/),game,firstImage:`../../assets/game-gallery/${modes[0].file}`,count:modes.length,thumbnails,details};
    await writeFile(filename,template.replace(/\{\{(\w+)\}\}/g,(_,key)=>values[key]));
    console.log(`Built ${game}: ${modes.length} gallery images and existing game details.`);
}
