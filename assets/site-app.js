

let supabaseClient = null;
let currentUser = null;
let cookiePreferencesPreviousFocus = null;
let isPasswordRecovery = false;
const LIVE_GAME_PATHS = Object.freeze({
    'neon-race-2': 'GAME/NEON-INTERACT/Neon-Interact.html',
    'moto-interact': 'GAME/MOTO-INTERACT/Moto-Interact.html',
    'nova-vex': 'GAME/NOVA-VEX/Neon-Ascent.html'
});
const isStudioPage = document.body.dataset.page === 'studio';
const initialRoute = new URLSearchParams(window.location.search);
let pendingAccountRoute = !isStudioPage && initialRoute.get('view') === 'account';
let requestedStudioSection = isStudioPage ? initialRoute.get('section') : null;
let requestedStudioPlan = ['free','play_pass','play_pass_pro'].includes(initialRoute.get('plan')) ? initialRoute.get('plan') : '';
function studioUrl(gameId) {
    const params=[];
    if(window.TikInteractPlatform?.getGame(gameId) || LIVE_GAME_PATHS[gameId])params.push('game='+encodeURIComponent(gameId));
    if(typeof requestedStudioSection!=='undefined'&&requestedStudioSection==='subscription')params.push('section=subscription');
    if(typeof requestedStudioPlan!=='undefined'&&['free','play_pass','play_pass_pro'].includes(requestedStudioPlan))params.push('plan='+encodeURIComponent(requestedStudioPlan));
    return 'live-studio.html'+(params.length?'?'+params.join('&'):'');
}
let shouldOpenLiveFromUrl = isStudioPage || initialRoute.get('view') === 'live';
let requestedLiveGame = initialRoute.get('game');
let hasPendingLiveReturn = false;

window.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!isStudioPage && initialRoute.get('view') === 'live') {
            shouldOpenLiveFromUrl = true;
        }
        restorePendingLiveRoute();
        if (!isStudioPage && ['catalog','streams','leaderboard','play-pass'].includes(initialRoute.get('view'))) switchView(initialRoute.get('view'));
        if (window.supabase) {
            const configResponse = await fetch('assets/supabase-config.json');
            if (!configResponse.ok) throw new Error('Configurația contului nu este disponibilă.');
            const config = await configResponse.json();
            supabaseClient = window.supabase.createClient(config.url, config.anonKey);
            window.tikInteractSupabase = supabaseClient;
            loadHomeLeaderboard();
            if (!document.getElementById('view-leaderboard')?.classList.contains('hidden') && !isStudioPage) loadLeaderboard();
            const { data: { session } } = await supabaseClient.auth.getSession();
            updateUI(session);
            if (pendingAccountRoute && !session?.user) openAuthModal();

            supabaseClient.auth.onAuthStateChange((event, session) => {
                updateUI(session);
                if (event === 'PASSWORD_RECOVERY') showPasswordRecoveryForm();
            });
        } else {
            updateUI(null);
            loadHomeLeaderboard();
        }
    } catch (err) {
        updateUI(null);
        console.error("Eroare initializare:", err);
        const leaderboardStatus = document.getElementById('home-leaderboard-status');
        if (leaderboardStatus) {
            leaderboardStatus.textContent = `Topul nu s-a putut inițializa: ${err.message}`;
            leaderboardStatus.classList.add('is-error');
        }
    }
});

function restorePendingLiveRoute() {
    if (shouldOpenLiveFromUrl) return;
    try {
        const destination=JSON.parse(sessionStorage.getItem('tikinteract-studio-return')||'null');
        sessionStorage.removeItem('tikinteract-studio-return');
        if(destination?.section==='subscription'){
            requestedStudioSection='subscription';requestedStudioPlan=['free','play_pass','play_pass_pro'].includes(destination.plan)?destination.plan:'';
            shouldOpenLiveFromUrl=true;hasPendingLiveReturn=true;return;
        }
    } catch {}
    let gameId;
    try {
        gameId = sessionStorage.getItem('tikinteract-live-return');
        if (gameId) sessionStorage.removeItem('tikinteract-live-return');
    } catch (error) {
        console.error('Could not restore the selected game after sign-in:', error);
        return;
    }
    if (!gameId) return;
    if (gameId !== 'studio' && !LIVE_GAME_PATHS[gameId]) {
        console.error('Ignoring an invalid saved LIVE game selection.');
        return;
    }

    shouldOpenLiveFromUrl = true;
    requestedLiveGame = gameId === 'studio' ? null : gameId;
    hasPendingLiveReturn = true;
}

