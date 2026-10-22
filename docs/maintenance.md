# Mentenanță și invitații de previzualizare

Implementarea folosește autentificarea, jocurile, permisiunile și abonamentele existente. Nu se face deploy automat și nu se modifică nicio cheie existentă.

## Instalare pe Vercel

1. În Supabase → SQL Editor rulează **`supabase/maintenance.sql`**, după instalatorul existent `supabase/install-admin.sql`. Este suficient fișierul nou dacă administrarea, utilizatorii și cheile de acces sunt deja instalate. Instalarea este rerulabilă; mentenanța pornește **dezactivată**, fără schimbarea conturilor sau abonamentelor existente.
2. În proiectul Vercel → Settings → Environment Variables adaugă **`SUPABASE_SERVICE_ROLE_KEY`**, cu valoarea cheii secrete `service_role` a **aceluiași proiect Supabase** din `assets/supabase-config.json`. Selectează mediile pe care le folosești (Production și, dacă dorești, Preview). Cheia rămâne doar pe server: nu o pune în fișiere HTML/JS, în Git sau în variabile cu prefix public.
3. Publică manual această versiune pe Vercel. Modificarea variabilelor necesită o nouă publicare pentru a fi disponibilă funcțiilor serverului.
4. Intră în **Administrare → Mentenanță și invitații** cu un cont cu gradul **Proprietar**. Apasă **Activează mentenanța**. Înainte să închidă site-ul, serverul îți stabilește automat sesiunea de proprietar.
5. Verifică într-o fereastră privată: site-ul, Studio și adresele directe ale jocurilor afișează mentenanța. Sesiunea proprietarului continuă să funcționeze.

Pe Vercel, dacă secretul sau verificarea bazei de date lipsește, protecția nu livrează paginile private: se afișează mentenanța. Pagina publică de mentenanță și autentificarea proprietarului rămân accesibile. Cu backendul neconfigurat, codurile nu se pot genera sau activa; finalizează pașii 1–3.

