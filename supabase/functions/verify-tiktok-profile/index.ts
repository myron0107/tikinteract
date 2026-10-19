// No external packages: this file can also be pasted into the Supabase function editor.
export class VerificationError extends Error {
    constructor(code, status = 503) { super(code); this.status = status; }
}

export function normalizeTikTokUsername(value) {
    const name = typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';
    if (!/^[a-z0-9._]{2,24}$/.test(name) || name.endsWith('.') || name === 'numele_tau') {
        throw new VerificationError('INVALID_USERNAME', 400);
    }
    return name;
}

export function parseTikTokProfile(html, requestedName) {
    const name = normalizeTikTokUsername(requestedName);
    // Accept structured account data only. A 200 page, title, image or challenge is not proof.
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
    for (const [, attributes, body] of scripts) {
        const id = attributes.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!['__UNIVERSAL_DATA_FOR_REHYDRATION__', 'SIGI_STATE'].includes(id)) continue;
        let data;
        try { data = JSON.parse(body); } catch { continue; }
        let candidates = [];
        if (id === '__UNIVERSAL_DATA_FOR_REHYDRATION__') {
            const detail = data?.__DEFAULT_SCOPE__?.['webapp.user-detail'];
            if (Number(detail?.statusCode) !== 0) continue;
            candidates = [detail?.userInfo?.user];
        } else {
            candidates = Object.values(data?.UserModule?.users || {});
        }
        for (const user of candidates) {
            if (!user || String(user.uniqueId || '').toLowerCase() !== name || !/^\d+$/.test(String(user.id || ''))) continue;
            let avatarUrl = null;
            try {
                const url = new URL(user.avatarLarger || user.avatarMedium || user.avatarThumb);
                if (url.protocol === 'https:') avatarUrl = url.href;
            } catch { /* A real account can have no usable public avatar. */ }
            return {username:name,displayName:String(user.nickname || name).trim().slice(0,80) || name,avatarUrl};
        }
    }
    throw new VerificationError('PROFILE_NOT_VERIFIED');
}

export async function fetchTikTokProfile(username, fetchImpl = fetch) {
    const name = normalizeTikTokUsername(username);
    const response = await fetchImpl(`https://www.tiktok.com/@${encodeURIComponent(name)}`, {
        redirect:'error', signal:AbortSignal.timeout(12000),
        headers:{'Accept':'text/html','Accept-Language':'en-US,en;q=0.9','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'}
    });
    if (response.status === 404) throw new VerificationError('PROFILE_NOT_FOUND', 404);
    if (!response.ok) throw new VerificationError('PROFILE_NOT_VERIFIED');
    const reader = response.body?.getReader();
    if (!reader) throw new VerificationError('PROFILE_NOT_VERIFIED');
    const decoder = new TextDecoder();
    let html = '', bytes = 0;
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.length;
            if (bytes > 3 * 1024 * 1024) throw new VerificationError('PROFILE_NOT_VERIFIED');
            html += decoder.decode(chunk.value, {stream:true});
        }
        html += decoder.decode();
    } finally { await reader.cancel().catch(()=>{}); }
    return parseTikTokProfile(html, name);
}

export function createVerificationHandler({url,anonKey,serviceKey,fetchImpl = fetch}) {
    return async request => {
        const origin = request.headers.get('Origin');
        let allowed = !origin || origin === 'https://tikinteract.vercel.app';
        try { const parsed = new URL(origin); allowed ||= parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname); } catch {}
        const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
            'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
        if (origin && allowed) headers['Access-Control-Allow-Origin'] = origin;
        const respond = (data, status = 200) => new Response(JSON.stringify(data), {status,headers});
        if (!allowed) return respond({code:'ORIGIN_NOT_ALLOWED'},403);
        if (request.method === 'OPTIONS') return new Response(null, {status:204,headers});
        if (request.method !== 'POST') return respond({code:'METHOD_NOT_ALLOWED'},405);
        if (!url || !anonKey || !serviceKey) return respond({code:'VERIFICATION_UNAVAILABLE'},503);
        const authorization = request.headers.get('Authorization') || '';
        if (!/^Bearer \S+$/.test(authorization)) return respond({code:'AUTH_REQUIRED'},401);
        try {
            const authHeaders = {apikey:anonKey,Authorization:authorization};
            const userResponse = await fetchImpl(`${url}/auth/v1/user`, {headers:authHeaders,signal:AbortSignal.timeout(8000)});
            if (!userResponse.ok) return respond({code:'AUTH_REQUIRED'},401);
            const user = await userResponse.json();
            if (!user.id || user.is_anonymous === true) return respond({code:'AUTH_REQUIRED'},401);
            const accountResponse = await fetchImpl(`${url}/rest/v1/rpc/get_my_account_status`, {
                method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)
            });
            if (!accountResponse.ok || (await accountResponse.json())?.allowed !== true) return respond({code:'ACCOUNT_UNAVAILABLE'},403);
            const body = await request.text();
            if (body.length > 2048) return respond({code:'INVALID_REQUEST'},400);
            let input;
            try { input = JSON.parse(body); } catch { return respond({code:'INVALID_REQUEST'},400); }
            const username = normalizeTikTokUsername(input?.username);
            const adminHeaders = {apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
            const reserve = await fetchImpl(`${url}/rest/v1/rpc/begin_tiktok_profile_verification`, {
                method:'POST',headers:adminHeaders,body:JSON.stringify({p_user_id:user.id}),signal:AbortSignal.timeout(8000)
            });
            if (!reserve.ok) {
                const error = await reserve.json().catch(()=>({}));
                return respond({code:error.message?.includes('RATE_LIMITED') ? 'RATE_LIMITED' : 'VERIFICATION_UNAVAILABLE'},error.message?.includes('RATE_LIMITED') ? 429 : 503);
            }
            const profile = await fetchTikTokProfile(username, fetchImpl);
            const confirmation = await fetchImpl(`${url}/rest/v1/rpc/confirm_tiktok_profile`, {
                method:'POST',headers:adminHeaders,
                body:JSON.stringify({p_user_id:user.id,p_username:profile.username,p_display_name:profile.displayName,p_avatar_url:profile.avatarUrl}),
                signal:AbortSignal.timeout(8000)
            });
            if (!confirmation.ok) return respond({code:'VERIFICATION_UNAVAILABLE'},503);
            return respond({verified:true,profile});
        } catch (error) {
            return respond({code:error instanceof VerificationError ? error.message : 'VERIFICATION_UNAVAILABLE'},error instanceof VerificationError ? error.status : 503);
        }
    };
}

if (typeof Deno !== 'undefined') {
    Deno.serve(createVerificationHandler({url:Deno.env.get('SUPABASE_URL'),anonKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
}
