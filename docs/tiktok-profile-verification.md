# Verificarea profilului TikTok

Profilul TikTok se salvează numai după confirmarea existenței lui pe server. Nu se publică un nume introdus în formular, un draft din localStorage sau textul `numele_tau`. Această verificare privește profilul TikTok asociat și clasamentul; autentificarea în platformă rămâne prin e-mail sau Google.

## Activare în proiectul Supabase existent

1. Deschide **SQL Editor → New query**. Copiază tot fișierul `supabase/tiktok_profile_verification.sql` și apasă **Run**. Tabelele de clasament din `leaderboard.sql` trebuie să fie deja instalate. Migrarea poate fi rulată din nou.
2. Deschide **Edge Functions → Deploy a new function → Via Editor**. Numește funcția exact **verify-tiktok-profile**. Înlocuiește exemplul din editor cu tot conținutul fișierului `supabase/functions/verify-tiktok-profile/index.ts`, apoi apasă **Deploy**. Fișierul este independent și nu cere instalarea unor pachete. Dacă editorul afișează opțiunea de verificare JWT, las-o activată. Funcția verifică suplimentar sesiunea prin Supabase Auth.
3. Publică fișierele actualizate ale site-ului prin fluxul obișnuit. În Studio, introdu username-ul și apasă bifa **Verifică și salvează profilul TikTok**.

Supabase furnizează funcției `SUPABASE_URL`, `SUPABASE_ANON_KEY` și `SUPABASE_SERVICE_ROLE_KEY` în mediul serverului. Cheia de serviciu nu se copiază în site, în formular sau în configurația publică. Dacă funcția nu este instalată ori nu poate confirma profilul, salvarea este oprită.

Alternativ, cu Supabase CLI autentificat și proiectul asociat: `supabase functions deploy verify-tiktok-profile`. SQL-ul se rulează separat, ca mai sus.

## Comportament

- Confirmarea folosește datele structurate ale profilului public TikTok: username identic și ID de cont. HTTP 200, titlul paginii, avatarul, captcha sau o pagină de autentificare nu sunt suficiente. Un cont poate exista chiar dacă nu este LIVE sau nu are avatar.
- TikTok poate bloca temporar verificarea. Se afișează că profilul nu poate fi confirmat; nu se afirmă că acel cont nu există și nu se salvează un profil provizoriu.
- Doar funcția server poate crea confirmarea, pentru utilizatorul autentificat. Confirmarea din baza de date expiră după 10 minute; interfața reutilizează aceeași verificare cel mult 5 minute. Rezultatele pentru un cont nu se folosesc pentru alt cont. Sunt permise maximum 30 de verificări pe oră pentru fiecare utilizator, la minimum 3 secunde distanță.
- RPC-ul existent `save_my_streamer_profile` cere confirmarea și folosește numele/poza obținute de server. Apelurile directe neconfirmate sunt respinse. Pornirea unei sesiuni de clasament cere aceeași confirmare; sesiunile deja pornite își pot salva activitatea în continuare.
- Resetarea formularului sau schimbarea contului invalidează verificările în curs din interfață. Numele nu se salvează în localStorage înainte de confirmare și salvare.
- Profilul vechi `numele_tau` devine nepublic; nu se șterg conturi, sesiuni sau cadouri. Interfața exclude deja acel text de exemplu din clasament.
- Existența unui profil nu este dovadă că utilizatorul îl deține. Pentru dovada proprietății ar fi necesară asocierea prin TikTok Login Kit, separat de această verificare.

## Verificări locale

`node --test tests/tiktok-profile-verification.test.js` verifică parsarea, erorile TikTok, autentificarea funcției, lipsa confirmărilor inventate, regulile PostgreSQL reale, accesul direct interzis, expirarea, rate limiting și schimbarea contului.

`node scripts/verify-tiktok-profile.mjs` verifică formularul real în browser cu identități și răspunsuri simulate. Nu conectează TikTok și nu modifică Supabase.

Documentație: [Supabase Edge Functions – autentificare](https://supabase.com/docs/guides/functions/auth), [secrete disponibile pe server](https://supabase.com/docs/guides/functions/secrets).
