# Configurația comercială — Stripe TEST

Implementată în branch-ul `codex/studios-layout-finance`. Nu este publicată automat. Prețurile publice existente, `site_settings.published`, Stripe Prices existente, accesul la jocuri, cheia de acces, conectorul LIVE și OBS nu sunt modificate.

## Propunerea instalată

| Plan | EUR / lună | Credite incluse |
| --- | ---: | ---: |
| FREE | 0 | 0 |
| PLAY PASS | 7,99 | 300 |
| PLAY PASS PRO | 14,99 | 800 |

Standard: **100 credite / 5 secunde**. Premium: **200 credite / 5 secunde**. Reîncărcări: **2,99 € / 200**, **4,99 € / 500**, **9,99 € / 1.100**. Orice cont confirmat, inclusiv FREE, poate cumpăra credite. Nu se acordă credite la înregistrare sau la întoarcerea din Checkout.

Aceste valori sunt izolate în `animation_settings.config.testCommerce`. Configurația operațională anterioară și prețurile reale rămân separate. `animation_effective_config()` aplică oferta nouă numai când `testMode=true`. Generarea rămâne condiționată de aprobarea explicită a apelurilor AI, activarea administrativă, bugete, moderare, marjă și sold suficient.

## Instalare Supabase

1. `supabase/animations.sql` trebuie să fie deja instalat, după schema existentă de administrare și facturare.
2. Rulează **`supabase/animations-commerce.sql`** în SQL Editor. Este o actualizare aditivă, repetabilă; nu șterge date și nu suprascrie oferta editată de administrator.
3. Nu aplica fișierul de bază `animations.sql` peste actualizare fără a rula din nou `animations-commerce.sql` după el.
4. Administrare → **FINANCIAR**: oferta de test și proiecțiile devin disponibile. Lasă costurile necunoscute necompletate.

Tabele noi private: `animation_commerce_price_terms`, `animation_commerce_orders`, `animation_commerce_invoices`, `animation_provider_costs`. RLS și revocarea permisiunilor anon/authenticated interzic accesul direct. Modificările financiare și acordarea creditelor se fac doar prin server și funcții SQL rezervate rolului `service_role`.

## Stripe Sandbox / Test Mode

Pregătește un mediu **Preview/local de test**; nu înlocui cheia reală din Production.

1. Creează două **Prices recurente lunare**, EUR: PLAY PASS 7,99 și PLAY PASS PRO 14,99.
2. Creează trei **Prices cu plată unică**, EUR: 2,99, 4,99 și 9,99 pentru pachetele de credite.
3. Copiază identificatorii `price_…` în FINANCIAR și salvează. Folosește „Verifică Price ID-urile”; aceasta face doar citiri Stripe, fără plată. Serverul verifică modul Test, valoarea, moneda, tipul, intervalul lunar, cantitatea și disponibilitatea Price-ului.
4. Pentru alt preț creează un Price nou. Un Price utilizat păstrează condițiile comerciale ale ofertei (inclusiv creditele). Abonamentele deja cumpărate păstrează condițiile din comandă; o ofertă nouă nu schimbă retroactiv contractul lor. Upgrade-uri cu prorată nu sunt implementate și nu acordă credite automat.
5. Configurează variabilele de server existente în mediul de test: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Nu trimite cheile în conversație și nu le pune în fișiere publice.
6. Reutilizează endpointul **`/api/billing/webhook`**, cu evenimente:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `invoice.paid`
   - `charge.refunded`
   - `charge.dispute.created`
   - `customer.subscription.deleted`
7. În Studio → ANIMAȚII → Reîncarcă credite poți testa pachetele și, din secțiunea extensibilă, abonamentele recurente. Folosește exclusiv carduri de test Stripe.

Transportul nou fixează versiunea API Stripe `2024-06-20` pentru reprezentarea canonică a facturilor și plăților; webhook-ul folosește identificatori și reinteroghează obiectele. Nu acordă credite doar pe baza metadatelor din browser. Stripe Prices nu sunt create sau modificate prin cod.

