// Import genuine TikTok metadata and copy original image bytes without editing.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fetchTikTokGiftCatalog} from '../lib/tiktok-gift-source.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestFile = path.join(root, 'assets/tiktok-gifts-catalog.json');
const imageDirectory = path.join(root, 'assets/tiktok-gift-images');
await mkdir(imageDirectory, {recursive: true});
let previous = {gifts: [], imageFiles: {}};
try {previous = JSON.parse(await readFile(manifestFile, 'utf8'));} catch {}
const catalog = await fetchTikTokGiftCatalog({region: process.env.TIKTOK_GIFT_REGION || 'RO'});
const imageFiles = {}, failures = [], downloads = new Map();
let cursor = 0, completed = 0;

async function download(url) {
    if (downloads.has(url)) return downloads.get(url);
    const work = (async () => {
        const host = new URL(url).hostname;
        if (!host.endsWith('.tiktokcdn.com') && !host.endsWith('.tiktokcdn-us.com')) throw new Error('Unexpected image source');
        const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error('Image HTTP '+response.status);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length || bytes.length > 2*1024*1024) throw new Error('Invalid image size');
        const extension = bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP' ? 'webp'
            : bytes[0]===137 && bytes.subarray(1,4).toString()==='PNG' ? 'png'
            : bytes[0]===255 && bytes[1]===216 ? 'jpg' : null;
        if (!extension) throw new Error('Unexpected image format');
        const filename = createHash('sha256').update(bytes).digest('hex')+'.'+extension;
        await writeFile(path.join(imageDirectory,filename),bytes);
        return 'assets/tiktok-gift-images/'+filename;
    })();
    downloads.set(url, work);
    return work;
}

await Promise.all(Array.from({length:6}, async () => {
    while (cursor < catalog.gifts.length) {
        const gift = catalog.gifts[cursor++];
        const old = previous.gifts.find(item => item.id === gift.id);
        let saved = false;
        if (old?.image === gift.image && previous.imageFiles[gift.id]) {
            try {await readFile(path.join(root,previous.imageFiles[gift.id]));imageFiles[gift.id]=previous.imageFiles[gift.id];saved=true;} catch {}
        }
        for (const url of [...new Set([gift.image,...(gift.images||[])])].filter(Boolean)) {
            if (saved) break;
            try {imageFiles[gift.id] = await download(url);saved = true;} catch {}
        }
        if (!saved) failures.push({id:gift.id,name:gift.name});
        completed++;
        if (completed%100===0) console.log('Original TikTok images: '+completed+'/'+catalog.gifts.length);
    }
}));
await writeFile(manifestFile,JSON.stringify({...catalog,imageFiles},null,2)+'\n');
console.log(JSON.stringify({gifts:catalog.gifts.length,originalImages:Object.keys(imageFiles).length,failures}));
if (failures.length) process.exitCode=1;
