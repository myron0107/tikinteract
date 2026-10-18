// Disposable browser-only identities. No account is created and no real LIVE is opened.
export function installQAAuth(defaultSignedIn = true) {
    const user = {id:'local-layout-test',email:'layout@example.invalid',user_metadata:{display_name:'Layout test'},app_metadata:{provider:'email'}};
    const listeners = new Set();
    let stored;
    try {stored=sessionStorage.getItem('tikinteract-qa-auth');} catch {}
    let session = (stored === null ? defaultSignedIn : stored === '1') ? {user,access_token:'isolated-browser-test-token'} : null;
    const setSession = signedIn => {
        session = signedIn ? {user,access_token:'isolated-browser-test-token'} : null;
        sessionStorage.setItem('tikinteract-qa-auth',signedIn?'1':'0');
        for (const callback of listeners) callback(signedIn?'SIGNED_IN':'SIGNED_OUT',session);
    };
    const client = {
        auth: {
            async getSession(){return{data:{session},error:null};},
            onAuthStateChange(callback){listeners.add(callback);return{data:{subscription:{unsubscribe(){listeners.delete(callback);}}}};},
            async signOut(){setSession(false);return{error:null};},
            async signInWithPassword(){setSession(true);return{data:{session},error:null};}
        },
        async rpc(name){return{data:name==='get_streamer_gift_collection'?null:name.startsWith('get_')?[]:null,error:null};},
        from(){return{select(){return{eq(){return{async maybeSingle(){return{data:null,error:null};}}}}}};}
    };
    Object.defineProperty(window,'supabase',{configurable:true,get:()=>({createClient:()=>client}),set(){}});
    window.__qaSignIn=()=>setSession(true);
    window.__qaSignOut=()=>setSession(false);
    window.__qaSockets=[];
    class IsolatedSocket extends EventTarget {
        static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
        constructor(){super();this.readyState=0;window.__qaSockets.push(this);queueMicrotask(()=>{if(this.readyState!==0)return;this.readyState=1;this.dispatchEvent(new Event('open'));});}
        send(){}
        close(){if(this.readyState===3)return;this.readyState=3;this.dispatchEvent(new CloseEvent('close'));}
    }
    window.WebSocket=IsolatedSocket;
}
