# QR4Life — statický režim kódu a zvuková stopa

Návrh dvou funkcí navazujících na hotovou aplikaci QR4Life (viz `docs/superpowers/specs/2026-08-25-qr4life-design.md`).

## Cíl

1. **Přepínač statický / dynamický** při vytváření kódu. Statický kód nese obsah přímo v obrázku, takže čtečka nemusí nikam chodit — u Wi-Fi, vizitky a textu je to znatelně rychlejší a funguje to i bez internetu. Cenou je nezměnitelnost.
2. **Zvuková stopa jako cíl kódu.** Uživatel při vytváření kódu proklikem vybere krátkou skladbu ze souborů; naskenování otevře brandovanou stránku s přehrávačem.

## Rozhodnutí

| Otázka | Rozhodnutí |
| --- | --- |
| Kde nabízet statický režim | Wi-Fi, vCard, text, telefon, SMS, e-mail. `url` a `audio` zůstávají vždy dynamické. |
| Úložiště zvuku | Postgres `bytea` — bez nové infrastruktury, kryté zálohami databáze. |
| Přehrávání | Brandovaná stránka s přehrávačem ve stylu stávající Wi-Fi stránky. |
| Limity zvuku | 15 MB na soubor, formáty MP3 / M4A / OGG / WAV, 20 stop na uživatele. |
| Editace statického kódu | Obsah jde měnit, ale s výrazným varováním, že vytištěné cedule vedou na staré údaje. |
| Nahrávání | Dvoufázové — soubor se nahraje hned po výběru, kód se pak uloží s odkazem na stopu. |

## Datový model

