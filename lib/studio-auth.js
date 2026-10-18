// Validate access tokens with Supabase Auth before allowing local Studio commands.
export function createStudioAuthenticator({url, anonKey, fetchImpl = fetch, now = Date.now}) {
    function isAuthorized(socket) {
        return !!socket.studioAuth && socket.studioAuth.expiresAt > now();
    }

    async function authorize(socket, token) {
        if (typeof token !== 'string' || token.length < 20 || token.length > 7000) return false;
        if (socket.studioAuth?.token === token && isAuthorized(socket) && socket.studioAuth.checkedUntil > now()) return true;
        if (socket.studioAuthPending?.token === token) return socket.studioAuthPending.promise;
        const promise = (async () => {
            try {
                const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
                if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= now()) return false;
                const response = await fetchImpl(`${url}/auth/v1/user`, {
                    headers: {apikey: anonKey, Authorization: `Bearer ${token}`},
                    signal: AbortSignal.timeout(8000)
                });
                if (!response.ok) return false;
                const user = await response.json();
                if (!user?.id || user.is_anonymous === true) return false;
                socket.studioAuth = {token, userId: user.id, expiresAt: claims.exp * 1000, checkedUntil: now() + 60000};
                return isAuthorized(socket);
            } catch {
                return false;
            }
        })();
        socket.studioAuthPending = {token, promise};
        try { return await promise; }
        finally { if (socket.studioAuthPending?.promise === promise) delete socket.studioAuthPending; }
    }

    return {authorize, isAuthorized};
}
