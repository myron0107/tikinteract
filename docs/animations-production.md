# ANIMAȚII — integrare reală, activare controlată

Branch: `codex/animations-production`. Fără deploy, fără modificări în Supabase
online, fără plăți Stripe sau generări fal.ai reale executate de agent.

## Audit și integrare

Platforma existentă este HTML/CSS/JavaScript cu module ES, fără framework de
interfață. `live-studio.html` conține structura statică Studio; `game.js` conduce
navigarea, jocurile și conexiunea locală. `assets/site-app.js` gestionează sesiunea
Supabase, iar modulele creator/account aplică permisiunile existente. Serverul
local `server.js` normalizează evenimentele și browserul emite
`tikinteract:live-event`. Backendul public este format din funcții Vercel Node.
Nu s-au schimbat mecanicile jocurilor, autentificarea sau structura altor pagini.

Stripe existent (`lib/billing-service.js`, `supabase/billing.sql`) vinde acces
pentru o lună prin Checkout `mode=payment`, fără reînnoire automată. Nu există un
abonament Stripe recurent de convertit automat. Acest comportament și prețurile
planurilor au fost păstrate. Migrarea nouă acordă un lot lunar AI la fiecare
achiziție de acces confirmată. Nu acordă retroactiv credite conturilor sau cheilor
vechi. Creditele FREE inițiale sunt zero.

Interfața ANIMAȚII păstrează cele patru secțiuni, clasele și temele aprobate.
`studio-animations-entry.js` încarcă acum controllerul real. Modulul DEMO vechi
rămâne în repository ca referință, dar nu este folosit pentru generări. Clipurile
DEMO/localStorage nu sunt convertite în rezultate AI sau credite comerciale.
Ilustrațiile universurilor sunt doar ghid vizual; nu apar ca rezultate generate.

Evenimentele LIVE sunt filtrate local după reguli și trimise în loturi de maximum
20 la două secunde. Nu se face un apel HTTP separat pentru fiecare cadou primit.

## Ce este implementat

- Backend autentificat; FREE, PLAY PASS și PRO folosesc aceeași verificare a
  soldului, fără blocare a generatorului după plan.
- Loturi separate incluse/cumpărate, TEST/live, expirări, registru financiar,
  rezervare și decontare atomice, identificatori idempotenti. Consumul începe cu
  loturile incluse. Test credits nu pot deveni live credits prin schimbarea temei
  sau a configurației. Soldul nu poate fi scris din frontend.
- Checkout pentru pachete configurate pe server; numai webhook-ul Stripe semnat
  confirmă creditarea. Repetările, rambursările parțiale, disputele și inversarea
  ordinii notificărilor sunt tratate. Creditele deja cheltuite și ulterior
  rambursate creează o datorie; generarea se oprește până la regularizare.
  Creditările ulterioare acoperă întâi acea datorie.
- Aprobare umană a fotografiei și descrierii înainte de AI; validare inițială a
  descrierii, consimțământ obligatoriu, siguranța modelelor activată. Aprobarea
  umană nu verifică identitatea sau autenticitatea acordului declarat.
- fal.ai oficial: Queue submit/status/result, în două etape, fără o funcție care
  așteaptă durata generării. SDK-ul are retry propriu pentru coadă; semnalul de
  anulare împiedică retrimiterea unei cereri POST incerte. Cererile incerte merg
  în `review`, fără regenerare automată plătită.
- MP4-ul final este copiat în Storage privat. Linkurile furnizorului nu sunt
  folosite ca bibliotecă permanentă. Descărcare, import MP4, filtrare, fan,
  ștergere, universuri personalizate și reguli persistente.
- Redare manuală și reguli gift/user/coins prin evenimentele LIVE deja
  normalizate în Studio. Dublurile folosesc eventId. Evenimentele declanșează
  exclusiv redare, niciodată AI. Pragul de monede este per eveniment, nu un total
  cumulativ al sesiunii.
- Overlay OBS separat, transparent, URL cu token în fragment, valabil 30 zile,
  revocabil. Tokenul permite numai redarea, nu citirea soldului/generarea.
  Coada are maximum 20 de intrări recente, cu lease pentru a evita redarea dublă
  de către două Browser Sources. La crash nu se repetă automat clipul început.
- Administrare → ANIMAȚII AI: credite lunare, costuri în credite, pachete, bugete,
  comisioane/curs/marjă, oprire de urgență și moderare. Numai owner/admin.

## Supabase — instalare manuală

