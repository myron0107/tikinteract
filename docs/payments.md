# Plăți Play Pass — Stripe Checkout

Integrarea folosește tehnologiile existente și API-ul REST Stripe. Nu s-au creat conturi Stripe, nu s-au rulat migrări în producție și nu s-a făcut deploy.

## Comportament

- Cumpărare pentru **o lună calendaristică**, fără reînnoire automată.
- Prețul și moneda provin din configurația **publicată** în Administrare. Un preț schimbat față de cel afișat oprește cumpărarea până la reîncărcare.
- Checkout găzduit de Stripe oferă metodele activate și eligibile, inclusiv card și Google Pay / Apple Pay. Nu forțăm afișarea portofelelor pe dispozitive incompatibile. Nu stocăm date de card.
- Serverul verifică sesiunea Stripe și valoarea încasată. Parametrul `billing=success` singur nu acordă acces. Webhook-ul activează accesul și dacă utilizatorul închide pagina de plată.
- Evenimentele repetate și verificarea manuală nu dublează perioada. Achizițiile și cheile folosesc aceeași blocare a contului.
- PRO păstrează timpul Play Pass existent, programându-l după PRO, ca la cheile actuale. Un Play Pass cumpărat când există PRO se programează după accesul existent.
- Cumpărăturile Stripe în modul test sunt afișate drept **Test** și **nu acordă acces premium real**.
- Conturile temporare de previzualizare, cele anonime și cele fără e-mail confirmat nu pot cumpăra.
- Istoricul privat afișează ultimele 30 de plăți finalizate și linkul de confirmare Stripe, dacă există. Acesta este o confirmare de plată; facturarea fiscală se configurează separat.

## 1. Supabase

În SQL Editor rulează `supabase/billing.sql`, după `admin.sql`, `access-keys.sql` și `users.sql` deja instalate. Nu înlocuiește baza de date sau cheile existente. Adaugă registrul comenzilor și permite sursa „plată” în tabela de acces, alături de sursa „cheie”.

## 2. Cont Stripe și modul de test

Creează contul Stripe și folosește un sandbox / modul test. Nu este necesară crearea manuală de produse: Checkout folosește prețurile publicate din Administrare.

Pentru prima etapă nu sunt necesare opțiunile suplimentare „Send invoices” și „Collect tax” din selecția inițială Stripe. **Nu activa încasări reale până când datele firmei, obligațiile de facturare și taxele aplicabile sunt stabilite.** Integrarea nu adaugă automat taxe peste preț și nu generează automat facturi post-plată.

În Stripe activează cardurile și portofelele disponibile în setările metodelor de plată. Google Pay / Apple Pay apar în Checkout numai când contul, regiunea și dispozitivul clientului sunt eligibile.

## 3. Vercel — variabile server

Adaugă prin setările proiectului, fără a trimite valorile în conversație:

| Nume | Valoare |
| --- | --- |
| `PUBLIC_SITE_URL` | `https://tikinteract.vercel.app` sau originea domeniului tău |
| `SUPABASE_SERVICE_ROLE_KEY` | Cheia server Supabase existentă |
| `STRIPE_SECRET_KEY` | Cheia secretă sandbox `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Secretul `whsec_…` al endpoint-ului de mai jos |

Nu adăuga chei secrete în HTML, JavaScript din `assets`, Git sau configurația publică Supabase. Checkout găzduit nu necesită cheie Stripe publicabilă în browser.

## 4. Webhook Stripe

În Stripe creează o destinație webhook pentru:

`https://tikinteract.vercel.app/api/billing/webhook`

Selectează:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`
- `charge.dispute.created`

Copiază signing secret în variabila `STRIPE_WEBHOOK_SECRET`. Configurează cheia și webhook-ul în același mod Stripe: sandbox cu sandbox, live cu live.

Ruta webhook rămâne accesibilă și în mentenanță, dar acceptă numai payload-uri cu semnătură Stripe validă, pe octeții originali. Rutele de cumpărare rămân protejate de autentificare, verificarea contului și originea site-ului.

## 5. Test complet după configurare

1. Deschide Studio → poza de profil → Abonamentul meu.
2. Selectează un tichet și apasă **Testează plata**.
3. Folosește cardul Stripe de test `4242 4242 4242 4242`, o dată viitoare și un CVC de test. Nu utiliza un card real în test.
4. Confirmă întoarcerea în Studio, istoricul marcat Test și faptul că planul real nu se schimbă.
5. Testează anularea Checkout și repetarea livrării webhook din Stripe.

Testele automate locale folosesc PostgreSQL în memorie și răspunsuri Stripe izolate. Nu reprezintă un test bancar real sau o verificare a eligibilității portofelelor contului tău Stripe.

## 6. Trecerea la încasări reale — separat

După activarea contului comerciant, verificarea țării firmei, facturării, taxelor, condițiilor și politicii de rambursare:

1. Configurează cheia `sk_live_…` și webhook-ul **live**.
2. Setează explicit `STRIPE_LIVE_PAYMENTS_ENABLED=true`.
3. Păstrează `PUBLIC_SITE_URL` pe HTTPS și același domeniu pe care rulează platforma.

Fără această activare explicită, o cheie live nu pornește plățile.

Rambursările integrale și disputele retrag accesul provenit din comanda respectivă. Rambursările parțiale nu retrag automat accesul. Perioadele viitoare deja păstrate nu sunt comprimate automat după o rambursare PRO; suportul trebuie să rezolve separat eventualele ajustări. Disputele câștigate nu reactivează automat accesul și necesită verificare în Stripe. Rambursarea efectivă se inițiază din Stripe, nu există încă un buton de rambursare în Administrare.

## Surse

- [Stripe Checkout](https://docs.stripe.com/payments/checkout)
- [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create)
- [Google Pay](https://docs.stripe.com/google-pay?platform=web)
- [Confirmări și facturi](https://docs.stripe.com/receipts)
- [Configurarea Stripe Tax](https://docs.stripe.com/tax/set-up)