**Izolare obligatorie:** checkout-ul comercial nou respinge cheile Live chiar dacă aprobarea vechiului sistem de plăți Live este activată. Cardurile de test acordă doar credite TEST, niciodată permisiuni plătite în producție. Beneficiile reale ale jocurilor și Studio rămân în sistemul existent de acces. Activarea comercială reală și legarea unui abonament recurent Live de drepturile reale se fac separat, după aprobare; nu sunt activate de această schimbare.

Creditele incluse se acordă doar pentru factura lunară achitată, expiră la finalul perioadei și nu se acumulează gratuit. O perioadă viitoare plătită nu devine utilizabilă anticipat. Creditele cumpărate au loturi separate, fără expirare configurată. Repetarea webhook-ului nu dublează soldul. Rambursările sunt monotone; pentru credite deja consumate apare o datorie care blochează generările până la regularizare. Anularea abonamentului nu revocă perioada deja plătită fără rambursare.

Un Checkout de abonament abandonat se reia fără crearea unui al doilea abonament. Schimbarea planului cu un Checkout încă deschis necesită expirarea/anularea comenzii în Stripe Test. Gestionarea sau anularea abonamentelor de test se face momentan în Dashboard Stripe; portalul self-service și upgrade-urile nu sunt incluse în această etapă de test.

## Costuri fal.ai și controlul profitului

- **0,30 € Standard este o simulare**, nu un tarif garantat al modelului.
- **Premium nu are un cost monetar implicit**. Costul comercial în credite este 200; costul furnizorului trebuie verificat, inclusiv etapa de imagine, video, durată și curs valutar.
- Estimările operaționale USD și bugetele rămân în setările ANIMAȚII AI. Costul rezervat este înregistrat pentru fiecare cerere. Un plafon USD mai mare decât simularea EUR este folosit conservator în verificarea rentabilității.
- Opțional configurează server-side **`FAL_BILLING_KEY`**, cu permisiuni de citire a facturării. Fallback: `FAL_KEY`, numai dacă are acele permisiuni. „Sincronizează costul” citește `GET https://api.fal.ai/v1/models/billing-events`, filtrat după identificatorii cererilor existente; nu face inferență AI.
- Costurile etapelor imagine/video sunt asociate cererii și modelului exact, stocate în USD la precizie nano și actualizate idempotent. Lipsa unui raport nu înseamnă cost zero. Rapoartele pot întârzia; cererile mai vechi de 89 zile necesită reconciliere separată.
- După un rezultat finalizat cu ambele etape facturate, plafonul de cost al modelului curent poate crește automat la valoarea observată. Cu un curs USD/EUR configurat crește și ipoteza EUR (niciodată nu scade automat). Dacă marja nu mai este suficientă, generările noi sunt blocate. O cerere deja pornită își poate termina procesarea rezervată.
- Lasă **`ANIMATIONS_PAID_AI_APPROVED=false`** și **`ANIMATIONS_LIVE_PAYMENTS_APPROVED=false`**. Nu s-a efectuat niciun apel AI plătit în verificări.