```prisma
enum QrMode {
  dynamic
  static
}

enum QrType {
  url
  wifi
  vcard
  phone
  sms
  email
  text
  audio // nový
}

model QrCode {
  // …stávající pole…
  mode       QrMode      @default(dynamic)
  audioTrack AudioTrack?
}

model AudioTrack {
  id        String   @id @default(cuid())
  userId    String
  qrCodeId  String?  @unique // null = nahráno, ale formulář ještě neuložen
  filename  String
  mime      String
  size      Int
  data      Bytes
  createdAt DateTime @default(now())

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  qrCode QrCode? @relation(fields: [qrCodeId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Migrace přidá enum `QrMode`, hodnotu `audio` do `QrType`, sloupec `QrCode.mode` s výchozí hodnotou `dynamic` a tabulku `AudioTrack`. Stávající kódy tím zůstávají dynamické.

Při 20 stopách po 15 MB může jeden uživatel držet až 300 MB v databázi. Limit počtu stop a úklid osiřelých nahrávek jsou proto součástí návrhu, ne volitelný doplněk.

## Statický režim

Nová čistá funkce `staticContent(type, payload): string` v `src/lib/qr/static-content.ts` vrací obsah, který se u statického kódu zakóduje přímo do obrázku:

| Typ | Obsah |
| --- | --- |
| `wifi` | `wifiString(payload)` |
| `vcard` | `vcardString(payload)` |
| `phone` | `tel:{number}` |
| `sms` | `sms:{number}?body=…` |
| `email` | `mailto:{to}?subject=…&body=…` |
| `text` | holý text |

Volá ji jediné místo — download endpoint `/api/qr/[id]/download`, který podle `qr.mode` vybere buď `staticContent(...)`, nebo dosavadní `{appUrl}/{hash}`. Nastavení renderu (knihovna `qrcode`, ECC M) zůstává společné pro obě větve.

Statické kódy dostávají hash jako dosud a `/{hash}` u nich funguje normálně. Nikde není vytištěný, ale konzistence stojí za víc než ušetřený řádek kódu.

Chování v administraci:

- Přepínač `Dynamický / Statický` je v kroku s formulářem, jen u podporovaných typů; výchozí je dynamický.
- Režim se po vytvoření nemění.
- Změna obsahu statického kódu projde, ale formulář i karta ukážou varování, že se obrázek změnil a staré cedule vedou na staré údaje, spolu s odkazem na nové stažení.
- Statická karta neukazuje počet skenů ani přepínač pozastavení — u kódu, který nikdo neprochází přes redirect, by obojí lhalo.

## Zvuková stopa

### Nahrání

`POST /api/audio` přijímá `multipart/form-data` s jedním souborem. Vyžaduje přihlášení a ověřený e-mail, stejně jako vytvoření kódu. Kontroly v pořadí:

1. Velikost ≤ 15 MB — soubor se čte streamem a při překročení se request utne s 413, aby se do paměti nedostal celý.
2. Typ podle magic bytes prvních bajtů, ne podle hlavičky od prohlížeče: `ID3` nebo `FF FB` (MP3), `ftyp` na offsetu 4 (M4A), `OggS` (OGG), `RIFF` + `WAVE` (WAV). Cokoli jiného → 415.
3. Počet stop uživatele < 20, jinak 409.
4. Rate limit 20 nahrání za hodinu na IP.

Odpověď `201 { id, filename, size }`. Stopa vzniká bez `qrCodeId`.

`POST /api/qr` s `type: 'audio'` bere payload `{ trackId, title }`. Ověří, že stopa patří přihlášenému uživateli a nemá ještě `qrCodeId`; jinak 400. Při úspěchu stopu k novému kódu přiváže. Editace kódu umí `trackId` vyměnit za jinou volnou stopu téhož uživatele; odpojená stopa se maže.

Osiřelé stopy (bez `qrCodeId`, starší 24 hodin) maže periodický úklid v `src/instrumentation.ts` vedle stávajícího Safe Browsing sweepu.

### Přehrávání

Sken `/{hash}` vrátí HTML stránku ze `src/lib/qr/pages-html.ts` ve stejném vizuálním jazyce jako Wi-Fi stránka: název stopy, velké tlačítko přehrát, pruh průběhu, pokus o autoplay s tlačítkem jako záložním řešením. Bez externích zdrojů, texty z `cs.ts`.

Zvuk teče z `/{hash}/audio`, ne z URL obsahující id stopy. Díky tomu platí stavy kódu — pozastavený vrací 503, zablokovaný 403, smazaný 404 — a id souboru nikam neuniká. Endpoint posílá `Content-Type` podle `mime`, `Accept-Ranges: bytes` a umí odpovědět na `Range` request částí `206`, aby šlo v přehrávači přetáčet.

Sken se počítá jednou při načtení stránky `/{hash}`, ne při každém requestu na `/{hash}/audio` — jinak by přetáčení nafukovalo statistiku.

## UI

- Krok 1 formuláře nového kódu dostane osmou dlaždici **Zvuk** s ikonou a popiskem.
- Formulář zvuku: výběr souboru, ukazatel průběhu nahrávání, přehrání ukázky před uložením, pole název. Chyby (velký soubor, nepodporovaný formát, vyčerpaný limit) se zobrazují pod polem.
- Formuláře ostatních typů dostanou nad poli segmentový přepínač režimu s jednou vysvětlující větou u každé volby.
- Karta kódu v přehledu ukazuje odznak **Statický**, u statických skrývá počet skenů a přepínač pozastavení.
- Editace zvukového kódu umí vyměnit stopu za jinou.
- Všechny nové texty patří do `src/lib/i18n/cs.ts`.

## Testy

**Unit**

- `staticContent` pro všech šest podporovaných typů vrací očekávaný řetězec; `url` a `audio` vyhodí chybu.
- Sniffování magic bytes: platné hlavičky MP3 / M4A / OGG / WAV projdou; přejmenovaný spustitelný soubor, prázdný soubor a soubor kratší než hlavička neprojdou.
- Payload schéma `audio`: chybějící `trackId` neprojde, neznámé klíče se odstraní.

**E2E**

- Statický Wi-Fi kód: stažené PNG je bajt v bajt shodné s `renderQr(wifiString(payload))`, zatímco dynamický kód téhož obsahu se rovná `renderQr('{appUrl}/{hash}')`.
- Nahrání malé MP3 → vytvoření kódu → `/{hash}` obsahuje přehrávač → `/{hash}/audio` vrací 200, `audio/mpeg` a `Accept-Ranges: bytes`; `Range: bytes=0-99` vrací 206.
- Pozastavený zvukový kód: `/{hash}/audio` vrací 503.
- Cizí `trackId` při vytvoření kódu → 400.
- Soubor přes 15 MB → 413; přejmenovaný soubor jiného typu → 415.

## Co záměrně není součástí

- Konverze ani normalizace zvuku na serveru — soubor se ukládá tak, jak přišel.
- Vynucování `plan` u limitů. Limit 20 stop platí pro všechny stejně, `plan` zůstává nevynucené pole jako dosud.
- Streamování z CDN nebo S3. Při současném objemu by to byla složitost navíc; pokud databáze poroste, je přesun dat z `bytea` do objektového úložiště samostatná změna.
