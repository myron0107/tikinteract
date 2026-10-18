import {TikTokLiveConnection} from 'tiktok-live-connector';
import {normalizeGiftCatalog} from '../assets/tiktok-gifts-data.js';

export const TIKTOK_GIFT_SOURCE = 'https://webcast.tiktok.com/webcast/gift/list/';

// The public catalog route does not require joining a room or opening a LIVE.
export async function fetchTikTokGiftCatalog({region = 'RO', connection = null} = {}) {
    const reader = connection || new TikTokLiveConnection('tikinteract', {
        webClientOptions: {timeout: {request: 12000}, retry: {limit: 0}}
    });
    const params = {...reader.webClient.clientParams, region, priority_region: region};
    const response = await reader.webClient.getJsonObjectFromWebcastApi('gift/list/', params, false);
    const gifts = normalizeGiftCatalog(response);
    if (response.status_code !== 0 || !gifts.length) throw new Error('TikTok nu a returnat catalogul de cadouri.');
    return {gifts, updatedAt: Date.now(), rawCount: response.data.gifts.length, username: null, scope: 'catalog', region, source: TIKTOK_GIFT_SOURCE};
}
