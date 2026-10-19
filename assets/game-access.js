(() => {
    const plans = Object.freeze({
        'neon-race-2': 'free',
        'moto-interact': 'free',
        'nova-vex': 'free'
    });
    const planNames = Object.freeze({
        play_pass: 'Play Pass',
        play_pass_pro: 'Play Pass PRO'
    });

    window.TikInteractGameAccess = Object.freeze({
        isAvailable(gameId) {
            const configured = window.TikInteractPlatform?.getGame(gameId);
            if (window.TikInteractPlatform) return configured?.status === 'published' && configured.plan === 'free';
            return plans[gameId] === 'free';
        },
        getPlan(gameId) {
            if (window.TikInteractPlatform) {const game=window.TikInteractPlatform.getGame(gameId);return game?.status==='published'?game.plan:null;}
            return plans[gameId] || null;
        },
        getLockMessage(gameId) {
            const plan = planNames[this.getPlan(gameId)];
            if (!plan) return 'Jocul nu este disponibil.';
            return `${plan}: abonamentele nu sunt încă disponibile. Jocul va putea fi pornit după configurarea plății.`;
        }
    });
})();
