import { randomUUID } from 'node:crypto';
import {safeGiftImage} from '../assets/tiktok-gifts-data.js';

const positiveInteger = (value, fallback = 0, max = 1000000) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(0, Math.floor(number))) : fallback;
};

// Protobuf field 3 is named viewerCount in v2 and total in v3.
export function liveViewerCount(event){const raw=event?.viewerCount??event?.total;if(raw===null||raw===undefined||raw==='')return null;const count=Number(raw);return Number.isSafeInteger(count)&&count>=0&&count<=10000000?count:null;}

// One normalizer per LIVE session: SDK-specific fields never leak into games.
export function createLiveEventNormalizer(sessionId) {
    const seen = new Set();
    return (type, raw, extendedGiftInfo = null) => {
        if (!['chat', 'like', 'gift'].includes(type)) return null;
        const username = String(raw.user?.uniqueId || raw.uniqueId || raw.user?.userId || '').replace(/^@/, '').slice(0, 80);
        if (!username) return null;
        let payload;
        if (type === 'chat') {
            const message = String(raw.comment || '').slice(0, 500);
            if (!message.trim()) return null;
            payload = {message};
        } else if (type === 'like') {
            const likeCount = positiveInteger(raw.likeCount ?? raw.count);
            if (!likeCount) return null;
            payload = {likeCount};
        } else {
            const gift = raw.giftDetails || raw.gift || {};
            const giftType = Number(gift.giftType ?? gift.type ?? raw.giftType ?? extendedGiftInfo?.giftType ?? extendedGiftInfo?.type);
            if (giftType === 1 && ![true, 1, '1', 'true'].includes(raw.repeatEnd)) return null;
            const repeatCount = Math.max(1, positiveInteger(raw.repeatCount, 1, 1000));
            const diamondCount = positiveInteger(extendedGiftInfo?.diamondCount ?? extendedGiftInfo?.diamond_count ?? extendedGiftInfo?.coins ?? gift.diamondCount ?? gift.diamond_count ?? raw.diamondCount);
            payload = {
                giftName: String(gift.giftName || gift.name || extendedGiftInfo?.name || extendedGiftInfo?.giftName || raw.giftName || 'Cadou').slice(0, 100),
                giftId: String(raw.giftId || gift.id || extendedGiftInfo?.id || '').slice(0,100),
                giftImage: safeGiftImage(extendedGiftInfo?.image)||safeGiftImage(gift.giftImage)||safeGiftImage(gift.image)||safeGiftImage(raw.giftPictureUrl),
                repeatCount, diamondCount, coins: Math.min(1000000, repeatCount * diamondCount),
                giftType: Number.isFinite(giftType) ? giftType : 0, repeatEnd: true
            };
        }
        const groupId = type === 'gift' && raw.groupId && String(raw.groupId) !== '0' ? `${username}:${raw.giftId || payload.giftId}:${raw.groupId}` : null;
        const rawId = [groupId, raw.common?.msgId, raw.msgId, raw.eventId].find(value => value && String(value) !== '0');
        const key = `${type}:${rawId || randomUUID()}`;
        if (seen.has(key)) return null;
        seen.add(key);
        if (seen.size > 10000) seen.delete(seen.values().next().value);
        return {type, sessionId, eventId: randomUUID(), timestamp: Date.now(), username, displayName: String(raw.user?.nickname || username).slice(0, 80), ...payload};
    };
}
