# QRforLife Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dynamické QR kódy — tištěný kód obsahuje jen `https://qrforlife.cz/{hash}`, cíl se mění v administraci.

**Architecture:** Jedna Next.js 15 App Router aplikace na LNRT Coolify VPS s PostgreSQL. Redirect je route handler `app/[hash]/route.ts` (302 + `Cache-Control: no-store`, žádná mezistránka u url/tel/sms/mailto; vcard jako `.vcf` soubor; wifi/text jako vygenerované HTML stránky). Auth vlastní: argon2id + DB sessions v httpOnly cookie + Apple OAuth + SMTP e-maily.

**Tech Stack:** Next.js 15 (App Router, standalone), TypeScript strict, Prisma 6, PostgreSQL 16, Tailwind CSS v4, Zod, `@node-rs/argon2`, `jose`, `nodemailer`, `qrcode`, Vitest, Playwright.

## Global Constraints

- Redirect **vždy 302**, nikdy 301; vždy hlavička `Cache-Control: no-store`.
- Hash: base62 `[a-zA-Z0-9]`, přesně 7 znaků, `crypto.randomInt`, rezervované cesty zakázané, kolize řeší retry na unique constraint.
- Whitelist schémat cílových URL: jen `http`, `https`, `tel`, `sms`, `mailto`.
- Ověřený e-mail je povinný před vytvořením prvního kódu.
- Všechny UI texty výhradně z `src/lib/i18n/cs.ts` (žádné natvrdo zapsané stringy v komponentách).
- Náhled QR v administraci = stejný endpoint/nastavení jako stažený PNG/SVG (knihovna `qrcode`, ECC level M).
- Cizí kódy nepřístupné přes jakékoli API URL bez vlastnictví (kontrola `user_id` na každé mutaci i čtení detailu).
- `plan` pole na users existuje, ale nikde se nevynucuje.
- Čeština jediný jazyk; angličtina později přes druhý slovník.
- Git: frequent commits, konvenční prefixy (feat/fix/test/chore/docs).

---

### Task 1: Scaffold projektu + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`, `.env.example`, `compose.yaml` (dev Postgres), `vitest.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder)

**Steps:**

- [ ] `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --no-import-alias` v `/workspace` (repo není prázdné kvůli docs — create-next-app spustit v tempu a sloučit, nebo flagy ručně; cílem je standardní Next 15 struktura). Přidat deps: `zod @node-rs/argon2 jose nodemailer qrcode @types/qrcode @types/nodemailer` a dev deps: `vitest @vitest/coverage-v8 prisma @prisma/client playwright`.
- [ ] `next.config.ts`: `output: 'standalone'`.
- [ ] `compose.yaml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: qfl
      POSTGRES_PASSWORD: qfl
      POSTGRES_DB: qfl
    ports: ["5433:5432"]
    volumes: [qfl-pgdata:/var/lib/postgresql/data]
volumes:
  qfl-pgdata:
```

- [ ] `.env.example`: `DATABASE_URL=postgresql://qfl:qfl@localhost:5433/qfl`, `SESSION_SECRET=change-me-64-hex`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APPLE_SERVICES_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `GOOGLE_SAFE_BROWSING_KEY`, `ADMIN_EMAIL`.
- [ ] `vitest.config.ts` s aliasem `@` → `src`, test glob `tests/**/*.test.ts`.
- [ ] Placeholder homepage (bude nahrazen Task 11): `<main>QRforLife</main>`.
- [ ] Run: `pnpm build && pnpm vitest run` — Expected: build PASS, 0 testů PASS.
- [ ] Commit: `chore: scaffold Next.js app with tooling`

