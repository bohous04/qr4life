# QRforLife — návrh řešení

Datum: 2026-08-25 · Status: schváleno uživatelem

## 1. Cíl

Webová aplikace pro **dynamické QR kódy**: uživatel vytiskne QR kód jednou a kdykoliv
poté změní jeho cíl v administraci. Vygenerovaný kód obsahuje výhradně krátkou URL
`https://qrforlife.cz/{hash}`; veškerá logika cíle žije na serveru a je editovatelná.

Doména (pracovně): `qrforlife.cz`.

## 2. Rozhodnutí

| Téma | Rozhodnutí |
| --- | --- |
| Hosting | LNRT Coolify VPS (Next.js standalone + Postgres služba v Coolify) |
| Stack | Next.js 15 App Router, TypeScript, Prisma, PostgreSQL, Tailwind, Zod |
| Sign in with Apple | Plně implementované, aktivní přes env proměnné (uživatel dodá credentials) |
| E-mail | Vlastní SMTP (env: host, port, user, pass, from) |
| Google Safe Browsing | Implementováno za `GOOGLE_SAFE_BROWSING_KEY`; bez klíče běží jen whitelist schémat |
| Repo | GitHub `bohous04/qrforlife`, public, MIT licence |

Zvažované alternativy: oddělený mini redirect servis (Hono/Fastify) vedle Next.js —
odmítnuto, druhý proces/deploy pro ~5 ms teoretický zisk; Cloudflare Worker před
redirectem — odmítnuto jako zbytečná externí závislost.

## 3. Architektura

Jedna Next.js aplikace. Redirect je route handler `app/[hash]/route.ts`. Statické cesty
(`/login`, `/register`, `/dashboard`, `/api/*`, …) mají ve směrování Next.js přednost před
dynamickým segmentem, takže systémové cesty nemohou být zastíněny hashem — navíc je
generátor hashů neumí obsadit (viz §6). Runtime je Node (edge runtime na vlastním VPS
nic nepřináší a Prisma tam nefunguje); odezvy redirectu jsou v řádu desítek ms, protože
DB běží na stejném stroji.

## 4. Datový model (Prisma)

```
users        id, email unique, password_hash?, apple_sub? unique,
             email_verified_at?, role (user|admin), plan?, created_at
sessions     id, user_id, token_hash unique, expires_at, created_at
tokens       id, user_id, type (verify_email|reset_password), token_hash,
             expires_at, used_at?, created_at
qr_codes     id, user_id → users, hash unique, name,
             type (url|wifi|vcard|phone|sms|email|text),
             payload Jsonb, is_active bool default true,
             admin_blocked bool default false, blocked_reason?,
             created_at, updated_at
scans        id, qr_code_id → qr_codes, scanned_at, user_agent?, country?
```

- Payloady validuje Zod schéma podle typu (`lib/qr/payload-schema.ts`) při vytvoření i editaci.
- `plan` zatím nikde nevynucený — model je připravený na budoucí tarify.
- Kolize hashe: retry generování na chybu unique constraint (max. pár pokusů).

## 5. Chování po naskenování `/[hash]`

Vždy `Cache-Control: no-store`. Nikdy 301, vždy 302.

| Typ | Odpověď |
| --- | --- |
| url | 302 Location na cílovou URL |
| phone / sms / email | 302 na `tel:` / `sms:` / `mailto:` |
| vcard | soubor `.vcf`, `Content-Type: text/vcard`, `Content-Disposition: attachment` |
| text | minimalistická stránka s textem |
| wifi | rychlá stránka: SSID, heslo, tlačítko „Kopírovat heslo", nativní WIFI QR (`WIFI:S:ssid;T:WPA;P:heslo;;` se správným escapováním `\ ; , :`) |

Stavy:

- Neexistující/smazaný hash → vlastní branded 404 stránka.
- `is_active = false` → stránka „tento kód je dočasně neaktivní".
- `admin_blocked = true` → stránka „kód byl zablokován".

Log skenu proběhne přes `after()` po odeslání odpovědi, aby nezdržoval redirect.

## 6. Hash

Base62 (`a-zA-Z0-9`), 7 znaků, generovaný kryptograficky náhodně
(`crypto.randomInt`), ne sekvenčně. Rezervované cesty (login, register, dashboard,
api, admin, static asset paths, …) definované v jednom seznamu, generátor je vyřazuje.
Kolize řeší retry při insertu (unique index).

## 7. Přihlášení

Vlastní implementace (žádný auth framework):

