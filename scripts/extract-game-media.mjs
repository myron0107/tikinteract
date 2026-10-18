import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const games = ['GAME/NEON-RACE/Neon-Race.html','GAME/NEON-RIDERS/NEON-RIDERS.html','GAME/COUNTRY-DERBY/COUNTRY-DERBY.html'];
const extensions = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/svg+xml':'svg','audio/mpeg':'mp3','audio/mp3':'mp3','audio/ogg':'ogg','audio/wav':'wav','audio/mp4':'m4a'};
const mediaDir = path.join(root, 'assets/game-media');
await mkdir(mediaDir, {recursive:true});
let totalBefore = 0, totalAfter = 0;
const files = new Set();
for (const game of games) {
    const fullPath = path.join(root, game);
    const html = await readFile(fullPath, 'utf8');
    const replacements = [];
    for (const match of html.matchAll(/data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})/g)) {
        const extension = extensions[match[1]];
        if (!extension) throw new Error(`Unsupported embedded media type: ${match[1]}`);
        const bytes = Buffer.from(match[2], 'base64');
        if (bytes.toString('base64') !== match[2]) throw new Error(`Invalid base64 in ${game}`);
        const name = `${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
        const destination = path.join(mediaDir, name);
        if (!files.has(name)) {
            try {
                const existing = await readFile(destination);
                if (!existing.equals(bytes)) throw new Error(`Asset hash collision: ${name}`);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                await writeFile(destination, bytes);
            }
        }
        files.add(name);
        replacements.push({start:match.index, end:match.index+match[0].length, url:`../../assets/game-media/${name}`});
    }
    let optimized = html;
    for (const replacement of replacements.reverse()) optimized = optimized.slice(0,replacement.start)+replacement.url+optimized.slice(replacement.end);
    // External media must preserve the exact scripts, HTML structure and artwork.
    if (replacements.length) await writeFile(fullPath, optimized);
    totalBefore += Buffer.byteLength(html); totalAfter += Buffer.byteLength(optimized);
    console.log(`${game}: ${Buffer.byteLength(html)} -> ${Buffer.byteLength(optimized)} bytes (${replacements.length} extracted media references)`);
}
let mediaBytes = 0;
for (const name of files) mediaBytes += (await stat(path.join(mediaDir,name))).size;
console.log(JSON.stringify({totalHtmlBefore:totalBefore,totalHtmlAfter:totalAfter,uniqueMediaFiles:files.size,mediaBytes}));
