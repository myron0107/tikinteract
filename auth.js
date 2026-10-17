const SUPABASE_URL = 'https://licrwrvqicreywprlafu.supabase.co';     
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpY3J3cnZxaWNyZXl3cHJsYWZ1Ikwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTA0MDAsImV4cCI6MjEwNzgyNjQwMH0.2s7EaJ6ODXqNIBs2ItUwOtxHqRetI1tOpx1wJS_7smQ'; 

let supabase = null;

function switchView(view) {
    const catalog = document.getElementById('view-catalog');
    const dashboard = document.getElementById('view-dashboard');
    if (catalog && dashboard) {
        if (view === 'catalog') {
            catalog.classList.remove('hidden');
            dashboard.classList.add('hidden');
        } else {
            catalog.classList.add('hidden');
            dashboard.classList.remove('hidden');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
}

function updateUIState(session) {
    const btnAuthNav = document.getElementById('btn-auth-nav');
    const userProfileNav = document.getElementById('user-profile-nav');
    const userEmailDisplay = document.getElementById('user-email-display');

    if (session && session.user) {
        if (btnAuthNav) btnAuthNav.classList.add('hidden');
        if (userProfileNav) userProfileNav.classList.remove('hidden');
        if (userEmailDisplay) userEmailDisplay.innerText = session.user.email;
    } else {
        if (btnAuthNav) btnAuthNav.classList.remove('hidden');
        if (userProfileNav) userProfileNav.classList.add('hidden');
    }
}

async function loginWithGoogle() {
    if(!supabase) return alert("Supabase nu este inițializat.");
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if(error) alert("Eroare Supabase: " + error.message);
}

async function loginWithEmail() {
    if(!supabase) return alert("Supabase nu este inițializat.");
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return alert("Introdu e-mailul și parola!");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) alert("Eroare autentificare: " + error.message); else closeAuthModal();
}

async function signUpWithEmail() {
    if(!supabase) return alert("Supabase nu este inițializat.");
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return alert("Introdu e-mailul și parola!");
    const { error } = await supabase.auth.signUp({ email, password });
    if(error) alert("Eroare creare cont: " + error.message); else alert("Cont creat cu succes!");
}

async function logoutUser() {
    if(supabase) await supabase.auth.signOut();
}

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.supabase !== 'undefined') {
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { session } } = await supabase.auth.getSession();
            updateUIState(session);

            supabase.auth.onAuthStateChange((_event, session) => {
                updateUIState(session);
            });
        } catch(e) {
            console.log("Supabase error: ", e);
        }
    }
});