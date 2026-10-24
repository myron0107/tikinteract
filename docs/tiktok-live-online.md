# TikTok LIVE din site

Studio folosește `wss://<domeniul paginii>/api/live`, nu portul 3000 de pe calculatorul vizitatorului. În previzualizarea statică pe localhost folosește domeniul public TikInteract. Nu este necesar TikFinity sau `start-tikinteract.bat` pentru utilizatorii site-ului public.

## Publicare / activare

1. Publică modificările proiectului, inclusiv `api/live.js`, `lib/live-socket-session.js` și `vercel.json`.
2. În proiectul Vercel verifică **Settings → Functions → Fluid Compute**. WebSocket-urile necesită Fluid Compute. Endpointul Node exportă serverul HTTP conform documentației Vercel și are `maxDuration: 300`.
3. Conturile sunt verificate server-side cu configurația Supabase deja existentă. Nu se trimit parole sau cookie-uri TikTok. Nu trebuie introduse chei private în browser.
4. Verifică `https://tikinteract.vercel.app/api/live`: un GET HTTP trebuie să întoarcă `{service:"tiktok-live",transport:"websocket"}`. Apoi testează din Studio cu un cont TikTok care transmite LIVE, verificând logurile funcției Vercel dacă platforma TikTok refuză conexiunea.
5. Salvarea profilului folosește în continuare funcția existentă `verify-tiktok-profile` și RPC-ul securizat `save_my_streamer_profile`; necesită instalarea existentă `supabase/tiktok_profile_verification.sql`. Verificarea profilului și salvarea fotografiei nu depind de faptul că persoana transmite LIVE. TikTok poate bloca verificarea publică; în acest caz interfața arată eroarea și nu pretinde că profilul s-a salvat.

## Funcționare

- Fiecare WebSocket are propria conexiune TikTok, stare și normalizator de evenimente. Nu există broadcast global între conturi.
- Conectarea se inițiază la apăsarea butonului; simpla deschidere a Studio nu pornește sesiuni LIVE online.
- Evenimentele chat, like, gift și audience folosesc formatul deja consumat de jocuri, sunete și animații.
- Serverul închide o conexiune la 270 secunde, înaintea duratei maxime. Browserul reface conexiunea și reia username-ul selectat cu backoff, maximum 5 încercări consecutive. Oprirea manuală, refuzul de autentificare și încheierea LIVE-ului opresc reluarea. Nu se reiau cadourile istorice (`processInitialData:false`).
- Tokenul Supabase curent este transmis prin mesaj WebSocket, niciodată în URL. Reînnoirea sesiunii ajunge la socketul deschis; drepturile se reverifică pe server. Eșecul LIVE nu deconectează contul site-ului.
- Starea este per conexiune, fără Redis sau alte servicii noi. Reconectarea reface abonarea la TikTok; nu promite recuperarea evenimentelor emise în intervalul de întrerupere. Mai multe taburi pot deschide conexiuni independente și pot consuma separat limitele TikTok. Pentru sesiuni fără rotații și recuperare garantată este necesar un serviciu persistent și coordonare între instanțe.
- Profilul și fotografia verificate se salvează în Supabase. Un mesaj LIVE fără avatar nu șterge fotografia deja încărcată. URL-urile avatarurilor TikTok pot expira; salvarea profilului reface verificarea după expirarea cache-ului.

## Limite și verificări

Conectorul existent este neoficial și folosește semnarea comunitară Euler Stream; TikTok poate refuza accesul sau aplica limite. Nu s-a configurat vreun serviciu plătit și nu s-au schimbat cheile, prețurile, Stripe sau schema Supabase. Funcțiile Vercel au consumul normal de CPU/memorie/trafic al proiectului.

Testele automate folosesc conexiuni TikTok simulate doar în teste și verifică autorizarea, izolarea a doi utilizatori, anularea conectării lente, rotația funcției, reconectarea, oprirea în engleză, păstrarea autentificării și persistența fotografiei. Activarea reală necesită publicare și un test cu LIVE pornit; un test local nu dovedește accesul din IP-urile Vercel la TikTok.

Surse: [Vercel WebSocket / Fluid Compute](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections), [TikTok LIVE Connector](https://github.com/zerodytrash/TikTok-Live-Connector).