Documentație oficială: [Vercel Routing Middleware](https://vercel.com/docs/routing-middleware/getting-started), [creare administrativă de utilizatori Supabase](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [generare de linkuri Auth](https://supabase.com/docs/reference/javascript/auth-admin-generatelink).

## Invită un tester fără înregistrare

- Alege un nume, durata accesului (1–168 ore), nivelul de jocuri și perioada în care codul poate fi activat (1, 7 sau 30 de zile).
- Codul și linkul sunt afișate **o singură dată**, imediat după generare. Copiază-le înainte să părăsești secțiunea. Baza de date păstrează numai amprenta SHA-256 a codului.
- Linkul deschide pagina cu invitația completată. Vizitatorul apasă **Activează invitația**. Deschiderea linkului printr-un simplu GET sau previzualizarea lui de către o aplicație de mesagerie nu consumă codul.
- La activare se creează o identitate Auth temporară, cu un e-mail intern nerecuperabil și metadate impuse de server. Nu se trimit e-mailuri, nu se solicită o parolă și nu se cere înregistrare.
- Vizitatorul primește propria sesiune și propriile date. Poate folosi jocurile reale, configurările și Studio, inclusiv funcțiile LIVE existente când își configurează conexiunea. Nu primește administrare sau acces la contul proprietarului.
- Nivelurile Play Pass sunt acordate numai acestei identități pentru durata exactă a invitației, prin mecanismul existent de acces. Nu se schimbă prețurile, facturarea sau abonamentele utilizatorilor reali.
- Codul poate activa o singură sesiune inițială. Reîncărcarea paginii nu consumă un alt cod. În același browser, o sesiune Auth pierdută poate fi refăcută prin cookie-ul de previzualizare cât acesta este valabil.
- La expirare, revocare sau deconectarea invitatului, accesul temporar se închide. Un alt tester are nevoie de altă invitație. Nu se șterg automat conturi sau date; identitățile temporare pot fi șterse ulterior de proprietar prin administrarea existentă a utilizatorilor.

Codul/linkul este o credențială de acces: persoana care îl activează prima primește accesul. Nu reprezintă verificarea identității reale a vizitatorului.

## Proprietar

Butonul **Acces proprietar** de pe pagina de mentenanță folosește contul existent (e-mail/parolă sau Google). Numai gradul `owner` primește acces complet și poate genera/revoca invitații. O sesiune de acces a proprietarului durează 24 de ore; autentificarea normală Supabase rămâne separată și se reînnoiește prin mecanismul existent.

Pentru Google, permite în Supabase → Authentication → URL Configuration adresa de întoarcere `https://DOMENIUL-TAU/maintenance.html` și, conform regulilor URL ale proiectului, varianta cu parametri. Nu modifica providerii sau cheile existente. Proprietarul deja autentificat poate primi automat accesul de mentenanță.

**Deschide site-ul publicului** dezactivează blocarea imediat, fără să modifice sesiunile sau abonamentele conturilor reale. Invitațiile rămân temporare chiar dacă mentenanța este dezactivată.

## Protecția efectivă

- `middleware.js` verifică accesul înaintea livrării paginilor și fișierelor statice pe Vercel. Nu există excepție generală pentru `/GAME`, Studio sau `/assets`.
- `/api/maintenance` verifică rolul proprietarului prin RPC-uri Supabase autorizate. Numai această funcție server folosește cheia secretă pentru crearea contului invitat.
- Accesul folosește un cookie aleator opac, `HttpOnly`, `Secure` pe HTTPS, `SameSite=Lax`, verificat în baza de date. Cookie-ul nu conține cheia Supabase, codul invitației sau tokenul Auth. Răspunsurile private nu se cachează.
- Activarea codului este atomică; încercările eșuate sunt limitate pe server. Codul este în fragmentul linkului, nu în URL-ul trimis serverului. Operațiile care schimbă starea cer POST din aceeași origine.
- La mentenanță, conturile obișnuite nu primesc acces Studio. Proprietarul și invitații activi rămân autorizați. Baza de date păstrează moderarea existentă și verifică expirarea inclusiv la accesul direct prin RLS/RPC.
- Pagina deja deschisă verifică accesul la 15 secunde și la revenirea în filă. La pierderea accesului oprește Studio și închide iframe-urile. Conectorul LIVE păstrează verificările existente la 10 secunde; termenul invitației limitează și cache-ul de autorizare.
- Doar fișierele minimale ale paginii de mentenanță (fonturi, branding, preferințe și configurația publică Auth) sunt accesibile fără invitație.

## Server local

Fără secret, `node server.js` continuă să funcționeze ca server local privat, legat la `127.0.0.1`. Pentru aceeași protecție pe serverul local, pornește cu `SUPABASE_SERVICE_ROLE_KEY` în mediul procesului. Cu Node recent poți folosi un fișier local `.env`, exclus din Git, și `node --env-file=.env server.js`.

`TIKINTERACT_MAINTENANCE=1` oferă comportament închis și local dacă backendul nu este configurat. Nu este necesar pe Vercel.

După reinstalarea scripturilor vechi de utilizatori, rulează din nou `maintenance.sql`: acestea pot restabili funcțiile de autorizare fără verificarea invitațiilor. Pentru tabele RLS noi, rerularea adaugă și regula restrictivă de expirare.

## Verificări

`node --test tests/maintenance.test.js tests/studio-auth.test.js tests/site-routing.test.js`

Testele folosesc PostgreSQL în memorie și autentificare simulată exclusiv în test. Verifică permisiunile proprietarului, generarea, consumarea, refacerea sesiunii, expirarea, revocarea, limitele de încercări, RLS, linkurile directe și indisponibilitatea backendului. Niciun cont de producție nu este creat în timpul testelor.