### Task 2: Prisma schema + i18n slovník

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/i18n/cs.ts`
- Test: `tests/i18n.test.ts`

**Interfaces:**
- Produces: `prisma` export ze `src/lib/db.ts` (`PrismaClient` singleton); typy `User`, `QrCode`, `QrType` (`'url'|'wifi'|'vcard'|'phone'|'sms'|'email'|'text'`); `texts` export z `cs.ts`.

**Schema (kompletní):**

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum UserRole { user admin }
enum QrType { url wifi vcard phone sms email text }
enum TokenType { verify_email reset_password }

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String?
  appleSub          String?   @unique
  emailVerifiedAt   DateTime?
  role              UserRole  @default(user)
  plan              String?
  createdAt         DateTime  @default(now())
  qrCodes           QrCode[]
  sessions          Session[]
  tokens            Token[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model Token {
  id        String    @id @default(cuid())
  userId    String
  type      TokenType
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, type])
}

model QrCode {
  id            String   @id @default(cuid())
  userId        String
  hash          String   @unique
  name          String
  type          QrType
  payload       Json
  isActive      Boolean  @default(true)
  adminBlocked  Boolean  @default(false)
  blockedReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  scans         Scan[]
  @@index([userId])
}

model Scan {
  id        String   @id @default(cuid())
  qrCodeId  String
  scannedAt DateTime @default(now())
  userAgent String?
  country   String?
  qrCode    QrCode   @relation(fields: [qrCodeId], references: [id], onDelete: Cascade)
  @@index([qrCodeId, scannedAt])
}
```

