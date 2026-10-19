(() => {
    const pending = new Map(), cache = new Map();
    let generation = 0;
    function normalize(value) {
        const name = String(value || '').trim().replace(/^@/, '').toLowerCase();
        if (!/^[a-z0-9._]{2,24}$/.test(name) || name.endsWith('.') || name === 'numele_tau') throw new Error('Introdu un username TikTok real, fără textul de exemplu.');
        return name;
    }
    const messages = {
        INVALID_USERNAME:'Introdu un username TikTok valid.',
        PROFILE_NOT_FOUND:'Acest cont nu a fost găsit pe TikTok. Numele nu a fost salvat.',
        PROFILE_NOT_VERIFIED:'TikTok nu a confirmat profilul. Încearcă din nou mai târziu; numele nu a fost salvat.',
        AUTH_REQUIRED:'Intră în cont pentru a verifica profilul TikTok.',
        ACCOUNT_UNAVAILABLE:'Contul tău nu are acces la această acțiune.',
        RATE_LIMITED:'Prea multe verificări. Așteaptă puțin și încearcă din nou.'
    };
    async function verify(value) {
        const username = normalize(value), userId = window.tikInteractUser?.id, client = window.tikInteractSupabase;
        if (!userId || !client) throw new Error(messages.AUTH_REQUIRED);
        if (!client.functions?.invoke) throw new Error('Verificarea TikTok nu este disponibilă momentan. Numele nu a fost salvat.');
        const key = `${userId}:${username}`, cached = cache.get(key);
        if (cached && cached.until > Date.now()) return cached.profile;
        if (pending.has(key)) return pending.get(key);
        const version = generation;
        const work = (async () => {
            const {data,error} = await client.functions.invoke('verify-tiktok-profile', {body:{username}});
            if (window.tikInteractUser?.id !== userId || version !== generation) throw new Error('Contul s-a schimbat. Verifică din nou profilul.');
            let code = data?.code;
            if (error?.context?.json) { try { code = (await error.context.json()).code; } catch {} }
            if (error || data?.verified !== true || !data.profile || normalize(data.profile.username) !== username) {
                throw new Error(messages[code] || 'Verificarea TikTok nu este disponibilă momentan. Numele nu a fost salvat.');
            }
            cache.set(key, {profile:data.profile,until:Date.now()+5*60*1000});
            return data.profile;
        })();
        pending.set(key, work);
        try { return await work; } finally { if (pending.get(key) === work) pending.delete(key); }
    }
    let identity = window.tikInteractUser?.id;
    window.addEventListener('tikinteract:auth', () => {
        if (identity === window.tikInteractUser?.id) return;
        identity = window.tikInteractUser?.id;generation++;pending.clear();cache.clear();
    });
    window.TikInteractTikTokProfile = Object.freeze({verify,normalize,reset(){generation++;pending.clear();cache.clear();}});
})();