1. Fă o copie/export al proiectului înainte de instalare.
2. În proiectul Supabase existent, SQL Editor → New query.
3. Fișierele existente `admin.sql`, `users.sql`, `access-keys.sql`, `billing.sql`
   trebuie să fie deja instalate. Nu le reinstala dacă sunt funcționale.
4. Rulează `supabase/animations.sql` integral. Este aditiv și poate fi rerulat.
5. Verifică Storage → `studio-animations`: **Private**. Limita este 100 MB;
   fotografiile au limita server-side de 10 MB. Nu activa Public și nu adăuga
   politici care permit utilizatorilor să scrie solduri sau obiecte liber.

Migrarea creează `animation_settings`, `animation_credit_batches`,
`animation_credit_debts`, `animation_transactions`, `animation_universes`,
`animation_media`, `animation_jobs`, `animation_allocations`, `animation_orders`,
`animation_stripe_accounts`, `animation_stripe_periods`, `animation_rules`,
`animation_overlay_tokens`, `animation_playback`, `animation_rate_limits` și
`animation_storage_cleanup`. Funcțiile financiare sunt numai pentru service_role.
RLS permite contului doar citirea propriilor media/reguli și a universurilor
publice/proprii. Storage se accesează prin URL-uri semnate temporare.

Ștergerea datelor ANIMAȚII se găsește în Istoric credite → Fotografii și date
personale. Păstrează evidența financiară și șterge fotografii/video/prompturi/reguli.
Generările active trebuie încheiate/anulate înainte. Ștergerea unui cont prin
administrarea existentă programează și eliminarea obiectelor private orfane;
workerul trebuie să ruleze pentru a finaliza acea curățare.

## Vercel — variabile de mediu

Nu trimite cheile în chat și nu le pune în HTML/JavaScript public.

Setează variabilele pentru mediul Preview folosit. Modificările din Vercel
Environment Variables se aplică unei noi versiuni publicate manual; nu pornesc
automat configurația în deploymentul existent.

| Variabilă | Valoare / rol |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Secretul server-side existent, același proiect Supabase |
| `PUBLIC_SITE_URL` | Originea exactă, fără path, ex. `https://tikinteract.vercel.app` |
| `STRIPE_SECRET_KEY` | **sk_test_…** pentru prima etapă; cheia existentă |
| `STRIPE_WEBHOOK_SECRET` | **whsec_…** pentru endpointul TEST existent |
| `FAL_KEY` | Cheie fal.ai numai pe backend |
| `ANIMATIONS_PAID_AI_APPROVED` | Inițial **false**; se schimbă numai după aprobarea proprietarului |
| `ANIMATIONS_LIVE_PAYMENTS_APPROVED` | Inițial **false**; nu se activează în această etapă |
| `CRON_SECRET` | Secret aleator, minimum 32 caractere, pentru worker |
| `STRIPE_PLAY_PASS_MONTHLY_PRICE_ID` | Opțional: doar dacă se introduc ulterior abonamente Stripe lunare reale |
| `STRIPE_PLAY_PASS_PRO_MONTHLY_PRICE_ID` | Opțional: echivalent PRO, fără produse/planuri noi create automat |

Configurația Supabase publică existentă nu a fost modificată. SDK-ul Supabase este
fixat la o versiune care păstrează compatibilitatea Node 20 existentă. Recomandarea
pentru preview este runtime-ul Node 24 folosit și în verificarea locală.

`vercel.json` limitează funcțiile noi de procesare la 120s. Este timp pentru un
pas de coadă sau copierea fișierului, nu pentru a aștepta generarea AI. Uploadul
din browser merge direct în Storage cu ticket semnat, evitând limita body Vercel.

### Worker, fără browser deschis

Studio verifică joburile la 8 secunde cât timp pagina este vizibilă. Pentru
finalizare în fundal, configurează un scheduler care cheamă:

`GET /api/animations/worker`

cu header `Authorization: Bearer <CRON_SECRET>`. Un apel procesează un singur pas
al unui job. Nu trebuie să cheme un endpoint fal.ai direct. Endpointul rămâne
accesibil în mentenanță, dar cere secretul. Fără scheduler, procesarea se reia
când utilizatorul deschide Studio; nu pretindem că există un worker permanent.

După alegerea unui plan Vercel care permite frecvența necesară, poți adăuga
manual în `vercel.json`:

```json
"crons": [{"path": "/api/animations/worker", "schedule": "* * * * *"}]
```

Nu am activat cronul și nu am schimbat planul Vercel. La volum mare este necesar
un scheduler/worker cu debit suficient; un singur apel pe minut nu este adecvat
pentru multe generări simultane.

## Stripe — activare TEST