- [ ] `npx prisma migrate dev -n init` (vyžaduje běžící `docker compose up -d db`). Expected: migrace vytvořena, `npx prisma generate` ok.
- [ ] `src/lib/db.ts`: standardní global-singleton `export const prisma`.
- [ ] `src/lib/i18n/cs.ts`: `export const texts = {...} as const` — kompletní české texty pro: homepage (hero nadpis „Vytiskneš jednou. Měníš kdykoliv.", hero podnadpis, sekce „Proč dynamický kód" — 4 porovnávací body: překlep v URL, změna otevírací doby, přesun akce, zrušená stránka; 6 kartiček scénářů dle zadání §9), header/footer („Přihlásit se", „Registrovat"), auth formuláře + validační chyby, dashboard (typy kódů s popisky, formulářová pole všech 7 typů, stavy „Aktivní/Pozastavený/Zablokován", potvrzení smazání „Smazáním zahodíš všechny vytištěné cedule s tímto kódem. Opravdu smazat?", tlačítka), redirect stavové stránky („Tento kód je dočasně neaktivní", „Kód byl zablokován správce"), 404 („Tenhle kód nikde nevidíme."), Wi-Fi stránka („Kopírovat heslo", „Heslo zkopírováno"), e-mailové šablony (ověření, reset — předmět + tělo). Klíče tečkovaně: `texts.home.hero.title` apod.
- [ ] Test `tests/i18n.test.ts`: klíče `home.hero.title`, `auth.login.submit`, `qr.status.inactive`, `notfound.title` existují a jsou neprázdné stringy.
- [ ] Run: `pnpm vitest run` — PASS. Commit: `feat: prisma schema and czech i18n dictionary`

### Task 3: Hash modul

**Files:**
- Create: `src/lib/qr/hash.ts`
- Test: `tests/hash.test.ts`

**Interfaces:**
- Produces: `generateHash(): string` (7 znaků base62); `isReservedPath(path: string): boolean`; `RESERVED_PATHS: readonly string[]`.

- [ ] Testy první: generovaný hash matchuje `/^[a-zA-Z0-9]{7}$/`; 200 hashů → ≥190 unikátních; `isReservedPath('login')===true`, `'api'`, `'dashboard'`, `'admin'`, `'register'`, `'_next'`, `'favicon.ico'` true; `'abc1234'`, `'Login'` false.
- [ ] Implementace:

```ts
import { randomInt } from 'node:crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LENGTH = 7;

export const RESERVED_PATHS = ['login','register','logout','dashboard','admin','api','w','t',
  'verify','reset','apple','static','_next','favicon.ico','robots.txt','sitemap.xml','assets',
  'docs','public'] as const;

export function isReservedPath(path: string): boolean {
  return (RESERVED_PATHS as readonly string[]).includes(path);
}

export function generateHash(): string {
  let out = '';
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
```

- [ ] Run: `pnpm vitest run tests/hash.test.ts` PASS. Commit: `feat: base62 hash generator with reserved paths`

### Task 4: Payload schémata + Wi-Fi string + vCard

**Files:**
- Create: `src/lib/qr/payload-schema.ts`, `src/lib/qr/wifi-string.ts`, `src/lib/qr/vcard.ts`
- Test: `tests/payload-schema.test.ts`, `tests/wifi-string.test.ts`, `tests/vcard.test.ts`

**Interfaces:**
- Produces: `type QrPayloadMap = { url:{url:string}; wifi:{ssid:string;password:string|null;hidden:boolean}; vcard:{firstName:string;lastName?:string;org?:string;title?:string;phone:string;email?:string;url?:string}; phone:{number:string}; sms:{number:string;body?:string}; email:{to:string;subject?:string;body?:string}; text:{text:string} }`; `payloadSchema(type, data): QrPayloadMap[typeof type] | null` (null při nevalidním vstupu); `wifiString(p): string`; `vcardString(p): string`.

- [ ] `wifi-string.ts` — escapování pořadí `\` pak `; , : " `:

```ts
const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
export function wifiString(p: { ssid: string; password: string | null; hidden: boolean }): string {
  const t = p.password ? 'WPA' : 'nopass';
  const pass = p.password ? `P:${esc(p.password)};` : '';
  const hid = p.hidden ? 'H:true;' : '';
  return `WIFI:T:${t};S:${esc(p.ssid)};${pass}${hid};`;
}
```

Testy: `ssid:'Home',password:'pa:ss;wo\\rd'` → `WIFI:T:WPA;S:Home;P:pa\:ss\;wo\\rd;;`; null heslo → `T:nopass`; hidden → obsahuje `H:true;`.

- [ ] `vcard.ts` — vCard 3.0:

```ts
const esc = (s: string) => s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/([,;])/g,'\\$1');
export function vcardString(p: {firstName:string;lastName?:string;org?:string;title?:string;phone:string;email?:string;url?:string}): string {
  const lines = [
    'BEGIN:VCARD','VERSION:3.0',
    `N:${esc(p.lastName ?? '')};${esc(p.firstName)};;;`,
    `FN:${esc([p.firstName,p.lastName].filter(Boolean).join(' '))}`,
  ];
  if (p.org) lines.push(`ORG:${esc(p.org)}`);
  if (p.title) lines.push(`TITLE:${esc(p.title)}`);
  lines.push(`TEL;TYPE=CELL:${p.phone}`);
  if (p.email) lines.push(`EMAIL:${p.email}`);
  if (p.url) lines.push(`URL:${p.url}`);
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}
```

Testy: základní tvar řádků, escape čárky ve jméně, volitelná pole chybí → žádné řádky.

- [ ] `payload-schema.ts` — Zod schémata per typ; validace: `url.url` musí projít whitelist schémat (http/https, viz Task 10 `assertSafeHttpUrl`), `wifi.ssid` 1–32 znaků, `wifi.password` null nebo 8–63 znaků, `phone.number` `/^\+?[0-9 ()-]{6,20}$/`, `email.to` Zod `z.string().email()` (pro `mailto:`), `sms.number` jako phone, `text.text` 1–2000, `vcard.phone` jako phone, stringy trimovány, `unknown keys strip`. Export typu `QrPayloadMap` a funkce `payloadSchema(type, data)` vracející parsovaná data nebo `null`.
- [ ] Testy: validní payload každého typu projde; `javascript:alert(1)` v url → null; ssid 33 znaků → null; heslo 7 znaků → null; špatný telefon → null; neznámé klíče odstraněny.
- [ ] Run: `pnpm vitest run` PASS. Commit: `feat: payload schemas, wifi string, vcard generator`

### Task 5: Auth jádro (hesla, sessions, tokeny, mail)

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/auth/tokens.ts`, `src/lib/mail.ts`
- Test: `tests/password.test.ts`, `tests/session.test.ts`, `tests/tokens.test.ts`

**Interfaces:**
- Produces: `hashPassword(pw): Promise<string>`; `verifyPassword(hash, pw): Promise<boolean>`; `createSession(userId): Promise<{cookieValue:string;expiresAt:Date}>`; `getSessionUser(cookieValue:string|null): Promise<User|null>`; `destroySession(token): Promise<void>`; `SESSION_COOKIE='qfl_session'`; `issueToken(userId,type,ttlMinutes): Promise<string>`; `consumeToken(raw,type): Promise<UserId|null>`; `sendMail({to,subject,text}): Promise<void>`.
- Consumes: `prisma` (Task 2), texts z i18n (e-mailové šablony).

Detaily:
- Hesla: `@node-rs/argon2` (argon2id, defaultní parametry).
- Session token: 32 bajtů `randomBytes().toString('base64url')`, do DB jen sha256 hash; platnost 30 dní; cookie httpOnly, `secure` v produkci, sameSite lax, path `/`.
- Tokeny: stejný vzor (sha256 hash v DB), TTL verify 48 h, reset 1 h, `consumeToken` atomicky nastaví `usedAt` a ověří expiraci + typ.
- `mail.ts`: nodemailer transport z env; pokud `SMTP_HOST` není nastaveno, `sendMail` logne do konzole (dev fallback) — testy mockují transport.

- [ ] Testy: hash≠plaintext, verify roundtrip true/false; createSession vloží řádek s hashem ≠ raw tokenu; getSessionUser s prošlým expiresAt → null; consumeToken dvakrát → podruhé null; consumeToken špatný typ → null. (DB testy proti lokální Postgres z compose; helper `tests/db.ts` truncates tables between tests.)
- [ ] Run: `pnpm vitest run` PASS. Commit: `feat: password hashing, db sessions, action tokens, smtp mail`

### Task 6: Auth API + rate limiting

**Files:**
- Create: `src/lib/security/rate-limit.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/verify/route.ts`, `src/app/api/auth/reset/request/route.ts`, `src/app/api/auth/reset/confirm/route.ts`
- Modify: `src/middleware.ts` (origin check)
- Test: `tests/rate-limit.test.ts`

**Interfaces:**
- Produces: `hit(key: string, limit: number, windowMs: number): boolean` (in-memory sliding window Map, čistí prošlé); API kontrakty níže.

Chování endpointů (vše JSON):
- `POST /api/auth/register {email,password}`: validace (email formát, heslo min 8), rate limit 10/hod/IP, duplicitní e-mail → 409 `texts.auth.register.emailTaken`, úspěch → user + verify token + sendMail + 201. Pokud `ADMIN_EMAIL` sedí → role admin. Nevrací hash.
- `POST /api/auth/login {email,password}`: rate limit 10/15min na `${ip}` i `${ip}:${email}`, argon2 verify, úspěch → Set-Cookie session + 200, neúspěch → 401 jednotná hláška (netesit existence účtu).
- `POST /api/auth/logout`: smaže session, clear cookie.
- `GET /api/auth/verify?token=`: consumeToken(verify_email) → `emailVerifiedAt=now` → redirect 302 `/login?verified=1`; chybný → `/login?verified=0`.
- `POST /api/auth/reset/request {email}`: vždy 200 (bez ohledu na existenci), pokud existuje → token + sendMail.
- `POST /api/auth/reset/confirm {token,password}`: consumeToken(reset_password) → update hash → 200.

Middleware (`src/middleware.ts`): pro POST/PATCH/DELETE porovnat `Origin` header host s hostem requestu; mismatch → 403.

- [ ] Rate-limit testy: `limit=2,window=1000` → hit,hit,true; falešné časování přes injectovatelný `now` parametr; po okně opět false.
- [ ] Run: `pnpm vitest run` PASS. Commit: `feat: auth api endpoints with rate limiting and csrf origin check`

### Task 7: Sign in with Apple

**Files:**
- Create: `src/lib/auth/apple.ts`, `src/app/api/auth/apple/route.ts`, `src/app/api/auth/apple/callback/route.ts`
- Test: `tests/apple.test.ts`

**Interfaces:**
- Consumes: env `APPLE_SERVICES_ID/APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY`, `jose`.
- Produces: `appleConfigured(): boolean`; `buildClientSecret(): string` (ES256 JWT, kid, iss team, aud https://appleid.apple.com, exp 5 min); `exchangeCode(code, redirectUri): Promise<{idToken:string}>`; `verifyIdToken(idToken): Promise<{sub:string;email:string;email_verified:boolean}>` (JWKS z `https://appleid.apple.com/auth/keys`, audience check); `findOrCreateAppleUser(sub,email): Promise<User>` (podle appleSub, pak podle e-mailu propoj, jinak nový uživatel bez hesla).

Flow: `GET /api/auth/apple` → 302 na Apple authorize URL (`response_mode=form_post`, scope `name email`) nebo 503 pokud `!appleConfigured()`. Callback přijímá POST s `code`+`state` (state = podepsaný nonce v httpOnly cookie), exchange → verify → findOrCreate → session cookie → 302 `/dashboard`.

- [ ] Testy: `buildClientSecret` dekódovat jose `decodeJwt` → správné claims; `verifyIdToken` s mocknutým `createRemoteJWKSet` a podepsaným vlastním klíčem → vrátí sub/email; špatný audience → throw; `findOrCreateAppleUser` propojení podle e-mailu (DB test).
- [ ] Run: `pnpm vitest run` PASS. Commit: `feat: sign in with apple oauth flow`

### Task 8: Redirect endpoint `/[hash]`

**Files:**
- Create: `src/lib/qr/redirect-resolver.ts`, `src/lib/qr/pages-html.ts`, `src/app/[hash]/route.ts`
- Test: `tests/redirect-resolver.test.ts`, `tests/pages-html.test.ts`

**Interfaces:**
- Produces: `resolveScan(qr: {type;payload;isActive;adminBlocked}): Resolution` kde `Resolution = {kind:'redirect',location:string} | {kind:'vcard',vcf:string,filename:string} | {kind:'html',status:number,title:string,body:string} | {kind:'notfound'}`; `branded404Html()`, `inactiveHtml()`, `blockedHtml()`, `wifiPageHtml(payload, wifiQrDataUrl)`, `textPageHtml(text)` — vše plné HTML dokumenty s inline CSS (žádné externí zdroje), texty z i18n.

Resolver pravidla (čistá funkce, bez DB):

```ts
// url → redirect(location); phone → tel:+number; sms → sms:+number(?body=);
// email → mailto:to?subject=&body=; vcard → vcard kind;
// text → html status 200; wifi → html status 200 (SSID, heslo, Kopírovat heslo,
// nativní WIFI QR jako data URI); neexistující/isActive=false/adminBlocked řeší caller.
```

- [ ] Resolver testy: každý typ vrací správný kind/location (tel: prefix, sms s encoded body, mailto s query paramy); vcard obsahuje vcf string; text/wifi → html.
- [ ] Pages testy: wifi stránka obsahuje SSID text, `data:image/png;base64,` QR, tlačítko s inline skriptem `navigator.clipboard.writeText`; 404/inactive/blocked obsahují správné i18n titulky a status kódy (404 / 503 / 451-ish → použij 404, 503, 403).
- [ ] Route `src/app/[hash]/route.ts`: načte podle hash (index lookup), neexistuje/smazán → `new Response(branded404Html(), {status:404})`; adminBlocked → 403; !isActive → 503; jinak podle Resolution — redirect: `{status:302,headers:{Location, 'Cache-Control':'no-store'}}`; vcard: `Content-Type: text/vcard; charset=utf-8`, `Content-Disposition: attachment; filename="kontakt.vcf"`; html: 200 + `Cache-Control: no-store`. Sken loguj přes `after(() => prisma.scan.create(...))` s user-agent z hlavičky.
- [ ] Manuální smoke: `curl -si localhost:3000/zzzzzzz` → 404 branded; seednutý url kód → 302 + Location + no-store.
- [ ] Run: `pnpm vitest run` PASS. Commit: `feat: redirect endpoint with per-type responses and branded status pages`

### Task 9: QR rendering + download endpoint

**Files:**
- Create: `src/lib/qr/render.ts`, `src/app/api/qr/[id]/download/route.ts`
- Test: `tests/render.test.ts`

**Interfaces:**
- Produces: `renderQr(content: string, format: 'png'|'svg', size?: number): Promise<Buffer|string>` — knihovna `qrcode`, ECC `M`, margin 2, width default 512 (png) / svg bez pevné šířky; jediné místo nastavení (spec §12).
- Download route: pouze owner (`session.user.id === qr.userId`, jinak 404 — netesit existenci), `?format=png|svg&size=512`; obsah podle typu: url→url, wifi→wifiString, vcard→vcardString, phone→`tel:…`, sms→sms string, email→mailto string, text→text. `Content-Disposition: attachment; filename="qrforlife-{hash}.png|svg"`.

- [ ] Testy: png Buffer začíná PNG magic bytes; svg string obsahuje `<svg`; stejné volání dvakrát → identický výstup (determinizmus); wifi content obsahuje `WIFI:T:WPA`.
- [ ] Run: PASS. Commit: `feat: qr rendering library and authenticated download endpoint`

### Task 10: Bezpečnost — whitelist, Safe Browsing

**Files:**
- Create: `src/lib/security/url-safety.ts`, `src/lib/security/safe-browsing.ts`, `src/instrumentation.ts`
- Test: `tests/url-safety.test.ts`, `tests/safe-browsing.test.ts`

**Interfaces:**
- Produces: `assertSafeHttpUrl(raw: string): string | null` (parse přes `new URL`, jen `http:`/`https:`, blokuj `javascript:`,`data:`,`vbscript:`, credentials v URL, vrátí normalizovaný href nebo null); `checkSafeBrowsing(url): Promise<'ok'|'unsafe'>` (GSB v4 threatMatches.find, klíč z env, timeout 3 s, chyba API → 'ok' fail-open + console.warn); `startSafeBrowsingSweep()` — interval 12 h: projde url-kódy, unsafe → `adminBlocked=true, blockedReason='safe-browsing'`; voláno z `src/instrumentation.ts` `register()` pouze pokud `GOOGLE_SAFE_BROWSING_KEY` nastaveno a jen v nodejs runtime.

- [ ] Testy: `https://example.com/x` ok; `http://example.com` ok; `javascript:alert(1)`, `data:text/html,x`, `ftp://x`, `https://u:p@evil.com` → null; safe-browsing modul s fetch mockem: match → 'unsafe', síťová chyba → 'ok'.
- [ ] Run: PASS. Commit: `feat: url scheme whitelist and google safe browsing integration`

### Task 11: Layout + homepage + globální 404

**Files:**
- Create: `src/app/layout.tsx` (final), `src/app/page.tsx` (final), `src/app/not-found.tsx`, `src/components/site-header.tsx`, `src/site-footer.tsx`
- Design systém: barvy — ink `#141210`, papír `#FDFCFA`, akcent signal-orange `#FF4A00`; font Space Grotesk (headings) + Inter (text) přes `next/font/google`; hodně bílého prostoru, velká pevná typografie, hrany zaoblené málo (radius 6px), žádné gradienty, žádný fialový SaaS look. Všechny stringy z `texts.home.*`.

Struktura homepage:
- Header: logo text „QRforLife", vpravo „Přihlásit se" (ghost) + „Registrovat" (accent button).
- Hero: obří nadpis „Vytiskneš jednou. Měníš kdykoliv." + podnadpis vysvětlující dynamické kódy + CTA „Vytvořit první kód zdarma" + ukázkový QR obrázek (statický placeholder SVG s popiskem, že kód vede kamkoliv).
- Sekce „Proč dynamický kód": 4 řádky static vs. dynamický (překlep v URL, změna otevírací doby, přesun akce, zrušená stránka) — dvousloupcové porovnání, statický sloupec přeškrtnutý/šedý.
- Sekce „Kde se hodí": 6 kartiček scénářů (výloha/menu, stroj/rozvaděč/revizní zpráva, Wi-Fi provozovna/chalupa, vizitka/polep auta, leták/plachta/program ročníku, štítek výrobku/návod+záruka) — ikona, nadpis, jeden odstavec.
- Footer: CTA blok „Vytiskni jednou, měň navždy" + tlačítka Přihlásit/Registrovat, copyright, odkaz na GitHub repo.
- [ ] `not-found.tsx`: velký nadpis z `texts.notfound.title`, podtext, odkaz domů. Stejný vizuální jazyk jako branded404Html z Task 8.
- [ ] Kontrola: `grep -r '"' src/app src/components --include='*.tsx'` — žádné uživatelské stringy mimo i18n import (technické atributy jako `alt=""` ok).
- [ ] Run: `pnpm build` PASS. Commit: `feat: homepage, layout, global 404`

### Task 12: Auth UI

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/components/auth-form.tsx` (client), `src/app/(auth)/verify-info/page.tsx`
- Chování: formuláře POSTí fetchem na API z Task 6; chyby zobrazit pod polem (i18n klíče); po registraci → info stránka „Otevři si e-mail a klikni na odkaz" + tlačítko „Odeslat odkaz znovu" (volá reset/request s e-mailem); login → `/dashboard`; `?verified=1` → banner „E-mail ověřen, přihlas se"; Apple button viditelný jen když `appleConfigured()` (server-side prop).

- [ ] Run: `pnpm build` PASS; ručně projít registrační flow proti dev DB. Commit: `feat: auth ui pages`

### Task 13: Dashboard — CRUD API + UI

**Files:**
- Create: `src/app/api/qr/route.ts` (POST create), `src/app/api/qr/[id]/route.ts` (PATCH update, DELETE), `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/new/page.tsx`, `src/app/dashboard/[id]/page.tsx` (editace), `src/components/qr-card.tsx`, `src/components/qr-type-form.tsx` (client), `src/components/copy-field.tsx`
- API kontrakt:
  - `POST /api/qr {type,name,payload}`: session nutná (401), `emailVerifiedAt` nutné (403 `texts.dashboard.verifyFirst`), rate limit 30/hod/IP, `payloadSchema` validace (400), hash generování s retry na P2002 (max 5 pokusů, pak 500), odpověď `{id, hash, url}`.
  - `PATCH /api/qr/[id] {name?, type?, payload?, isActive?}`: pouze owner (jinak 404), validace payloadu při změně typu/dat, `updatedAt` automatické.
  - `DELETE /api/qr/[id]`: pouze owner, cascade maže scany.
- UI:
  - Seznam: grid karet — název (inline edit), náhled `<img src="/api/qr/[id]/download?format=png&size=256">`, typ badge, hash + celá URL s tlačítkem kopírovat, počet skenů (COUNT ze scans), datum vytvoření, přepínač aktivní/pozastavený (PATCH), tlačítka PNG/SVG (download linky), Smazat (potvrzovací dialog s varováním z i18n).
  - Nový kód: krok 1 dlaždice 7 typů s ikonami a popisky; krok 2 formulář podle typu (pole definovaná v `texts.qr.fields.*`); krok 3 název; odeslání → redirect na seznam s highlight nové karty.
  - Editace: stejný formulář předvyplněný + náhled + download.
- [ ] Run: `pnpm build` PASS; manuální flow: vytvoř URL kód, změň cíl, ověř v DB. Commit: `feat: dashboard with qr code management ui and crud api`

### Task 14: Scans statistika

**Files:**
- Modify: `src/app/[hash]/route.ts` (after-log z Task 8 doplnit o country z `CF-IPCountry` hlavičky pokud je), `src/app/dashboard/page.tsx` (počet skenů agregací)
- [ ] Ověření: curl na redirect zvýší počet skenů v DB. Commit: `feat: scan counting on redirect`

### Task 15: Admin

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/api/admin/qr/[id]/block/route.ts`
- Chování: stránka jen pro `role=admin` (jinak redirect `/login`); tabulka všech kódů (owner e-mail, hash, typ, aktivní, blocked), tlačítko Blokovat/Odblokovat s důvodem (`blockedReason`). API kontroluje roli server-side.

- [ ] Run: `pnpm build` PASS. Commit: `feat: admin panel with code blocking`

### Task 16: LICENSE, README, Docker, GitHub push

**Files:**
- Create: `LICENSE` (MIT, Copyright (c) 2026 bohous04), `README.md`, `Dockerfile`
- Dockerfile: multi-stage, `node:20-alpine`, `output: standalone`, non-root user.
- README (čeština): co to je, quickstart (compose up, migrate dev, dev), env proměnné tabulka, deploy na Coolify, licence MIT.
- [ ] `gh auth status` — pokud nepřihlášeno, požádat uživatele o `gh auth login`.
- [ ] `gh repo create bohous04/qrforlife --public --source . --push` (remote origin). Expected: repo public na GitHubu.
- [ ] Commit + push: `chore: mit license, readme, dockerfile`

### Task 17: Deploy na LNRT Coolify

**Files:** žádné v repu (infrastruktura přes MCP `mcp__lnrt-coolify__*`)

- [ ] Vytvořit PostgreSQL službu v Coolify (project dle LNRT instančního nastavení), zaznamenat interní connection string.
- [ ] Vytvořit aplikaci z GitHub repa `bohous04/qrforlife` (Dockerfile build), port 3000.
- [ ] Env proměnné: `DATABASE_URL` (z Postgres služby), `SESSION_SECRET` (openssl rand -hex 32), `NEXT_PUBLIC_APP_URL`, `SMTP_*` (od uživatele), `APPLE_*` (od uživatele), `GOOGLE_SAFE_BROWSING_KEY` (pokud má), `ADMIN_EMAIL` (uživatelův e-mail).
- [ ] `prisma migrate deploy` jako release/start command (start: `npx prisma migrate deploy && node server.js`).
- [ ] Doména: pracovní Coolify URL; `qrforlife.cz` až dodá DNS.
- [ ] Verify: `curl -si https://<domena>/zzzzzzz` → branded 404; vytvořit test kód přes UI → 302 funguje.

### Task 18: E2E testy (Playwright)

**Files:**
- Create: `playwright.config.ts`, `e2e/specs/full-flow.spec.ts`, `e2e/fixtures/db.ts`
- Config: webServer spustí `next start` proti E2E databázi (migrate deploy před startem).

Scénáře (mapují acceptance criteria zadání):
1. Registrace → ověření tokenu přímo z DB → login.
2. Vytvoření URL kódu → GET `/api/qr/[id]/download?format=png` vrací PNG magic bytes → GET `/{hash}` 302 na cíl s `no-store`.
3. PATCH cíle → tentýž `/{hash}` → 302 na nový cíl.
4. Wi-Fi kód → GET `/{hash}` → 200, obsahuje SSID a „Kopírovat heslo".
5. Neexistující hash → 404 branded.
6. Pozastavený kód → 503 „dočasně neaktivní".
7. Odhlášení → `GET /api/qr/[id]` PATCH/DELETE cizím uživatelem → 404; GET download → 404.
8. Neověřený e-mail → POST /api/qr → 403.

- [ ] Run: `pnpm playwright test` — všechny PASS. Commit: `test: e2e acceptance flows`
- [ ] Finální kontrola: `pnpm build && pnpm vitest run && pnpm playwright test` vše zelené; push.

## Self-review poznámky

- Spec coverage: §2 redirect chování → T8; §3 hash → T3; §4 model → T2; §5 auth → T5–7, T12; §6 administrace → T13; §7 homepage → T11; §8 bezpečnost → T6, T10, T13 (verified gate), T15 (blokace); §9 i18n → T2 + grep kontrola T11; §12 QR jedna knihovna → T9; §14 deploy → T16–17; acceptance → T18. Pokryto.
- Typy konzistentní napříč tasks (QrPayloadMap, Resolution, texts).