Documentație oficială: [fal billing events](https://fal.ai/docs/platform-apis/v1/models/billing-events), [Stripe Prices](https://docs.stripe.com/api/prices), [Stripe Billing pricing](https://stripe.com/billing/pricing). Ipoteza Billing de 0,7% trebuie verificată față de contractul contului; comisioanele Payments și TVA-ul nu sunt presupuse automat. Colectarea TVA în Stripe Tax nu este activată prin această implementare; o simulare de TVA nu este o configurare fiscală.

## Marje și raportare

FINANCIAR este privat pentru owner/admin și arată exclusiv fluxul comercial nou **TEST**. Nu pretinde că reprezintă veniturile reale ale vechii facturări.

Proiecțiile per ofertă scad TVA inclus, Payments procent + fix, Billing pentru abonamente, afiliere din venitul fără TVA, infrastructură și stocare alocate. Arată scenariile fără AI și cu utilizare integrală, numai Standard, numai Premium și cea mai costisitoare combinație posibilă, fără videoclipuri fracționare. Câmpurile necompletate dau marjă necunoscută; nu se substituie automat cu zero.

La **numai Standard, înainte de TVA, comisioane și infrastructură**:

| Ofertă | Videoclipuri / 5 s | AI simulat | Rămas înainte de celelalte costuri |
| --- | ---: | ---: | ---: |
| PLAY PASS | 3 | 0,90 € | 7,09 € |
| PLAY PASS PRO | 8 | 2,40 € | 12,59 € |
| 200 credite | 2 | 0,60 € | 2,39 € |
| 500 credite | 5 | 1,50 € | 3,49 € |
| 1.100 credite | 11 | 3,30 € | 6,69 € |

Fără consum AI rămân 7,99 €, respectiv 14,99 €, înainte de celelalte costuri. Maximul monetar cu Premium rămâne necunoscut până la configurarea costului acestuia. Pentru PLAY PASS sunt posibile 3 Standard sau 1 Premium + 1 Standard; PRO permite 8 Standard sau 4 Premium, plus combinațiile intermediare. FREE nu are generări incluse.

Raportul lunar UTC arată facturi și reîncărcări achitate, rambursări/dispute, credite acordate/consumate/rezervate, costuri fal.ai confirmate, rezerva estimată neconfirmată și rezultatul agregat. Comisionul Payments verificat din Balance Transaction are prioritate față de estimare; comisionul nu este presupus restituit la refund. TVA raportat de Stripe are prioritate când există un calcul fiscal; altfel se utilizează ipoteza administrativă. Billing/afiliere/infra/stocare rămân estimări. Costurile AI apar în luna creării cererii, nu neapărat a decontării furnizorului. Acesta este un raport comercial estimativ, nu o contabilitate completă.

## Verificare și limite înainte de producție

Teste automate cu PostgreSQL local, Stripe/fal simulate și verificarea semnăturii webhook: fără servicii externe sau chei reale. Înainte de activare mai sunt necesare instalarea SQL în mediul vizat, cele cinci Price ID-uri Test, webhook-ul configurat și testele reale în Stripe Sandbox. Configurarea fiscală, tariful efectiv Premium, cursul, costurile infrastructurii și primul apel AI plătit necesită verificare/aprobare separată. Nu s-a făcut deploy sau push.

## Fișiere

Noi:

- `supabase/animations-commerce.sql` — tabele private, operații atomice, raportare și configurație TEST.
- `lib/animations-finance.js` — validare, proiecții fără consum/cu consum integral și controlul marjei.
- `lib/animations-finance-service.js` — administrare financiară și reconciliere fal.ai.
- `lib/animations-commerce-billing.js` — Prices valide, Checkout Test, facturi și rambursări.
- `assets/admin-finance.js` — secțiunea FINANCIAR.
- `assets/animations-credit-purchase.js` — pachete și sumarul comenzii.
- `tests/animations-commerce.test.js` — verificări comerciale și de securitate cu PostgreSQL local.
- `scripts/verify-animations-commerce.mjs` — verificare browser cu servicii simulate.
- `docs/animations-commerce.md` — configurare, ipoteze, limite și lista fișierelor.

Actualizate:

- `lib/animations-billing.js`, `lib/animations-service.js` — reutilizarea autentificării, API-ului și webhook-ului existente.
- `admin.html`, `assets/admin.js` — navigarea către FINANCIAR.
- `assets/admin-animations.js`, `assets/admin-animations.css` — delimitarea setărilor operaționale/comerciale și stilurile din tema existentă.
- `assets/studio-animations-live.js`, `assets/animations-live-views.js`, `assets/studio-animations.css` — integrarea cumpărării și blocarea generării fără sold suficient.
- `assets/animations-client.js` — mesaje RO/EN pentru configurare și plăți.
- `assets/animations-live-bridge.js`, `assets/studio-animations-entry.js`, `live-studio.html` — actualizarea referințelor de cache către modulele modificate; fără modificarea meniului sau a dimensiunii lui.
- `.vercelignore` — exclude cele două foldere de referință din deploy.