Păstrează webhookul existent `/api/billing/webhook`. Nu crea un al doilea endpoint
care creditează aceleași plăți. Adaugă evenimentele:

- `checkout.session.completed`, `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`, `checkout.session.expired`;
- `charge.refunded`, `charge.dispute.created`;
- `invoice.paid` numai pentru viitoarele abonamente recurente configurate.

Pachetele se configurează în noul panou Admin, cu ID stabil, credite, sumă în
bani/cent, monedă și activare. Backendul salvează aceste valori la crearea
comenzii, nu acceptă prețul sau creditele trimise liber de client. Pagina de
întoarcere din Checkout nu acordă credite; așteaptă webhookul.

Actualele achiziții de PLAY PASS/PRO acordă lotul inclus configurat la confirmarea
plății, pentru o lună de la plată. Nu au reînnoire Stripe automată. Dacă se vor
crea abonamente recurente reale, adaptorul `invoice.paid` acceptă exclusiv Price
ID-urile lunare mapate server-side și clienții Stripe cunoscuți. Nu creează și nu
schimbă abonamentele existente. Facturile prorata și perioadele peste 32 zile
necesită politică comercială separată; nu primesc automat credite lunare în plus.

Google Pay/Apple Pay și alte metode apar după eligibilitatea contului/dispozitivului
și setările Stripe Checkout; nu sunt simulate de site.

## fal.ai — modele și costuri verificate public

Registrul server-side se află în `lib/animations-models.js`; schimbarea adaptorului
nu cere reconstruirea interfeței. Endpointuri și scheme consultate la 23.10.2026:

| Nivel / etapă | Endpoint | Parametri |
| --- | --- | --- |
| Personaj | `fal-ai/flux-pro/kontext` | photo URL semnat, prompt univers, aspect_ratio, JPEG, safety_tolerance=1 |
| Standard video | `minimax/h3-max-turbo/image-to-video` | image_url al personajului, duration=5, resolution=768P, safety checker activ |
| Premium video | `fal-ai/kling-video/o1/reference-to-video` | image_urls, elements cu fotografia frontală, duration="5", aspect_ratio, safety checker activ |

Toate trei afișează eticheta Commercial use. Aceasta nu înlocuiește termenii
furnizorului, drepturile fotografiilor și regulile pentru conținut. Verifică
restricțiile și retenția datelor în contul fal.ai înainte de lansare.

FLUX afișează $0.04/imagine, Kling O1 $0.112/secundă. Pagina MiniMax menționează
tarife promoționale încheiate la 14 septembrie și tarife diferite după rezoluție,
în timp ce tabelul general fal.ai indică o unitate mai mică. Nu s-a fixat un tarif
comercial în cod. Costurile estimate și marjele rămân neconfigurate implicit.
Confirmă tariful facturat la 768P în cont înainte de primul test aprobat.

Surse primare:

