(() => {
    const plans = Object.freeze({
        'neon-race': 'play_pass',
        'neon-riders': 'play_pass',
        'country-derby': 'play_pass',
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
            return plans[gameId] === 'free';
        },
        getPlan(gameId) {
            return plans[gameId] || null;
        },
        getLockMessage(gameId) {
            const plan = planNames[plans[gameId]];
            if (!plan) return 'Jocul nu este disponibil.';
            return `${plan}: abonamentele nu sunt încă disponibile. Jocul va putea fi pornit după configurarea plății.`;
        }
    });
})();