function updateUI(session) {
    const previousUserId = window.tikInteractUser?.id;
    const btnLogin = document.getElementById('btn-login-modal');
    const profileMenu = document.getElementById('user-profile-menu');
    const accountMenuToggle = document.getElementById('account-menu-toggle');
    const headerAccountMenu = document.getElementById('header-account-menu');
    const headerAccountName = document.getElementById('header-account-name');
    const statusDot = document.getElementById('account-status-indicator');
    const accountCardStatusDot = document.getElementById('account-card-status-indicator');
    const accountStatus = document.getElementById('account-status-label');
    window.tikInteractUser = session?.user || null;
    window.tikInteractAccessToken = session?.access_token || null;
    window.dispatchEvent?.(new Event('tikinteract:auth'));
    if (isStudioPage) {
        document.body.classList.toggle('studio-locked', !session?.user);
        const gate = document.getElementById('studio-access-gate');
        if (gate) gate.hidden = !!session?.user;
        const title = document.getElementById('studio-access-title');
        if (title) title.textContent = 'Intră în cont pentru LIVE Studio';
        document.getElementById('studio-access-login')?.removeAttribute('hidden');
    }
    if (session?.user) window.refreshTikInteractConnectionState?.();

    if (session && session.user) {
        const user = session.user;
        currentUser = user;
        if (isStudioPage) window.startTikInteractStudio?.();
        const accountDisplayName = document.getElementById('account-display-name');
        const accountDisplayNameInput = document.getElementById('account-display-name-input');
        const accountEmailDetail = document.getElementById('account-email-detail');
        const accountLoginMethod = document.getElementById('account-login-method');
        const accountCreatedAt = document.getElementById('account-created-at');
        const accountUserId = document.getElementById('account-user-id');
        const accountAvatar = document.getElementById('account-avatar-display');
        const providers = user.app_metadata?.providers || [];
        const provider = user.app_metadata?.provider || providers[0] || 'unknown';
        const displayName = user.user_metadata?.display_name
            || user.user_metadata?.full_name
            || user.user_metadata?.name
            || user.email?.split('@')[0]
            || 'Utilizator';
        const loginMethod = provider === 'google'
            ? 'Google'
            : provider === 'email'
                ? 'Email și parolă'
                : provider.charAt(0).toUpperCase() + provider.slice(1);
        const createdAt = user.created_at
            ? new Date(user.created_at).toLocaleDateString((window.TikInteractLanguage?.locale() || 'ro-RO'), { year: 'numeric', month: 'long', day: 'numeric' })
            : 'Indisponibil';
        if (accountDisplayName) accountDisplayName.textContent = displayName;
        if (headerAccountName) headerAccountName.textContent = displayName;
        if (accountMenuToggle) {
            accountMenuToggle.setAttribute('aria-label', `Meniu cont: ${displayName}`);
            accountMenuToggle.title = displayName;
        }
        if (typeof setAccountAvatar === 'function') setAccountAvatar(displayName, user.user_metadata?.avatar_url || user.user_metadata?.picture || null, {preserve: previousUserId === user.id});
        if (accountDisplayNameInput && document.activeElement !== accountDisplayNameInput) {
            accountDisplayNameInput.value = user.user_metadata?.display_name || displayName;
        }
        if (accountEmailDetail) accountEmailDetail.textContent = user.email || 'Indisponibil';
        if (accountLoginMethod) accountLoginMethod.textContent = loginMethod;
        if (accountCreatedAt) accountCreatedAt.textContent = createdAt;
        if (accountUserId) accountUserId.textContent = user.id || 'Indisponibil';
        if (accountAvatar) accountAvatar.textContent = displayName.charAt(0).toUpperCase();
        [statusDot, accountCardStatusDot].forEach((dot) => {
            if (!dot) return;
            dot.classList.toggle('is-active', true);
            dot.classList.toggle('is-inactive', false);
            dot.setAttribute('aria-label', 'Cont activ');
            dot.title = 'Cont activ';
        });
        if (accountStatus) {
            accountStatus.textContent = 'Activ';
            accountStatus.classList.add('is-active');
            accountStatus.classList.remove('is-inactive');
        }
        if (typeof restoreMyStreamerProfile === 'function') {
            restoreMyStreamerProfile().catch((err) => {
                console.error('Could not restore streamer profile:', err);
                const status = document.getElementById('tiktok-sync-status');
                if (status) {
                    status.textContent = `Profilul nu s-a putut publica automat: ${err.message}`;
                    status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400';
                }
            });
        }
        if(btnLogin) btnLogin.classList.add('hidden');
        if(profileMenu) profileMenu.classList.remove('hidden');
        if(accountMenuToggle) accountMenuToggle.classList.remove('hidden');
        headerAccountMenu?.classList.remove('hidden');
        if (!isPasswordRecovery) closeAuthModal();
        if (pendingAccountRoute) {
            pendingAccountRoute = false;
            switchView('account');
        }
        if (shouldOpenLiveFromUrl) {
            shouldOpenLiveFromUrl = false;
            switchView('live');
            if (hasPendingLiveReturn) {
                sessionStorage.removeItem('tikinteract-live-return');
                hasPendingLiveReturn = false;
            }
        }
    } else {
        if (isStudioPage) {
            shouldOpenLiveFromUrl = true;
            window.stopTikInteractStudio?.();
        }
        closeAccountMenu();
        currentUser = null;
        headerAccountMenu?.classList.add('hidden');
        if (headerAccountName) headerAccountName.textContent = '';
        if (accountMenuToggle) {
            accountMenuToggle.setAttribute('aria-label', 'Meniu cont');
            accountMenuToggle.title = 'Meniu cont';
        }
        const accountDisplayName = document.getElementById('account-display-name');
        const accountDisplayNameInput = document.getElementById('account-display-name-input');
        const accountDisplayNameStatus = document.getElementById('account-display-name-status');
        const accountEmailDetail = document.getElementById('account-email-detail');
        const accountLoginMethod = document.getElementById('account-login-method');
        const accountCreatedAt = document.getElementById('account-created-at');
        const accountUserId = document.getElementById('account-user-id');
        const accountAvatar = document.getElementById('account-avatar-display');
        if (accountDisplayName) accountDisplayName.textContent = 'Display Name';
        if (typeof setAccountAvatar === 'function') setAccountAvatar('U', null);
        if (accountDisplayNameInput) accountDisplayNameInput.value = '';
        if (accountDisplayNameStatus) accountDisplayNameStatus.textContent = '';
        if (accountEmailDetail) accountEmailDetail.textContent = '—';
        if (accountLoginMethod) accountLoginMethod.textContent = '—';
        if (accountCreatedAt) accountCreatedAt.textContent = '—';
        if (accountUserId) accountUserId.textContent = '—';
        if (accountAvatar) accountAvatar.textContent = 'U';
        [statusDot, accountCardStatusDot].forEach((dot) => {
            if (!dot) return;
            dot.classList.toggle('is-active', false);
            dot.classList.toggle('is-inactive', true);
            dot.setAttribute('aria-label', 'Cont inactiv');
            dot.title = 'Cont inactiv';
        });
        if (accountStatus) {
            accountStatus.textContent = 'Inactiv';
            accountStatus.classList.add('is-inactive');
            accountStatus.classList.remove('is-active');
        }
        if(btnLogin) btnLogin.classList.remove('hidden');
        if(profileMenu) profileMenu.classList.add('hidden');
        if(accountMenuToggle) accountMenuToggle.classList.add('hidden');
        if (shouldOpenLiveFromUrl) openAuthModal();
        if (document.getElementById('view-account') && !document.getElementById('view-account').classList.contains('hidden')) {
            switchView('home');
        } else if (!isStudioPage && document.getElementById('view-live') && !document.getElementById('view-live').classList.contains('hidden')) {
            switchView('home');
        }
    }
    window.TikInteractStartup?.ready('auth');
}

