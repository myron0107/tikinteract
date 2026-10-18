import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveEventNormalizer } from '../lib/live-events.js';

const user = {uniqueId:'alice', nickname:'Alice'};
test('chat and v3 batched likes preserve viewer identity and get session IDs', () => {
    const normalize = createLiveEventNormalizer('session');
    const chat = normalize('chat', {user, comment:'RED', common:{msgId:'chat'}});
    assert.equal(chat.message, 'RED');
    const like = normalize('like', {user, count:25, common:{msgId:'like'}});
    assert.equal(like.likeCount, 25);
    assert.equal(like.username, chat.username);
    assert.equal(like.sessionId, 'session');
    assert.match(like.eventId, /^[0-9a-f-]{36}$/); // Supabase gift event IDs use UUIDs.
    assert.notEqual(like.eventId, chat.eventId);
    assert.equal(normalize('like', {user, count:25, common:{msgId:'like'}}), null);
});
test('gift streak only awards the final total once, including numeric repeatEnd', () => {
    const normalize = createLiveEventNormalizer('session');
    const gift = {user, giftId:'rose', groupId:'streak', giftDetails:{giftType:1, diamondCount:5}, repeatCount:3};
    assert.equal(normalize('gift', {...gift, repeatEnd:0}), null);
    const final = normalize('gift', {...gift, repeatEnd:1, common:{msgId:'first'}});
    assert.equal(final.coins, 15);
    assert.equal(final.repeatCount, 3);
    assert.equal(final.diamondCount, 5);
    assert.equal(normalize('gift', {...gift, repeatEnd:true, common:{msgId:'second'}}), null);
});
test('raw v3 gifts, catalog gift data, invalid counts and default message IDs', () => {
    const normalize = createLiveEventNormalizer('session');
    assert.equal(normalize('gift', {user, gift:{type:1, name:'Rose', diamondCount:2}, repeatEnd:0}), null);
    assert.equal(normalize('gift', {user, gift:{type:0, name:'Rose'}, repeatCount:2}, {diamondCount:5}).coins, 10);
    assert.equal(normalize('gift', {user, gift:{type:0}}).coins, 0);
    for (const count of [0, -1, Infinity, 'bad']) assert.equal(normalize('like', {user, count}), null);
    assert.equal(normalize('chat', {comment:'RED'}), null);
    assert.equal(normalize('chat', {user, comment:' '}), null);
    const a = normalize('like', {user, count:1, common:{msgId:'0'}});
    const b = normalize('like', {user, count:1, common:{msgId:'0'}});
    assert.notEqual(a.eventId, b.eventId);
});
test('new LIVE sessions do not share deduplication state', () => {
    const raw = {user, count:1, msgId:'same'};
    assert.notEqual(createLiveEventNormalizer('one')('like', raw).eventId, createLiveEventNormalizer('two')('like', raw).eventId);
});
