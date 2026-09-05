# QR4Life

Dynamické QR kódy. Vytiskneš jednou, měníš kdykoliv — vygenerovaný kód obsahuje
jen krátkou URL `https://qr.lnrtdev.cz/{hash}`, cíl se spravuje na serveru.
Statický QR kód se po vytištění změnit nedá; tady stačí přepsat cíl v administraci.

Běží na [qr.lnrtdev.cz](https://qr.lnrtdev.cz).

<!-- screenshot: docs/screenshot.png (to be added) -->

## Co umí

- 7 typů kódů: **odkaz, Wi-Fi, vizitka (vCard), telefon, SMS, e-mail, text**
- Okamžitý redirect (HTTP 302, `Cache-Control: no-store`) — bez mezistránky
- Wi-Fi kód: stránka s SSID, heslem, tlačítkem „Kopírovat heslo" a nativním Wi-Fi QR
- Stažení PNG i SVG (náhled i download ze stejného renderu)
- Statistiky skenů
- Přihlášení e-mailem (argon2id, DB sessions) i přes Sign in with Apple
- Ověření e-mailu, reset hesla, rate limiting, whitelist schémat,
  volitelná Google Safe Browsing kontrola cílových URL
- Admin role: blokace kódů

## Rychlý start (vývoj)

```bash
pnpm install
docker compose up -d          # lokální PostgreSQL na portu 5433
cp .env.example .env          # doplň hodnoty
pnpm exec prisma migrate dev  # migrace
pnpm dev
```

Bez Dockeru: stačí jakýkoli PostgreSQL a `DATABASE_URL` v `.env`.

## Testy

```bash
pnpm test          # Vitest (unit + integrační)
pnpm build         # produkční build
pnpm exec playwright test   # E2E (vyžaduje běžící DB)
```

## Env proměnné

| Proměnná | Povinná | Popis |
| --- | --- | --- |
| `DATABASE_URL` | ano | PostgreSQL connection string |
| `SESSION_SECRET` | ano | HMAC secret pro Apple state (openssl rand -hex 32) |
| `NEXT_PUBLIC_APP_URL` | ano | Veřejná URL aplikace (např. `https://qr.lnrtdev.cz`) |
| `ADMIN_EMAIL` | ne | E-mail, který se při registraci stane adminem |
| `SMTP_HOST` / `SMTP_PORT` | ne | SMTP pro ověřovací a reset e-maily (bez nich se logují do konzole) |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | ne | SMTP přihlašovací údaje |
| `APPLE_SERVICES_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | ne | Sign in with Apple (bez nich se tlačítko nezobrazí) |
| `GOOGLE_SAFE_BROWSING_KEY` | ne | Kontrola cílových URL (bez ní běží jen whitelist schémat) |

## Deploy

Aplikace se nasazuje jako Docker image (`Dockerfile`, Next.js standalone).
Při startu běží `prisma migrate deploy` a pak `node server.js`.

## Licence

[MIT](LICENSE)