function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if(modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if(modal) modal.classList.add('hidden');
    isPasswordRecovery = false;
    document.getElementById('email-auth-options')?.classList.remove('hidden');
    document.getElementById('password-recovery-form')?.classList.add('hidden');
    document.getElementById('password-recovery-success')?.classList.add('hidden');
}

function toggleAccountMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('user-profile-menu');
    const toggle = document.getElementById('account-menu-toggle');
    if (!menu || !toggle) return;
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) { setGetAppMenu(false); window.TikInteractLanguage?.close(); }
}

function closeAccountMenu() {
    const menu = document.getElementById('user-profile-menu');
    const toggle = document.getElementById('account-menu-toggle');
    menu?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.header-account-menu')) closeAccountMenu();
    if (!event.target.closest('.get-app-dropdown')) setGetAppMenu(false);
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const accountOpen = document.getElementById('user-profile-menu')?.classList.contains('is-open');
    const appOpen = document.querySelector('.get-app-dropdown')?.classList.contains('is-open');
    closeAccountMenu();setGetAppMenu(false);
    if (accountOpen) document.getElementById('account-menu-toggle')?.focus();
    else if (appOpen) document.querySelector('.get-app-trigger')?.focus();
});

function setGetAppMenu(open) {
    const dropdown = document.querySelector('.get-app-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('is-open', open);
    dropdown.querySelector('.get-app-trigger')?.setAttribute('aria-expanded', String(open));
    if (open) { closeAccountMenu(); window.TikInteractLanguage?.close(); }
}

document.addEventListener('DOMContentLoaded', () => {
    const dropdown = document.querySelector('.get-app-dropdown');
    const trigger = dropdown?.querySelector('.get-app-trigger');
    if (!dropdown || !trigger) return;
    trigger.addEventListener('click', () => setGetAppMenu(!dropdown.classList.contains('is-open')));
    dropdown.addEventListener('mouseenter', () => {
        if (matchMedia('(hover:hover)').matches) setGetAppMenu(true);
    });
    dropdown.addEventListener('mouseleave', () => {
        if (!dropdown.contains(document.activeElement)) setGetAppMenu(false);
    });
    dropdown.addEventListener('focusout', () => {
        queueMicrotask(() => {if (!dropdown.contains(document.activeElement)) setGetAppMenu(false);});
    });
    dropdown.addEventListener('keydown', event => {
        if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
        event.preventDefault();setGetAppMenu(true);
        const items = [...dropdown.querySelectorAll('.get-app-menu a[href],.get-app-menu button')];
        const current = items.indexOf(document.activeElement);
        const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
    });
    dropdown.querySelector('a[href="#download-app"]')?.addEventListener('click', event => {
        event.preventDefault();setGetAppMenu(false);switchView('home');
        document.getElementById('download-app')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    dropdown.querySelector('[data-nav-item="live"]')?.addEventListener('click', () => setGetAppMenu(false));
});

async function saveDisplayName(event) {
    event.preventDefault();
    const input = document.getElementById('account-display-name-input');
    const button = document.getElementById('account-display-name-save');
    const status = document.getElementById('account-display-name-status');
    const displayName = input?.value.trim();
    if (!currentUser || !supabaseClient) {
        if (status) {
            status.textContent = 'Conectează-te pentru a-ți salva numele.';
            status.className = 'is-error';
        }
        return;
    }
    if (!displayName) {
        if (status) {
            status.textContent = 'Introdu un nume înainte să salvezi.';
            status.className = 'is-error';
        }
        return;
    }

    if (button) button.disabled = true;
    if (status) {
        status.textContent = 'Se salvează...';
        status.className = '';
    }
    try {
        const { data, error } = await supabaseClient.auth.updateUser({
            data: { display_name: displayName }
        });
        if (error) throw error;
        if (!data.user) throw new Error('Supabase nu a returnat profilul actualizat.');

        currentUser = data.user;
        updateUI({user:data.user,access_token:window.tikInteractAccessToken});
        const heading = document.getElementById('account-display-name');
        const avatar = document.getElementById('account-avatar-display');
        if (heading) heading.textContent = displayName;
        if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase();
        if (status) {
            status.textContent = 'Numele a fost salvat.';
            status.className = 'is-success';
        }
    } catch (error) {
        console.error('Could not save account display name:', error);
        if (status) {
            status.textContent = `Nu am putut salva numele: ${error.message}`;
            status.className = 'is-error';
        }
    } finally {
        if (button) button.disabled = false;
    }
}

// Autentificare Google OAuth
async function loginWithGoogle() {
    if (!supabaseClient) return alert((window.TikInteractLanguage?.translate ?? (value=>value))("Supabase nu este încărcat."));
    if (shouldOpenLiveFromUrl) {
        try {
            sessionStorage.setItem('tikinteract-live-return', requestedLiveGame || document.getElementById('live-game-select')?.value || 'studio');
            if(requestedStudioSection==='subscription')sessionStorage.setItem('tikinteract-studio-return',JSON.stringify({section:'subscription',plan:requestedStudioPlan}));
        } catch (error) {
            console.error('Could not preserve the selected game through Google sign-in:', error);
            return alert((window.TikInteractLanguage?.translate ?? (value=>value))('Nu am putut păstra jocul selectat. Încearcă autentificarea prin e-mail.'));
        }
    }
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    if (error) {
        if (shouldOpenLiveFromUrl) {sessionStorage.removeItem('tikinteract-live-return');sessionStorage.removeItem('tikinteract-studio-return');}
        alert((window.TikInteractLanguage?.translate ?? (value=>value))("Eroare logare Google: " + error.message));
    }
}

async function loginWithEmail() {
    if (!supabaseClient) return alert((window.TikInteractLanguage?.translate ?? (value=>value))("Supabase nu este încărcat."));
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return alert((window.TikInteractLanguage?.translate ?? (value=>value))("Completează emailul și parola!"));

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        showEmailAuthStatus(`Eroare la logare: ${error.message}`, true);
    } else {
        clearEmailAuthStatus();
    }
}

async function requestPasswordReset() {
    if (!supabaseClient) {
        showEmailAuthStatus('Autentificarea nu este disponibilă momentan. Reîncarcă pagina și încearcă din nou.', true);
        return;
    }

    const emailInput = document.getElementById('auth-email');
    const email = emailInput?.value.trim();
    if (!email) {
        showEmailAuthStatus('Introdu adresa de e-mail a contului, apoi apasă din nou „Ai uitat parola?”.', true);
        emailInput?.focus();
        return;
    }
    if (!emailInput.checkValidity()) {
        showEmailAuthStatus('Introdu o adresă de e-mail validă.', true);
        emailInput.focus();
        return;
    }

    const status = document.getElementById('auth-email-status');
    if (status) {
        status.textContent = 'Se trimite linkul de recuperare...';
        status.className = 'text-xs leading-relaxed text-zinc-400';
    }

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}${window.location.pathname}`
        });
        if (error) throw error;
        if (status) {
            status.textContent = 'Dacă există un cont cu această adresă, vei primi un e-mail cu linkul de recuperare. Verifică și folderul Spam.';
            status.className = 'text-xs leading-relaxed text-green-400';
        }
    } catch (error) {
        console.error('Could not send password recovery email:', error);
        showEmailAuthStatus(`Nu am putut trimite linkul de recuperare: ${error.message}`, true);
    }
}

function showPasswordRecoveryForm() {
    isPasswordRecovery = true;
    document.getElementById('email-auth-options')?.classList.add('hidden');
    document.getElementById('password-recovery-success')?.classList.add('hidden');
    const recoveryForm = document.getElementById('password-recovery-form');
    recoveryForm?.classList.remove('hidden');
    const status = document.getElementById('password-recovery-status');
    if (status) {
        status.textContent = 'Alege o parolă nouă pentru contul tău.';
        status.className = 'text-xs leading-relaxed text-zinc-400';
    }
    document.getElementById('auth-modal')?.classList.remove('hidden');
    document.getElementById('new-auth-password')?.focus();
}

async function updateRecoveredPassword() {
    if (!supabaseClient) {
        setPasswordRecoveryStatus('Autentificarea nu este disponibilă momentan. Reîncarcă pagina și încearcă din nou.', true);
        return;
    }

    const passwordInput = document.getElementById('new-auth-password');
    const confirmInput = document.getElementById('confirm-auth-password');
    const password = passwordInput?.value || '';
    if (password.length < 6) {
        setPasswordRecoveryStatus('Parola trebuie să aibă cel puțin 6 caractere.', true);
        passwordInput?.focus();
        return;
    }
    if (password !== confirmInput?.value) {
        setPasswordRecoveryStatus('Parolele nu coincid. Verifică cele două câmpuri.', true);
        confirmInput?.focus();
        return;
    }

    try {
        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) throw error;
        isPasswordRecovery = false;
        passwordInput.value = '';
        confirmInput.value = '';
        document.getElementById('password-recovery-form')?.classList.add('hidden');
        document.getElementById('password-recovery-success')?.classList.remove('hidden');
    } catch (error) {
        console.error('Could not update password after recovery:', error);
        setPasswordRecoveryStatus(`Nu am putut schimba parola: ${error.message}`, true);
    }
}

function setPasswordRecoveryStatus(message, isError = false) {
    const status = document.getElementById('password-recovery-status');
    if (!status) return;
    status.textContent = message;
    status.className = `text-xs leading-relaxed ${isError ? 'text-amber-400' : 'text-zinc-400'}`;
}

function showEmailAuthStatus(message, isError = false, isSuccess = false) {
    const status = document.getElementById('auth-email-status');
    if (!status) return;
    status.textContent = message;
    status.className = `text-xs leading-relaxed ${isError ? 'text-amber-400' : isSuccess ? 'text-green-400' : 'text-zinc-400'}`;
}

function clearEmailAuthStatus() {
    const status = document.getElementById('auth-email-status');
    if (!status) return;
    status.textContent = '';
    status.className = 'hidden text-xs leading-relaxed text-zinc-400';
}

async function signUpWithEmail() {
    if (!supabaseClient) return alert((window.TikInteractLanguage?.translate ?? (value=>value))("Supabase nu este încărcat."));
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return alert((window.TikInteractLanguage?.translate ?? (value=>value))("Completează emailul și parola!"));

    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) showEmailAuthStatus(`Eroare la creare cont: ${error.message}`, true);
    else showEmailAuthStatus('Cont creat cu succes! Verifică e-mailul dacă ți se cere confirmarea, apoi autentifică-te.', false, true);
}

async function logoutUser() {
    if (supabaseClient) {
        if (isStudioPage && typeof disconnectTikTokConnection === 'function') disconnectTikTokConnection();
        if (typeof finishPlatformLiveSession === 'function') {
            await finishPlatformLiveSession();
        }
        await supabaseClient.auth.signOut();
        switchView('home');
    }
}

function switchView(view) {
    const views = ['home','catalog','streams','leaderboard','play-pass','account'];
    if(view==='play-pass'){openStudioSubscription();return;}
    if (view === 'live') {
        if (!currentUser) { shouldOpenLiveFromUrl = true; openAuthModal(); return; }
        if (!isStudioPage) { window.location.assign(studioUrl(requestedLiveGame)); return; }
        return;
    }
    if (!views.includes(view)) return;
    if (isStudioPage) {
        window.location.assign('index.html' + (view === 'home' ? '' : '?view=' + view));
        return;
    }
    if (view === 'account' && !currentUser) { pendingAccountRoute = true; openAuthModal(); return; }
    views.forEach(name => document.getElementById('view-' + name)?.classList.toggle('hidden', name !== view));
    setActiveNavigation(view);
    if (typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('tikinteract:view',{detail:{view}}));
    history.replaceState(null, '', 'index.html' + (view === 'home' ? '' : '?view=' + view));
    if (view === 'streams' && typeof loadLiveStreams === 'function') loadLiveStreams();
    if (view === 'leaderboard') loadLeaderboard();
    if (view === 'home') {
        loadHomeLeaderboard();
        if (typeof loadHomeStreamsPreview === 'function') loadHomeStreamsPreview();
    }
    window.scrollTo({top:0, behavior:'smooth'});
}

function openCookiePreferences() {
    const modal = document.getElementById('cookie-preferences-modal');
    if (!modal) return;
    cookiePreferencesPreviousFocus = document.activeElement;
    modal.classList.remove('hidden');
    modal.querySelector('button')?.focus();
}

function closeCookiePreferences() {
    const modal = document.getElementById('cookie-preferences-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    cookiePreferencesPreviousFocus?.focus();
    cookiePreferencesPreviousFocus = null;
}

let paidLaunchSequence = 0;
window.addEventListener('tikinteract:auth', () => {paidLaunchSequence++;});
function loadLiveGame(gameId, verified = false) {
    const accessRequest = verified ? paidLaunchSequence : ++paidLaunchSequence;
    if (!currentUser) { openAuthModal(); return false; }
    const gamePath = window.TikInteractPlatform?.getGame(gameId)?.entryPath || LIVE_GAME_PATHS[gameId];
    const gameFrame = document.getElementById('live-game-frame');
    const gameSelect = document.getElementById('live-game-select');
    const gameStatus = document.getElementById('live-game-status');
    if (!gameFrame || !gamePath) return false;
    if (window.TikInteractAccount && !window.TikInteractAccount.isAllowed()) {
        if (gameStatus) gameStatus.textContent = 'Contul trebuie verificat înainte de pornirea jocului.';
        window.TikInteractAccount.showNotice();
        return false;
    }
    if (!window.TikInteractGameAccess?.isAvailable(gameId)) {
        if (gameSelect) gameSelect.value = gameFrame.dataset.gameId || '';
        document.querySelectorAll('[data-live-game]').forEach((button) => {
            const selected = button.dataset.liveGame === gameSelect?.value;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        if (gameStatus) gameStatus.textContent = window.TikInteractGameAccess?.getLockMessage(gameId)
            || 'Jocul nu este disponibil.';
        return false;
    }

    if (window.TikInteractGameAccess.getPlan(gameId) !== 'free' && !verified) {
        const userId = currentUser.id;
        if (gameStatus) gameStatus.textContent = 'Verificăm accesul la joc…';
        if (!supabaseClient) return false;
        supabaseClient.rpc('check_game_access', {p_game: gameId}).then(({data, error}) => {
            if (accessRequest !== paidLaunchSequence || currentUser?.id !== userId) return;
            if (error || data !== true) {
                if (gameStatus) gameStatus.textContent = 'Accesul nu a putut fi confirmat. Verifică perioada în PLAY PASS.';
                window.TikInteractPass?.refresh();
                return;
            }
            if (loadLiveGame(gameId, true)) window.setLiveStudioTab?.('studio');
        }).catch(() => {if (accessRequest === paidLaunchSequence && currentUser?.id === userId && gameStatus) gameStatus.textContent = 'Nu am putut verifica accesul. Încearcă din nou.';});
        return false;
    }
    if (gameSelect && gameSelect.value !== gameId) gameSelect.value = gameId;
    document.querySelectorAll('[data-live-game]').forEach((button) => {
        const selected = button.dataset.liveGame === gameId;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    if (gameFrame.dataset.gameId === gameId) return true;

    gameFrame.hidden = false;
    gameFrame.parentElement.classList.remove('is-empty');
    const emptyState = document.getElementById('studio-game-empty');
    if (emptyState) emptyState.hidden = true;
    const testStatus = document.querySelector('.studio-test-status');
    if (testStatus) testStatus.hidden = false;
    resetStudioTestMenu();
    gameFrame.dataset.gameId = gameId;
    gameFrame.title = `${gameSelect?.selectedOptions[0]?.textContent || 'TikTok LIVE'} — joc LIVE`;
    gameFrame.setAttribute('aria-busy', 'true');
    if (gameStatus) gameStatus.textContent = 'Se încarcă jocul selectat…';
    let completed = false;
    const complete = (viewport) => {
        if (gameFrame.dataset.gameId !== gameId) return;
        window.TikInteractStudioLayout?.fitGame(viewport);
        if (completed) { if(gameFrame.contentWindow?.TikInteractStudioControls)initializeStudioTestMenu();return; }
        completed = true;
        gameFrame.removeAttribute('aria-busy');
        initializeStudioTestMenu();
        if (gameStatus) gameStatus.textContent = 'Jocul este încărcat. Folosește Pornește Conexiunea Live pentru comentarii, like-uri și cadouri.';
    };
    const token = window.TikInteractLive?.prepare(gameFrame, complete);
    window.TikInteractStudioLayout?.fitGame({width:540, height:960});
    gameFrame.onload = () => {
        window.TikInteractLive?.loaded(gameFrame);
        complete();
    };
    const gameUrl = new URL(gamePath, location.href);
    if (token) gameUrl.searchParams.set('tikinteractHost', token);
    gameUrl.searchParams.set('lang', window.TikInteractLanguage?.get() || 'ro');
    gameUrl.searchParams.set('format', window.TikInteractStudioLayout?.getFormat?.() || 'portrait');
    gameFrame.src = gameUrl.href;
    window.updateCurrentLiveGame?.(gameId);
    return true;
}

function setActiveNavigation(activeItem) {
    document.querySelectorAll('[data-nav-item]').forEach((item) => {
        const isActive = item.dataset.navItem === activeItem;
        item.classList.toggle('is-active', isActive);
        if (isActive) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
    });
}

function checkAccessAndGo(view) {
    if (view === 'live') { requestedStudioSection='';requestedStudioPlan='';switchView('live'); return; }
    if (!currentUser) {
        openAuthModal();
    } else {
        switchView(view);
    }
}

function goToPlayPass() {
    openStudioSubscription();
}

function openStudioSubscription(plan='') {
    const chosen=['free','play_pass','play_pass_pro'].includes(plan)?plan:'';
    if(isStudioPage){window.TikInteractCreator?.openAccountSection('subscription',chosen);return;}
    requestedStudioSection='subscription';requestedStudioPlan=chosen;requestedLiveGame=null;pendingAccountRoute=false;
    shouldOpenLiveFromUrl=true;
    if(!currentUser){openAuthModal();return;}
    switchView('live');
}

function syncTikTokAccount() {
    const input = document.getElementById('tiktok-user');
    const status = document.getElementById('tiktok-sync-status');
    if (!input) return;

    const username = input.value.trim();
    if (!username) {
        alert((window.TikInteractLanguage?.translate ?? (value=>value))('Introdu username-ul TikTok pentru sincronizare.'));
        return;
    }

    const normalized = username.startsWith('@') ? username : '@' + username;
    input.value = normalized;

    if (typeof saveTikTokProfileFromSettings === 'function') {
        saveTikTokProfileFromSettings();
    }
}

function clearTikTokAccount() {
    const input = document.getElementById('tiktok-user');
    const status = document.getElementById('tiktok-sync-status');
    if (typeof cancelPendingTikTokProfile === 'function') cancelPendingTikTokProfile();
    if (typeof disconnectTikTokConnection === 'function') disconnectTikTokConnection();
    if (typeof clearStreamerProfile === 'function') clearStreamerProfile();
    if (input) input.value = '';
    try {
        localStorage.removeItem('tikinteract_tiktok_user');
    } catch (err) {
        console.warn('Local storage unavailable:', err);
    }
    if (status) {
        status.textContent = 'Stare: neconectat';
        status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500';
    }
}

function restoreTikTokState() {
    const input = document.getElementById('tiktok-user');
    const status = document.getElementById('tiktok-sync-status');
    if (!input || !status) return;

    try {
        const savedUser = localStorage.getItem('tikinteract_tiktok_user');
        if (savedUser?.replace(/^@/, '').toLowerCase() === 'numele_tau') localStorage.removeItem('tikinteract_tiktok_user');
        if (savedUser && savedUser.replace(/^@/, '').toLowerCase() !== 'numele_tau') {
            input.value = savedUser;
            status.textContent = 'Stare: neconectat';
            status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500';
            return;
        }
    } catch (err) {
        console.warn('Local storage unavailable:', err);
    }

    input.value = '';
    status.textContent = 'Stare: neconectat';
    status.className = 'mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500';
}

document.addEventListener('DOMContentLoaded', () => {
    restoreTikTokState();
    const footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = String(new Date().getFullYear());
    if (window.location.hash === '#cookie-preferences') openCookiePreferences();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.getElementById('cookie-preferences-modal')?.classList.contains('hidden')) {
        closeCookiePreferences();
    }
});
    
