import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

for (const path of ['GAME/NEON-RACE/Neon-Race.html','GAME/NEON-RIDERS/NEON-RIDERS.html','GAME/COUNTRY-DERBY/COUNTRY-DERBY.html']) {
    test(`${path} is small and references valid immutable media`, () => {
        const gameURL = new URL(`../${path}`, import.meta.url);
        const html = readFileSync(gameURL, 'utf8');
        assert(Buffer.byteLength(html) < 200000);
        assert(!/data:image\/[\w+.-]+;base64,/.test(html));
        const references = [...html.matchAll(/\.\.\/\.\.\/assets\/game-media\/([a-f0-9]{64})\.(png|webp)/g)];
        assert.equal(references.length, 11);
        for (const reference of references) {
            const bytes = readFileSync(new URL(reference[0], gameURL));
            assert.equal(createHash('sha256').update(bytes).digest('hex'), reference[1]);
            assert(bytes.length > 0);
        }
    });
}
