import test from 'node:test';
import assert from 'node:assert/strict';
import {latestPublishedGame,withPublicationDate} from '../assets/catalog-featured-data.js';
import {DEFAULT_CONFIG,cloneConfig,validateConfig} from '../assets/platform-schema.js';
test('newest published release is independent of catalog order; hidden games are never featured',()=>{
 const games=[{id:'new',status:'published',publishedAt:'2026-10-21T10:00:00Z'},{id:'future-draft',status:'draft',publishedAt:'2027-01-01T00:00:00Z'},{id:'old',status:'published',publishedAt:'2026-01-01T00:00:00Z'},{id:'disabled',status:'disabled',publishedAt:'2027-01-01T00:00:00Z'}];
 assert.equal(latestPublishedGame(games).id,'new');assert.equal(latestPublishedGame([...games].reverse()).id,'new');assert.equal(latestPublishedGame([]),null);
 assert.equal(latestPublishedGame(DEFAULT_CONFIG.games).id,'nova-vex');
});
test('drafts get a first-publication date on release; edits and reactivation retain it',()=>{
 const draft={id:'new',status:'draft'},now='2026-10-21T10:00:00Z';
 assert(!withPublicationDate(draft,null,now).publishedAt);
 const release=withPublicationDate({...draft,status:'published'},draft,now);
 assert.equal(release.publishedAt,now);
 assert.equal(withPublicationDate({...release,name:'Updated'},release,'2027-01-01T00:00:00Z').publishedAt,now);
 assert.equal(withPublicationDate({...release,status:'published'},{...release,status:'disabled'},'2027-01-01T00:00:00Z').publishedAt,now);
 const config=cloneConfig(DEFAULT_CONFIG);config.games[2]=withPublicationDate(config.games[2],null,now);
 assert.equal(validateConfig(config).games[2].publishedAt,now);
});