- [FLUX Kontext — schemă](https://fal.ai/models/fal-ai/flux-pro/kontext/api)
- [FLUX — tarif](https://fal.ai/models/fal-ai/flux-pro/kontext)
- [MiniMax H3 Max Turbo — schemă](https://fal.ai/models/minimax/h3-max-turbo/image-to-video/api)
- [MiniMax — tarif pe rezoluție](https://fal.ai/models/minimax/h3-max-turbo/image-to-video)
- [Tabel general fal.ai](https://fal.ai/pricing)
- [Kling O1 — schemă](https://fal.ai/models/fal-ai/kling-video/o1/reference-to-video/api)
- [Kling O1 — tarif](https://fal.ai/models/fal-ai/kling-video/o1/reference-to-video)
- [Queue fal.ai](https://fal.ai/docs/documentation/model-apis/inference/queue)
- [Termeni fal.ai](https://fal.ai/legal/terms-of-service)
- [Supabase URL-uri private](https://supabase.com/docs/guides/storage/serving/downloads)
- [Vercel max duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel cron și secret](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment)

Nu se promite identitate facială perfectă. Furnizorul primește fotografia printr-un
URL temporar; fișierele de rezultat fal.ai pot avea retenție proprie. Ștergerea din
Supabase nu trebuie prezentată ca ștergere garantată din sistemele furnizorului.

## Buget și rentabilitate

Configurația pornește cu `enabled=false`, `testMode=true`, 0 credite incluse și
niciun pachet. Costurile Standard/Premium și bugetele sunt null. Nu există valori
comerciale inventate sau credite gratuite.

Administratorul introduce costul maxim complet în USD pentru ambele etape ale
fiecărui video, cursul în moneda ofertelor, TVA, comisioanele Stripe fixe și
procentuale, afilierea, infrastructura și marja minimă. Calculul scade aceste
cheltuieli din venitul fără TVA și verifică scenariul cel mai costisitor per
credit pentru creditele incluse și pachete. O configurație activă sub marja
introdusă este refuzată. Pentru acest calcul ofertele trebuie să aibă aceeași
monedă; nu se presupune un curs unic pentru monede diferite.

Bugetele zilnic global și lunar per cont se rezervă serializat în SQL înainte de
apelul AI. Sunt conservatoare: o generare eșuată poate să fi costat imaginea sau
procesare la furnizor, deci bugetul estimat nu este eliberat automat. Creditele
clientului se pot restitui independent. Nicio garanție de profit nu poate înlocui
reconcilierea cu facturile reale și costurile configurate corect.

## Primul test real — necesită aprobare separată

1. Instalează migrarea într-un Supabase de test sau verifică backupul existent.
2. Configurează Vercel Preview și Stripe Test Mode; ține AI approval=false.
3. Introdu valori comerciale revizuite, fără să schimbi planurile actuale.
4. Verifică o reîncărcare Stripe TEST, webhookul și regularizarea refund/dispute.
5. După aprobarea proprietarului pentru o generare cu plată, configurează FAL_KEY,
   approval=true și un buget foarte mic pentru acel test. Activează generarea în
   Admin. Cele două porți sunt independente.
6. Încarcă o fotografie cu acord, confirmă revizuirea din Admin și verifică fiecare
   etapă: personaj, video, Storage, costul efectiv, descărcare și fidelitate.
7. Testează OBS cu un MP4 propriu, apoi un cadou LIVE real cu regulă configurată.
   Lasă deschis Studio. Vercel nu se conectează la WebSocket-ul localhost.
8. Oprește aprobarea sau enabled dacă apar probleme. Nu activa Stripe live înainte
   de o aprobare separată. Nu face push/deploy din acest branch automat.

## Teste și fișiere

`node --test` include teste PostgreSQL reale prin PGlite pentru creditare,
rezervare, expirare, decontare, RLS, reversări, idempotency și bugete; teste de
transport Stripe semnat, lanț asincron și SDK fal.ai fără retry ascuns. Providerul
și Storage sunt înlocuite numai în fixtures locale, fără trafic extern plătit.

`node scripts/verify-animations-live.mjs` verifică browser + PostgreSQL local,
upload/consimțământ/aprobare, finalizare în bibliotecă, player, fan, reguli, OBS
link, Admin, RO/EN, desktop/mobil și Light/Dark × Burgundy/Blue. Clipul folosit de
furnizorul de test este un MP4 local existent, nu un rezultat AI real.

Fișiere existente modificate: `live-studio.html`, `admin.html`, `server.js`,
`vercel.json`, `package.json`, `package-lock.json`, `lib/billing-http.js`,
`lib/maintenance-http.js`, `assets/admin.js`, `assets/studio-animations-entry.js`,
`assets/studio-animations.css`. Detaliile complete sunt în `git diff` pe branch.

Au fost actualizate și eticheta modulului în `assets/admin-studio-visibility.js`
și testul Stripe existent `tests/billing.test.js`, care rulează acum și cu migrarea
ANIMAȚII instalată pentru a verifica păstrarea beneficiilor originale.

Fișiere noi: `supabase/animations.sql`, `lib/animations-{store,models,provider,
service,billing,runtime,http}.js`, `api/animations/{index,worker,overlay}.js`,
`assets/animations-{client,live-bridge,live-views}.js`,
`assets/animations-live-rules.js`,
`assets/studio-animations-live.js`, `assets/admin-animations.{js,css}`,
`animation-overlay.html`, `assets/animation-overlay.js`, cele trei fișiere de
teste `tests/animations-{sql,service,provider}.test.js`, fixture-ul
`tests/helpers/animations-fixture.mjs`, verificarea de browser și acest document.

Nu s-au testat în producție: chei fal.ai reale, calitatea/identitatea videoclipului
AI, debitul/timeouturile rețelelor reale, plata Stripe reală, livrarea webhookului
în dashboardul utilizatorului, joburile cron Vercel și o transmisie OBS/TikFinity.
Acestea necesită configurare și verificare înainte de lansare comercială.

Verificare locală finală: 163 de teste au trecut; verificarea de browser a trecut
și pentru redarea/confirmarea cozii în overlay și salvarea setărilor Admin.
`npm audit --omit=dev` nu a raportat vulnerabilități în dependențele de producție.