- Registrace e-mail + heslo, hash argon2id.
- Ověření e-mailu tokenem; **ověřený e-mail je podmínkou vytvoření prvního kódu**.
- Reset hesla tokenem (jednorázový, časově omezený).
- Sezení: DB sessions, token pouze v httpOnly secure cookie.
- Sign in with Apple: OAuth code flow, verifikace `id_token` proti Apple JWKS (`jose`),
  propojení s existujícím účtem podle e-mailu. Aktivace přes `APPLE_SERVICES_ID`,
  `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.
- Rate limit na login (per IP + per e-mail).

## 8. Administrace (po přihlášení)

Přehled vlastních QR kódů, každý s:

- editovatelným názvem,
- náhledem vykresleného kódu (`<img src="/api/qr/{id}">`),
- stažením PNG i SVG (stejná knihovna a nastavení jako náhled),
- editovatelným typem a daty (změna platí okamžitě, žádná cache),
- přepínačem aktivní / pozastavený,
- datem vytvoření a počtem skenů,
- smazáním s potvrzením (varování: mrtvé vytištěné cedule).

Vytvoření nového kódu: volba typu (dlaždice s ikonami) → formulář podle typu → název.
Hash i obrázek se generují automaticky.

Admin role navíc: přehled všech kódů, blokace kódu s důvodem.

## 9. Homepage

Cíl: do pěti sekund vysvětlit, proč dynamický kód stojí za to. Hero „vytiskneš jednou,
měníš kdykoliv", sekce proč dynamický vs. statický (překlep v URL, změna otevírací doby,
přesun akce, zrušená stránka = vyhozený tisk), kartičky scénářů (výloha, stroj/rozvaděč,
Wi-Fi v provozovně/chalupě, vizitka/polep auta, leták/plachta akce, štítek výrobku).
Tlačítka Přihlásit se / Registrovat v hlavičce i patičce. Vizuálně čistě: pevná
typografie, hodně bílého prostoru, jedna výrazná akcentní barva, žádný generický SaaS
vzhled s fialovým gradientem.

## 10. Bezpečnost

- Whitelist schémat cílové URL: `http`, `https`, `tel`, `sms`, `mailto`; `javascript:`,
  `data:` a ostatní blokovaná. Validace při uložení.
- Google Safe Browsing kontrola cílových URL při uložení + periodický re-check
  pozadím (`instrumentation.ts` interval); aktivní s `GOOGLE_SAFE_BROWSING_KEY`;
  zasažené kódy se administrátorsky zablokují.
- Rate limiting: vytváření kódů per IP + per user; login per IP + per e-mail
  (in-memory, jedna instance na Coolify).
- Povinné ověření e-mailu před prvním kódem.
- Admin blokace kódu.
- httpOnly secure cookies, CSRF ochrana u měnících operací (origin check).

## 11. i18n

Aplikace jen v češtině, ale všechny texty v jednom slovníku `lib/i18n/cs.ts`
(typed keys), komponenty používají klíče. Angličtina se doplní později bez
přepisování komponent.

## 12. QR rendering

Server-side knihovna `qrcode` (PNG i SVG). Náhled v administraci je obrázek ze serverového
endpointu se stejnými parametry jako stažený soubor — náhled a download se nemohou lišit.
Error correction level M, pro Wi-Fi/text delších obsahů automaticky vyšší verze dle knihovny.

## 13. Testování

- Unit (Vitest): generování/validace hashů, Zod payload schémata, WIFI string escapování,
  redirect rozhodování, whitelist schémat.
- E2E (Playwright): registrační flow, vytvoření URL kódu → redirect → změna cíle → nový
  redirect, Wi-Fi stránka, branded 404, izolace cizích kódů (přímé API URL po odhlášení).

Acceptance criteria ze zadání (§ Kdy je hotovo): registrace + ověření + login; URL kód →
PNG → scan → cíl bez mezistránky; změna cíle → tentýž tištěný kód vede na nový cíl;
Wi-Fi kód zobrazí SSID/heslo; hezká 404 na neexistující hash; po odhlášení cizí kódy
nepřístupné ani přímým API URL.

## 14. Nasazení

1. GitHub repo `bohous04/qrforlife`, public, MIT LICENSE, README.
2. LNRT Coolify: PostgreSQL služba + aplikace (Dockerfile, standalone build).
3. Env proměnné: `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`,
   `SMTP_HOST/PORT/USER/PASS/FROM`, `APPLE_SERVICES_ID/APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY`,
   `GOOGLE_SAFE_BROWSING_KEY`, `ADMIN_EMAIL` (povýší prvního uživatele na admina).
4. Doména `qrforlife.cz` po nastavení DNS.

Mimo rozsah: platby a tarify, vlastní domény zákazníků, týmy, brandované kódy, A/B testy.
