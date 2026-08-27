# QR4Life — statický režim a zvuková stopa: implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat do QR4Life volbu statického kódu (obsah přímo v obrázku) a nový typ kódu `audio` s nahráním krátké skladby.

**Architecture:** Statický režim je jeden sloupec `QrCode.mode` a jedna čistá funkce `staticContent()`, kterou volá výhradně download endpoint. Zvuk je nová tabulka `AudioTrack` s `bytea`, dvoufázový upload (`POST /api/audio` → `POST /api/qr`) a přehrávací stránka na `/{hash}` streamující zvuk z `/{hash}/audio`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma 6 + PostgreSQL 16, Zod, Vitest, Playwright.

Spec: `docs/superpowers/specs/2026-08-27-qr4life-static-mode-and-audio-design.md`

## Global Constraints

- Všechny uživatelské texty jen z `src/lib/i18n/cs.ts`, žádné natvrdo zapsané stringy v komponentách ani v HTML stránkách.
- Statický režim je povolený jen pro typy `wifi`, `vcard`, `phone`, `sms`, `email`, `text`. Typy `url` a `audio` jsou vždy dynamické.
- Režim kódu se po vytvoření nemění.
- Limit zvuku: 15 MB na soubor, 20 stop na uživatele, formáty MP3 / M4A / OGG / WAV.
- Typ souboru se určuje z magic bytes, nikdy z hlavičky `Content-Type` od klienta.
- Redirect zůstává vždy 302 s `Cache-Control: no-store`; nové HTML stránky posílají `no-store` také.
- Cizí kód ani cizí stopa nesmí být dostupná přes žádné API bez vlastnictví (admin má výjimku jen na náhled QR, jak už je dnes).
- Git: časté commity, prefixy `feat`/`fix`/`test`/`chore`/`docs`.
- Testovací databáze: `postgresql://qr4life:qr4life@localhost:5432/qr4life`.

---

### Task 1: Datový model — režim kódu a tabulka stop

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_static_mode_and_audio/migration.sql` (vygeneruje Prisma)
- Test: `tests/audio-track.test.ts`

**Interfaces:**
- Produces: Prisma typy `QrMode` (`dynamic` | `static`), `QrType.audio`, `QrCode.mode`, model `AudioTrack` s poli `id`, `userId`, `qrCodeId`, `filename`, `mime`, `size`, `data`, `createdAt`.

- [ ] **Step 1: Rozšířit schéma**

V `prisma/schema.prisma` přidej enum a hodnotu typu:

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
  audio
}
```

Do modelu `QrCode` přidej pole (za `payload`):

```prisma
  mode          QrMode   @default(dynamic)
```

a do relací modelu `QrCode`:

```prisma
  audioTrack AudioTrack?
```

Do modelu `User` přidej relaci:

```prisma
  audioTracks AudioTrack[]
```

Na konec souboru přidej model:

```prisma
model AudioTrack {
  id        String   @id @default(cuid())
  userId    String
  qrCodeId  String?  @unique
  filename  String
  mime      String
  size      Int
  data      Bytes
  createdAt DateTime @default(now())

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  qrCode QrCode? @relation(fields: [qrCodeId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
}
```

- [ ] **Step 2: Vytvořit migraci**

Run: `pnpm exec prisma migrate dev -n static_mode_and_audio`
Expected: `Your database is now in sync with your schema.` a nový adresář v `prisma/migrations/`.

- [ ] **Step 3: Napsat test, který zatím selže**

Vytvoř `tests/audio-track.test.ts`:

```ts
import { describe, expect, it, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AudioTrack', () => {
  it('uloží binární data a smaže se s kódem', async () => {
    const user = await prisma.user.create({
      data: { email: `track-${Date.now()}@example.com`, emailVerifiedAt: new Date() },
    });
    const qr = await prisma.qrCode.create({
      data: {
        userId: user.id,
        hash: `t${Date.now().toString(36).slice(-6)}`,
        name: 'Stopa',
        type: 'audio',
        payload: { trackId: 'placeholder' },
      },
    });
    const track = await prisma.audioTrack.create({
      data: {
        userId: user.id,
        qrCodeId: qr.id,
        filename: 'song.mp3',
        mime: 'audio/mpeg',
        size: 3,
        data: Buffer.from([1, 2, 3]),
      },
    });

    const loaded = await prisma.audioTrack.findUniqueOrThrow({ where: { id: track.id } });
    expect(Buffer.from(loaded.data)).toEqual(Buffer.from([1, 2, 3]));

    await prisma.qrCode.delete({ where: { id: qr.id } });
    expect(await prisma.audioTrack.findUnique({ where: { id: track.id } })).toBeNull();

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('nový kód je defaultně dynamický', async () => {
    const user = await prisma.user.create({
      data: { email: `mode-${Date.now()}@example.com` },
    });
    const qr = await prisma.qrCode.create({
      data: {
        userId: user.id,
        hash: `m${Date.now().toString(36).slice(-6)}`,
        name: 'Kód',
        type: 'text',
        payload: { text: 'ahoj' },
      },
    });
    expect(qr.mode).toBe('dynamic');
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

- [ ] **Step 4: Spustit test**

Run: `pnpm vitest run tests/audio-track.test.ts`
Expected: PASS (migrace už proběhla ve Step 2).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/audio-track.test.ts
git commit -m "feat: qr mode column and audio track model"
```

---

### Task 2: Obsah statického kódu

**Files:**
- Create: `src/lib/qr/static-content.ts`
- Test: `tests/static-content.test.ts`

**Interfaces:**
- Consumes: `wifiString` ze `src/lib/qr/wifi-string.ts`, `vcardString` ze `src/lib/qr/vcard.ts`, `payloadSchema` ze `src/lib/qr/payload-schema.ts`.
- Produces:
  - `STATIC_CAPABLE_TYPES: readonly ['wifi','vcard','phone','sms','email','text']`
  - `type StaticQrType = (typeof STATIC_CAPABLE_TYPES)[number]`
  - `isStaticCapable(type: string): type is StaticQrType`
  - `staticContent(type: StaticQrType, payload: unknown): string | null` — `null` při nevalidním payloadu.

- [ ] **Step 1: Napsat failing test**

Vytvoř `tests/static-content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isStaticCapable, staticContent } from '@/lib/qr/static-content';

describe('isStaticCapable', () => {
  it('povolí jen typy bez závislosti na serveru', () => {
    expect(isStaticCapable('wifi')).toBe(true);
    expect(isStaticCapable('text')).toBe(true);
    expect(isStaticCapable('url')).toBe(false);
    expect(isStaticCapable('audio')).toBe(false);
  });
});

describe('staticContent', () => {
  it('wifi vrací WIFI: řetězec', () => {
    expect(staticContent('wifi', { ssid: 'Home', password: null, hidden: false })).toBe(
      'WIFI:T:nopass;S:Home;;',
    );
  });

  it('vcard vrací vCard dokument', () => {
    const vcf = staticContent('vcard', { firstName: 'Jan', phone: '+420123456789' });
    expect(vcf).toContain('BEGIN:VCARD');
    expect(vcf).toContain('FN:Jan');
  });

  it('phone, sms a email vrací URI schémata', () => {
    expect(staticContent('phone', { number: '+420 123 456 789' })).toBe('tel:+420123456789');
    expect(staticContent('sms', { number: '+420123456789', body: 'ahoj ty' })).toBe(
      'sms:+420123456789?body=ahoj%20ty',
    );
    expect(staticContent('email', { to: 'a@b.cz', subject: 'Hej' })).toBe(
      'mailto:a@b.cz?subject=Hej',
    );
  });

  it('text vrací holý text', () => {
    expect(staticContent('text', { text: 'Zavírací doba 8–17' })).toBe('Zavírací doba 8–17');
  });

  it('nevalidní payload vrací null', () => {
    expect(staticContent('phone', { number: 'nope' })).toBeNull();
  });
});
```

- [ ] **Step 2: Spustit test a ověřit, že selže**

Run: `pnpm vitest run tests/static-content.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/qr/static-content"`.

- [ ] **Step 3: Implementovat**

Vytvoř `src/lib/qr/static-content.ts`:

```ts
import { payloadSchema, type QrPayloadMap } from '@/lib/qr/payload-schema';
import { wifiString } from '@/lib/qr/wifi-string';
import { vcardString } from '@/lib/qr/vcard';

/**
 * Obsah statického kódu — to, co se zakóduje přímo do obrázku.
 * Dynamický kód místo toho kóduje {appUrl}/{hash}; rozhoduje download endpoint.
 */
export const STATIC_CAPABLE_TYPES = ['wifi', 'vcard', 'phone', 'sms', 'email', 'text'] as const;

export type StaticQrType = (typeof STATIC_CAPABLE_TYPES)[number];

export function isStaticCapable(type: string): type is StaticQrType {
  return (STATIC_CAPABLE_TYPES as readonly string[]).includes(type);
}

/** Telefonní číslo pro tel:/sms: — jen číslice a plus (stejně jako redirect-resolver). */
function telNumber(number: string): string {
  return number.replace(/[ ()-]/g, '');
}

export function staticContent(type: StaticQrType, payload: unknown): string | null {
  const parsed = payloadSchema(type, payload);
  if (!parsed) return null;

  switch (type) {
    case 'wifi':
      return wifiString(parsed as QrPayloadMap['wifi']);
    case 'vcard':
      return vcardString(parsed as QrPayloadMap['vcard']);
    case 'phone':
      return `tel:${telNumber((parsed as QrPayloadMap['phone']).number)}`;
    case 'sms': {
      const sms = parsed as QrPayloadMap['sms'];
      const body = sms.body ? `?body=${encodeURIComponent(sms.body)}` : '';
      return `sms:${telNumber(sms.number)}${body}`;
    }
    case 'email': {
      const email = parsed as QrPayloadMap['email'];
      const params = new URLSearchParams();
      if (email.subject) params.set('subject', email.subject);
      if (email.body) params.set('body', email.body);
      const query = params.toString();
      return `mailto:${email.to}${query ? `?${query}` : ''}`;
    }
    case 'text':
      return (parsed as QrPayloadMap['text']).text;
  }
}
```

- [ ] **Step 4: Spustit test**

Run: `pnpm vitest run tests/static-content.test.ts`
Expected: PASS. Pokud test `sms` selže na kódování mezery, ověř, že `encodeURIComponent('ahoj ty') === 'ahoj%20ty'` — očekávaná hodnota v testu je správná, oprav implementaci, ne test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/qr/static-content.ts tests/static-content.test.ts
git commit -m "feat: static qr content builder"
```

---

### Task 3: Rozpoznání zvukového formátu podle magic bytes

**Files:**
- Create: `src/lib/audio/sniff.ts`
- Test: `tests/audio-sniff.test.ts`

**Interfaces:**
- Produces:
  - `MAX_AUDIO_BYTES = 15 * 1024 * 1024`
  - `MAX_TRACKS_PER_USER = 20`
  - `AudioMime = 'audio/mpeg' | 'audio/mp4' | 'audio/ogg' | 'audio/wav'`
  - `detectAudioMime(bytes: Uint8Array): AudioMime | null`
  - `audioExtension(mime: AudioMime): string`

- [ ] **Step 1: Napsat failing test**

Vytvoř `tests/audio-sniff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { audioExtension, detectAudioMime } from '@/lib/audio/sniff';

function bytes(...values: (number | string)[]): Uint8Array {
  const out: number[] = [];
  for (const value of values) {
    if (typeof value === 'number') out.push(value);
    else for (const char of value) out.push(char.charCodeAt(0));
  }
  return new Uint8Array(out);
}

describe('detectAudioMime', () => {
  it('pozná MP3 s ID3 tagem i bez něj', () => {
    expect(detectAudioMime(bytes('ID3', 3, 0, 0, 0, 0, 0, 0))).toBe('audio/mpeg');
    expect(detectAudioMime(bytes(0xff, 0xfb, 0x90, 0x00, 0, 0, 0, 0))).toBe('audio/mpeg');
  });

  it('pozná M4A podle ftyp na offsetu 4', () => {
    expect(detectAudioMime(bytes(0, 0, 0, 0x20, 'ftypM4A '))).toBe('audio/mp4');
  });

  it('pozná OGG a WAV', () => {
    expect(detectAudioMime(bytes('OggS', 0, 2, 0, 0))).toBe('audio/ogg');
    expect(detectAudioMime(bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt '))).toBe('audio/wav');
  });

  it('odmítne cizí obsah', () => {
    expect(detectAudioMime(bytes('MZ', 0x90, 0, 0, 0, 0, 0))).toBeNull();
    expect(detectAudioMime(bytes(0x89, 'PNG', 13, 10, 26, 10))).toBeNull();
    expect(detectAudioMime(new Uint8Array())).toBeNull();
    expect(detectAudioMime(bytes('ID'))).toBeNull();
  });
});

describe('audioExtension', () => {
  it('mapuje mime na příponu', () => {
    expect(audioExtension('audio/mpeg')).toBe('mp3');
    expect(audioExtension('audio/mp4')).toBe('m4a');
    expect(audioExtension('audio/ogg')).toBe('ogg');
    expect(audioExtension('audio/wav')).toBe('wav');
  });
});
```

- [ ] **Step 2: Spustit test a ověřit, že selže**

Run: `pnpm vitest run tests/audio-sniff.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/audio/sniff"`.

- [ ] **Step 3: Implementovat**

Vytvoř `src/lib/audio/sniff.ts`:

```ts
/**
 * Rozpoznání zvukového formátu z prvních bajtů souboru.
 * Hlavičce Content-Type od prohlížeče se nevěří — dá se přepsat.
 */

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
export const MAX_TRACKS_PER_USER = 20;

export type AudioMime = 'audio/mpeg' | 'audio/mp4' | 'audio/ogg' | 'audio/wav';

const EXTENSIONS: Record<AudioMime, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
};

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectAudioMime(bytes: Uint8Array): AudioMime | null {
  if (bytes.length < 12) return null;

  if (ascii(bytes, 0, 3) === 'ID3') return 'audio/mpeg';
  // MPEG frame sync: 11 jedniček — 0xFF následované 0xE0..0xFF
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (ascii(bytes, 4, 4) === 'ftyp') return 'audio/mp4';
  if (ascii(bytes, 0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return 'audio/wav';

  return null;
}

export function audioExtension(mime: AudioMime): string {
  return EXTENSIONS[mime];
}
```

- [ ] **Step 4: Spustit test**

Run: `pnpm vitest run tests/audio-sniff.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/sniff.ts tests/audio-sniff.test.ts
git commit -m "feat: audio format sniffing by magic bytes"
```

---

### Task 4: Payload schéma zvukového kódu

**Files:**
- Modify: `src/lib/qr/payload-schema.ts`
- Test: `tests/payload-schema.test.ts` (přidat popis)

**Interfaces:**
- Produces: `QrPayloadMap['audio'] = { trackId: string; title?: string }`, typ `QrPayloadType` nově zahrnuje `'audio'`.

- [ ] **Step 1: Přidat failing test**

Na konec `tests/payload-schema.test.ts` přidej:

```ts
describe('audio payload', () => {
  it('vyžaduje trackId ve tvaru cuid', () => {
    expect(payloadSchema('audio', { trackId: 'cmta6j8dh0008pppuer6q0fww' })).toEqual({
      trackId: 'cmta6j8dh0008pppuer6q0fww',
    });
    expect(payloadSchema('audio', {})).toBeNull();
    expect(payloadSchema('audio', { trackId: 'x' })).toBeNull();
  });

  it('bere volitelný název stopy a zahazuje neznámé klíče', () => {
    expect(
      payloadSchema('audio', {
        trackId: 'cmta6j8dh0008pppuer6q0fww',
        title: 'Znělka',
        evil: 1,
      }),
    ).toEqual({ trackId: 'cmta6j8dh0008pppuer6q0fww', title: 'Znělka' });
  });
});
```

- [ ] **Step 2: Spustit test a ověřit, že selže**

Run: `pnpm vitest run tests/payload-schema.test.ts`
Expected: FAIL — `payloadSchema('audio', …)` vrací `null` u validního vstupu (typ neexistuje).

- [ ] **Step 3: Implementovat**

V `src/lib/qr/payload-schema.ts` přidej schéma za `textPayload`:

```ts
const audioPayload = z
  .object({
    trackId: z.string().cuid(),
    title: optionalTrimmed(100),
  })
  .strip();
```

Do `QrPayloadMap` přidej řádek:

```ts
  audio: z.infer<typeof audioPayload>;
```

a do objektu `schemas`:

```ts
  audio: audioPayload,
```

- [ ] **Step 4: Spustit testy**

Run: `pnpm vitest run tests/payload-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/qr/payload-schema.ts tests/payload-schema.test.ts
git commit -m "feat: audio payload schema"
```

---

### Task 5: Upload endpoint `/api/audio`

**Files:**
- Create: `src/app/api/audio/route.ts`
- Modify: `e2e/full-flow.spec.ts`

**Interfaces:**
- Consumes: `detectAudioMime`, `MAX_AUDIO_BYTES`, `MAX_TRACKS_PER_USER` (Task 3), `getSessionUser`, `SESSION_COOKIE`, `hit`, `clientIp`.
- Produces: `POST /api/audio` (multipart, pole `file`) → `201 { id: string; filename: string; size: number; mime: string }`.
  Chyby: `401 unauthorized`, `403 email_not_verified`, `413 too_large`, `415 unsupported_type`, `409 track_limit`, `429 rate_limited`, `400 invalid`.

- [ ] **Step 1: Napsat failing e2e test**

Na konec `e2e/full-flow.spec.ts` přidej helper a test:

```ts
/** Minimální validní MP3: ID3 hlavička + výplň. */
function fakeMp3(sizeBytes = 2048): Buffer {
  const head = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
  return Buffer.concat([head, Buffer.alloc(Math.max(0, sizeBytes - head.length), 0x11)]);
}

test('upload zvuku: validní MP3 projde, cizí obsah ne', async ({ request }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);

  const ok = await request.post('/api/audio', {
    headers: { cookie },
    multipart: {
      file: { name: 'znelka.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3() },
    },
  });
  expect(ok.status()).toBe(201);
  const track = (await ok.json()) as { id: string; size: number; mime: string };
  expect(track.mime).toBe('audio/mpeg');
  expect(track.size).toBe(2048);

  // Přejmenovaný spustitelný soubor: přípona ani deklarovaný typ nepomůžou
  const fake = await request.post('/api/audio', {
    headers: { cookie },
    multipart: {
      file: {
        name: 'virus.mp3',
        mimeType: 'audio/mpeg',
        buffer: Buffer.from('MZ       '),
      },
    },
  });
  expect(fake.status()).toBe(415);
});
```

- [ ] **Step 2: Spustit test a ověřit, že selže**

Run: `pnpm playwright test -g "upload zvuku"`
Expected: FAIL — status 404, endpoint neexistuje.

- [ ] **Step 3: Implementovat endpoint**

Vytvoř `src/app/api/audio/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { hit } from '@/lib/security/rate-limit';
import { clientIp } from '@/lib/http';
import { detectAudioMime, MAX_AUDIO_BYTES, MAX_TRACKS_PER_USER } from '@/lib/audio/sniff';

/**
 * Nahrání zvukové stopy. Stopa vzniká bez vazby na kód; naváže ji až
 * POST /api/qr. Osiřelé stopy maže sweep po 24 h.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!user.emailVerifiedAt) {
    return NextResponse.json({ error: 'email_not_verified' }, { status: 403 });
  }
  if (hit(`audio-upload:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Velikost hlídáme ještě před parsováním těla, ať se velký soubor
  // vůbec nedostane do paměti.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_AUDIO_BYTES + 4096) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectAudioMime(new Uint8Array(buffer.subarray(0, 16)));
  if (!mime) return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });

  const count = await prisma.audioTrack.count({ where: { userId: user.id } });
  if (count >= MAX_TRACKS_PER_USER) {
    return NextResponse.json({ error: 'track_limit' }, { status: 409 });
  }

  const track = await prisma.audioTrack.create({
    data: {
      userId: user.id,
      filename: file.name.slice(0, 200) || 'audio',
      mime,
      size: buffer.byteLength,
      data: buffer,
    },
    select: { id: true, filename: true, size: true, mime: true },
  });

  return NextResponse.json(track, { status: 201 });
}
```

- [ ] **Step 4: Spustit test**

Run: `pnpm playwright test -g "upload zvuku"`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/audio/route.ts e2e/full-flow.spec.ts
git commit -m "feat: audio upload endpoint with magic byte validation"
```

---

### Task 6: Vytvoření a editace kódu s režimem a stopou

**Files:**
- Modify: `src/app/api/qr/route.ts`, `src/app/api/qr/[id]/route.ts`
- Modify: `e2e/full-flow.spec.ts`

**Interfaces:**
- Consumes: `isStaticCapable` (Task 2), `payloadSchema` s typem `audio` (Task 4).
- Produces: `POST /api/qr` přijímá navíc `mode?: 'dynamic' | 'static'`; pro `type: 'audio'` váže stopu podle `payload.trackId`. Nové chyby: `400 invalid_mode`, `400 invalid_track`. `PATCH /api/qr/[id]` odmítá změnu režimu (`400 mode_immutable`) a umí vyměnit stopu.

- [ ] **Step 1: Napsat failing e2e testy**

Na konec `e2e/full-flow.spec.ts` přidej:

```ts
test('statický režim: povolený u wifi, zakázaný u odkazu, neměnný', async ({ request }) => {
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());

  const wifi = await request.post('/api/qr', {
    headers: { cookie },
    data: {
      type: 'wifi',
      mode: 'static',
      name: 'Chalupa staticky',
      payload: { ssid: 'Chalupa', password: 'tajneheslo', hidden: false },
    },
  });
  expect(wifi.status()).toBe(201);
  const { id } = (await wifi.json()) as { id: string };

  const url = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'url', mode: 'static', name: 'Odkaz', payload: { url: 'https://example.com' } },
  });
  expect(url.status()).toBe(400);
  expect((await url.json()).error).toBe('invalid_mode');

  const switchMode = await request.patch(`/api/qr/${id}`, {
    headers: { cookie },
    data: { mode: 'dynamic' },
  });
  expect(switchMode.status()).toBe(400);
  expect((await switchMode.json()).error).toBe('mode_immutable');
});

test('zvukový kód: naváže stopu, cizí trackId odmítne', async ({ request }) => {
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());
  const upload = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'pisen.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3() } },
  });
  const track = (await upload.json()) as { id: string };

  const created = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'audio', name: 'Znělka', payload: { trackId: track.id, title: 'Znělka' } },
  });
  expect(created.status()).toBe(201);

  const strangerCookie = await registerAndGetVerifiedCookie(request, uniqueEmail());
  const stolen = await request.post('/api/qr', {
    headers: { cookie: strangerCookie },
    data: { type: 'audio', name: 'Kradená', payload: { trackId: track.id } },
  });
  expect(stolen.status()).toBe(400);
  expect((await stolen.json()).error).toBe('invalid_track');
});
```

- [ ] **Step 2: Spustit testy a ověřit, že selžou**

Run: `pnpm playwright test -g "statický režim|zvukový kód"`
Expected: FAIL — `mode` se ignoruje (201 místo 400) a `audio` typ neprojde `bodySchema`.

- [ ] **Step 3: Upravit `POST /api/qr`**

V `src/app/api/qr/route.ts` rozšiř `bodySchema`:

```ts
const bodySchema = z.object({
  type: z.enum(['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text', 'audio']),
  name: z.string().trim().min(1).max(100),
  mode: z.enum(['dynamic', 'static']).optional(),
  payload: z.unknown(),
});
```

Přidej import:

```ts
import { isStaticCapable } from '@/lib/qr/static-content';
```

Za validaci payloadu (za řádek `if (!payload) return …invalid_payload…`) vlož kontrolu režimu a stopy:

```ts
  const mode = body.data.mode ?? 'dynamic';
  if (mode === 'static' && !isStaticCapable(body.data.type)) {
    return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
  }

  // Zvukový kód musí ukazovat na vlastní dosud nenavázanou stopu.
  let trackId: string | null = null;
  if (body.data.type === 'audio') {
    const requested = (payload as { trackId: string }).trackId;
    const track = await prisma.audioTrack.findUnique({ where: { id: requested } });
    if (!track || track.userId !== user.id || track.qrCodeId !== null) {
      return NextResponse.json({ error: 'invalid_track' }, { status: 400 });
    }
    trackId = track.id;
  }
```

V `prisma.qrCode.create` doplň `mode` do `data`:

```ts
          payload: payload as object,
          mode,
```

a hned po úspěšném `create` (před `return NextResponse.json(...)`) naváž stopu:

```ts
      if (trackId) {
        await prisma.audioTrack.update({ where: { id: trackId }, data: { qrCodeId: qr.id } });
      }
```

- [ ] **Step 4: Upravit `PATCH /api/qr/[id]`**

V `src/app/api/qr/[id]/route.ts` rozšiř `patchSchema`:

```ts
const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text', 'audio']).optional(),
  payload: z.unknown().optional(),
  isActive: z.boolean().optional(),
  folderId: z.string().cuid().nullable().optional(),
  mode: z.enum(['dynamic', 'static']).optional(),
});
```

Za načtení `body` (hned za `if (!body.success) …`) přidej:

```ts
  // Režim je vlastnost vytištěného obrázku — po vytvoření se nemění.
  if (body.data.mode !== undefined && body.data.mode !== qr.mode) {
    return NextResponse.json({ error: 'mode_immutable' }, { status: 400 });
  }
```

Za validaci payloadu přidej výměnu stopy:

```ts
  // Výměna zvukové stopy: nová musí patřit uživateli a být volná, stará se maže.
  if (type === 'audio') {
    const requested = (payload as { trackId: string }).trackId;
    const track = await prisma.audioTrack.findUnique({ where: { id: requested } });
    if (!track || track.userId !== user.id || (track.qrCodeId !== null && track.qrCodeId !== qr.id)) {
      return NextResponse.json({ error: 'invalid_track' }, { status: 400 });
    }
    if (track.qrCodeId === null) {
      await prisma.audioTrack.deleteMany({ where: { qrCodeId: qr.id, id: { not: track.id } } });
      await prisma.audioTrack.update({ where: { id: track.id }, data: { qrCodeId: qr.id } });
    }
  } else {
    // Změna typu pryč od zvuku odpojenou stopu nemá komu nechat.
    await prisma.audioTrack.deleteMany({ where: { qrCodeId: qr.id } });
  }
```

- [ ] **Step 5: Spustit testy**

Run: `pnpm playwright test -g "statický režim|zvukový kód"`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/qr/route.ts "src/app/api/qr/[id]/route.ts" e2e/full-flow.spec.ts
git commit -m "feat: qr api accepts mode and binds audio tracks"
```

---

### Task 7: Download endpoint respektuje režim

**Files:**
- Modify: `src/app/api/qr/[id]/download/route.ts`
- Modify: `e2e/full-flow.spec.ts`

**Interfaces:**
- Consumes: `staticContent`, `isStaticCapable` (Task 2).
- Produces: stažený obrázek statického kódu kóduje `staticContent(...)`, dynamický dál `{appUrl}/{hash}`.

- [ ] **Step 1: Napsat failing e2e test**

Na konec `e2e/full-flow.spec.ts` přidej:

```ts
test('statický kód kóduje obsah, dynamický kóduje odkaz', async ({ request }) => {
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());
  const payload = { ssid: 'Chalupa', password: 'tajneheslo', hidden: false };

  const staticCode = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'wifi', mode: 'static', name: 'Staticky', payload },
  });
  const { id: staticId } = (await staticCode.json()) as { id: string };

  const dynamicCode = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'wifi', name: 'Dynamicky', payload },
  });
  const { id: dynamicId } = (await dynamicCode.json()) as { id: string };

  const [staticPng, dynamicPng] = await Promise.all([
    request.get(`/api/qr/${staticId}/download?format=png&size=256`, { headers: { cookie } }),
    request.get(`/api/qr/${dynamicId}/download?format=png&size=256`, { headers: { cookie } }),
  ]);
  expect(staticPng.status()).toBe(200);
  expect(dynamicPng.status()).toBe(200);

  // Stejný obsah, jiný režim ⇒ jiný obrázek.
  expect(Buffer.from(await staticPng.body()).equals(Buffer.from(await dynamicPng.body()))).toBe(
    false,
  );

  // Statický obrázek musí být shodný s přímým renderem WIFI: řetězce.
  const { renderQr } = await import('../src/lib/qr/render');
  const { wifiString } = await import('../src/lib/qr/wifi-string');
  const expected = (await renderQr(wifiString({ ...payload }), 'png', 256)) as Buffer;
  expect(Buffer.from(await staticPng.body()).equals(expected)).toBe(true);
});
```

- [ ] **Step 2: Spustit test a ověřit, že selže**

Run: `pnpm playwright test -g "statický kód kóduje"`
Expected: FAIL — oba obrázky jsou shodné, protože download zatím kóduje vždy `/{hash}`.

- [ ] **Step 3: Implementovat**

V `src/app/api/qr/[id]/download/route.ts` přidej import:

```ts
import { isStaticCapable, staticContent } from '@/lib/qr/static-content';
```

a nahraď řádek `const content = ...` blokem:

```ts
  // Statický kód nese obsah přímo; dynamický kóduje krátkou redirect URL.
  let content = `${appUrl()}/${qr.hash}`;
  if (qr.mode === 'static' && isStaticCapable(qr.type)) {
    const direct = staticContent(qr.type, qr.payload);
    if (!direct) return new Response(null, { status: 404 });
    content = direct;
  }
```

- [ ] **Step 4: Spustit test**

Run: `pnpm playwright test -g "statický kód kóduje"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/qr/[id]/download/route.ts" e2e/full-flow.spec.ts
git commit -m "feat: download encodes static content for static codes"
```

---

### Task 8: Přehrávací stránka a stream zvuku

**Files:**
- Modify: `src/lib/qr/redirect-resolver.ts`, `src/lib/qr/pages-html.ts`, `src/app/[hash]/route.ts`, `src/lib/i18n/cs.ts`
- Create: `src/app/[hash]/audio/route.ts`
- Test: `tests/pages-html.test.ts` (přidat popis), `e2e/full-flow.spec.ts`

**Interfaces:**
- Produces:
  - `Resolution` nově obsahuje `{ kind: 'audio'; title: string }`
  - `audioPageHtml(params: { title: string; src: string }): string`
  - `GET /{hash}/audio` → `200` s `Content-Type` stopy a `Accept-Ranges: bytes`, `206` s `Content-Range` při `Range` hlavičce, `503` u pozastaveného kódu, `403` u zablokovaného, `404` jinak.
- Consumes: texty `texts.qr.audio.*`.

- [ ] **Step 1: Doplnit i18n texty**

V `src/lib/i18n/cs.ts` do objektu `qr` přidej za `wifi` blok:

```ts
    audio: {
      title: 'Zvuková stopa',
      play: 'Přehrát',
      pause: 'Pauza',
      hint: 'Přehrávání spustíš tlačítkem — prohlížeč zvuk sám nepustí.',
    },
```

- [ ] **Step 2: Napsat failing test na stránku**

Do `tests/pages-html.test.ts` přidej:

```ts
describe('audioPageHtml', () => {
  it('obsahuje název stopy, přehrávač a odkaz na stream', () => {
    const html = audioPageHtml({ title: 'Znělka & spol', src: '/abc1234/audio' });
    expect(html).toContain('Znělka &amp; spol');
    expect(html).toContain('<audio');
    expect(html).toContain('src="/abc1234/audio"');
    expect(html).toContain(texts.qr.audio.play);
  });
});
```

Nezapomeň `audioPageHtml` doplnit do importu na začátku souboru.

- [ ] **Step 3: Spustit test a ověřit, že selže**

Run: `pnpm vitest run tests/pages-html.test.ts`
Expected: FAIL — `audioPageHtml is not a function`.

- [ ] **Step 4: Implementovat stránku**

Do `src/lib/qr/pages-html.ts` přidej na konec:

```ts
export function audioPageHtml(params: { title: string; src: string }): string {
  return page(
    `${texts.qr.audio.title} · ${params.title}`,
    `<h1>${escapeHtml(params.title)}</h1>
<audio id="player" src="${escapeHtml(params.src)}" preload="metadata" style="width:100%;margin-top:16px"></audio>
<button class="button" type="button" id="play-btn">${texts.qr.audio.play}</button>
<p class="hint">${texts.qr.audio.hint}</p>
<script>
(function () {
  var player = document.getElementById('player');
  var button = document.getElementById('play-btn');
  function sync() {
    button.textContent = player.paused ? ${JSON.stringify(texts.qr.audio.play)} : ${JSON.stringify(texts.qr.audio.pause)};
  }
  button.addEventListener('click', function () {
    if (player.paused) player.play(); else player.pause();
  });
  player.addEventListener('play', sync);
  player.addEventListener('pause', sync);
  player.play().catch(function () { /* autoplay blokován — zbývá tlačítko */ });
  sync();
})();
</script>`,
  );
}
```

- [ ] **Step 5: Spustit test**

Run: `pnpm vitest run tests/pages-html.test.ts`
Expected: PASS.

- [ ] **Step 6: Rozšířit resolver**

V `src/lib/qr/redirect-resolver.ts` přidej do `Resolution`:

```ts
  | { kind: 'audio'; title: string }
```

a do `switch` v `resolveScan` nový case před uzavírací závorku:

```ts
    case 'audio': {
      const audio = payload as QrPayloadMap['audio'];
      return { kind: 'audio', title: audio.title ?? texts.qr.audio.title };
    }
```

- [ ] **Step 7: Vykreslit stránku v `/{hash}`**

V `src/app/[hash]/route.ts` doplň import `audioPageHtml` do existujícího importu z `pages-html` a přidej do `switch` case:

```ts
    case 'audio':
      return htmlResponse(audioPageHtml({ title: resolution.title, src: `/${qr.hash}/audio` }), 200);
```

- [ ] **Step 8: Napsat failing e2e test na stream**

Na konec `e2e/full-flow.spec.ts` přidej:

```ts
test('zvukový kód: stránka s přehrávačem a stream s podporou Range', async ({ request }) => {
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());
  const upload = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'pisen.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3() } },
  });
  const track = (await upload.json()) as { id: string };
  const created = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'audio', name: 'Znělka', payload: { trackId: track.id, title: 'Znělka' } },
  });
  const { id, hash } = (await created.json()) as { id: string; hash: string };

  const page = await request.get(`/${hash}`);
  expect(page.status()).toBe(200);
  expect(await page.text()).toContain(`/${hash}/audio`);

  const full = await request.get(`/${hash}/audio`);
  expect(full.status()).toBe(200);
  expect(full.headers()['content-type']).toBe('audio/mpeg');
  expect(full.headers()['accept-ranges']).toBe('bytes');

  const partial = await request.get(`/${hash}/audio`, { headers: { Range: 'bytes=0-99' } });
  expect(partial.status()).toBe(206);
  expect(partial.headers()['content-range']).toBe('bytes 0-99/2048');
  expect((await partial.body()).byteLength).toBe(100);

  // Pozastavený kód zvuk nepustí
  await request.patch(`/api/qr/${id}`, { headers: { cookie }, data: { isActive: false } });
  const paused = await request.get(`/${hash}/audio`);
  expect(paused.status()).toBe(503);
});
```

- [ ] **Step 9: Spustit test a ověřit, že selže**

Run: `pnpm playwright test -g "stream s podporou Range"`
Expected: FAIL — `/{hash}/audio` vrací 404.

- [ ] **Step 10: Implementovat stream**

Vytvoř `src/app/[hash]/audio/route.ts`:

```ts
import { prisma } from '@/lib/db';

/**
 * Stream zvukové stopy. Adresuje se hashem kódu, ne id stopy — díky tomu
 * platí stavy kódu a id souboru nikam neuniká. Sken se počítá na /{hash},
 * ne tady, aby přetáčení nenafukovalo statistiku.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  const qr = await prisma.qrCode.findUnique({
    where: { hash },
    select: { id: true, isActive: true, adminBlocked: true, audioTrack: true },
  });
  if (!qr || !qr.audioTrack) return new Response(null, { status: 404 });
  if (qr.adminBlocked) return new Response(null, { status: 403 });
  if (!qr.isActive) return new Response(null, { status: 503 });

  const data = Buffer.from(qr.audioTrack.data);
  const total = data.byteLength;
  const headers: Record<string, string> = {
    'Content-Type': qr.audioTrack.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };

  const range = request.headers.get('range');
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    const start = match[1] === '' ? 0 : Number(match[1]);
    const end = match[2] === '' ? total - 1 : Math.min(Number(match[2]), total - 1);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${total}` },
      });
    }
    const chunk = data.subarray(start, end + 1);
    return new Response(chunk as unknown as BodyInit, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': String(chunk.byteLength),
      },
    });
  }

  return new Response(data as unknown as BodyInit, {
    status: 200,
    headers: { ...headers, 'Content-Length': String(total) },
  });
}
```

- [ ] **Step 11: Spustit testy**

Run: `pnpm playwright test -g "stream s podporou Range"`
Expected: PASS.

Run: `pnpm vitest run`
Expected: všechny unit testy PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/qr/pages-html.ts src/lib/qr/redirect-resolver.ts "src/app/[hash]/route.ts" "src/app/[hash]/audio/route.ts" src/lib/i18n/cs.ts tests/pages-html.test.ts e2e/full-flow.spec.ts
git commit -m "feat: audio player page and range-capable stream"
```

---

### Task 9: Úklid osiřelých stop

**Files:**
- Create: `src/lib/audio/sweep.ts`
- Modify: `src/instrumentation.ts`
- Test: `tests/audio-sweep.test.ts`

**Interfaces:**
- Produces: `sweepOrphanTracks(olderThanMs?: number): Promise<number>` (počet smazaných), `startOrphanTrackSweep(): void` (interval 6 h, `unref()`).

- [ ] **Step 1: Napsat failing test**

Vytvoř `tests/audio-sweep.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { sweepOrphanTracks } from '@/lib/audio/sweep';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('sweepOrphanTracks', () => {
  it('smaže jen staré stopy bez kódu', async () => {
    const user = await prisma.user.create({
      data: { email: `sweep-${Date.now()}@example.com` },
    });
    const old = await prisma.audioTrack.create({
      data: {
        userId: user.id,
        filename: 'stara.mp3',
        mime: 'audio/mpeg',
        size: 1,
        data: Buffer.from([1]),
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    });
    const fresh = await prisma.audioTrack.create({
      data: {
        userId: user.id,
        filename: 'cerstva.mp3',
        mime: 'audio/mpeg',
        size: 1,
        data: Buffer.from([1]),
      },
    });

    const deleted = await sweepOrphanTracks();
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await prisma.audioTrack.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.audioTrack.findUnique({ where: { id: fresh.id } })).not.toBeNull();

    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

- [ ] **Step 2: Spustit test a ověřit, že selže**

Run: `pnpm vitest run tests/audio-sweep.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/audio/sweep"`.

- [ ] **Step 3: Implementovat**

Vytvoř `src/lib/audio/sweep.ts`:

```ts
import { prisma } from '@/lib/db';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Smaže nahrané stopy, které se nikdy nenavázaly na kód. */
export async function sweepOrphanTracks(olderThanMs: number = DAY_MS): Promise<number> {
  const result = await prisma.audioTrack.deleteMany({
    where: { qrCodeId: null, createdAt: { lt: new Date(Date.now() - olderThanMs) } },
  });
  return result.count;
}

/** Spustí periodický úklid (6 h). Volá se z instrumentation. */
export function startOrphanTrackSweep(): void {
  setInterval(() => {
    sweepOrphanTracks().catch((error) => console.warn('[audio] sweep:', error));
  }, 6 * 60 * 60 * 1000).unref();
}
```

- [ ] **Step 4: Zapojit do instrumentation**

Uprav `src/instrumentation.ts`:

```ts
/** Next.js instrumentation — spustí se při startu serveru (nodejs runtime). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startSafeBrowsingSweep } = await import('@/lib/security/safe-browsing');
  startSafeBrowsingSweep();
  const { startOrphanTrackSweep } = await import('@/lib/audio/sweep');
  startOrphanTrackSweep();
}
```

- [ ] **Step 5: Spustit test**

Run: `pnpm vitest run tests/audio-sweep.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio/sweep.ts src/instrumentation.ts tests/audio-sweep.test.ts
git commit -m "feat: sweep orphaned audio uploads"
```

---

### Task 10: Formulář — typ Zvuk a přepínač režimu

**Files:**
- Modify: `src/lib/i18n/cs.ts`, `src/components/qr-type-form.tsx`, `src/app/dashboard/new/page.tsx`, `src/components/edit-qr-form.tsx`
- Create: `src/components/audio-upload.tsx`

**Interfaces:**
- Consumes: `POST /api/audio` (Task 5), `POST /api/qr` s `mode` (Task 6).
- Produces: `QrTypeForm` volá `onSubmit({ type, name, payload, mode })`; `AudioUpload` komponenta s props `{ value: { trackId: string; filename: string } | null; onChange(next): void }`.

- [ ] **Step 1: Doplnit i18n texty**

V `src/lib/i18n/cs.ts` přidej do `dashboard.typeNames` a `dashboard.typeDescriptions`:

```ts
      audio: 'Zvuk',
```

```ts
      audio: 'Krátká skladba nebo znělka, kterou si lidi po naskenování pustí.',
```

Do objektu `dashboard` přidej blok:

```ts
    mode: {
      label: 'Režim kódu',
      dynamic: 'Dynamický',
      dynamicHint: 'Cíl můžeš kdykoliv změnit. Kód vede přes qr4life.cz.',
      static: 'Statický',
      staticHint: 'Obsah je natvrdo v obrázku — čte se rychleji a funguje bez internetu, ale cíl už nezměníš.',
      staticBadge: 'Statický',
      staticEditWarning:
        'Tohle je statický kód. Změna obsahu vytvoří jiný obrázek — vytištěné cedule pořád vedou na staré údaje. Po uložení si stáhni a vytiskni nový.',
      staticNoScans: 'Statický kód nesbírá skeny.',
    },
    audio: {
      pick: 'Vybrat soubor',
      replace: 'Vyměnit stopu',
      uploading: 'Nahrávám…',
      hint: 'MP3, M4A, OGG nebo WAV do 15 MB.',
      tooLarge: 'Soubor je větší než 15 MB.',
      unsupported: 'Tenhle formát neumíme. Nahraj MP3, M4A, OGG nebo WAV.',
      limit: 'Máš nahraných 20 stop, což je maximum. Smaž nějaký zvukový kód.',
      failed: 'Nahrání se nepovedlo. Zkus to znovu.',
    },
```

- [ ] **Step 2: Vytvořit komponentu uploadu**

Vytvoř `src/components/audio-upload.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { texts } from '@/lib/i18n/cs';

export interface AudioValue {
  trackId: string;
  filename: string;
}

const uploadErrors: Record<string, string> = {
  too_large: texts.dashboard.audio.tooLarge,
  unsupported_type: texts.dashboard.audio.unsupported,
  track_limit: texts.dashboard.audio.limit,
};

/** Výběr souboru + okamžité nahrání na /api/audio; vrací id stopy. */
export function AudioUpload({
  value,
  onChange,
}: {
  value: AudioValue | null;
  onChange: (next: AudioValue | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/audio', { method: 'POST', body: form });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError((data.error && uploadErrors[data.error]) ?? texts.dashboard.audio.failed);
        onChange(null);
        return;
      }
      const track = (await response.json()) as { id: string; filename: string };
      onChange({ trackId: track.id, filename: track.filename });
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="text-sm font-medium">{texts.dashboard.typeNames.audio} *</label>
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-line/40 disabled:opacity-50"
        >
          {busy
            ? texts.dashboard.audio.uploading
            : value
              ? texts.dashboard.audio.replace
              : texts.dashboard.audio.pick}
        </button>
        {value && <span className="truncate text-sm text-muted">{value.filename}</span>}
      </div>
      {previewUrl && <audio className="mt-3 w-full" controls src={previewUrl} />}
      <p className="mt-1 text-xs text-muted">{texts.dashboard.audio.hint}</p>
      {error && <p className="mt-1 text-sm text-accent">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Rozšířit `QrTypeForm`**

V `src/components/qr-type-form.tsx`:

Rozšiř typ a seznam typů:

```tsx
export type QrTypeKey = 'url' | 'wifi' | 'vcard' | 'phone' | 'sms' | 'email' | 'text' | 'audio';

const TYPES: QrTypeKey[] = ['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text', 'audio'];
```

Do `emptyPayload` přidej `audio: { trackId: '', title: '' },` a do `FIELDS_BY_TYPE` přidej `audio: [],` (pole se renderuje vlastní komponentou).

Přidej import a lokální seznam typů (ne import ze `static-content.ts` — ten táhne Zod a serverové moduly do klientského bundlu):

```tsx
import { AudioUpload, type AudioValue } from '@/components/audio-upload';
```

```tsx
const STATIC_CAPABLE: QrTypeKey[] = ['wifi', 'vcard', 'phone', 'sms', 'email', 'text'];

function isStaticCapable(type: QrTypeKey): boolean {
  return STATIC_CAPABLE.includes(type);
}
```

Rozšiř props a stav:

```tsx
  mode: 'create' | 'edit';
  initialType?: QrTypeKey;
  initialName?: string;
  initialPayload?: unknown;
  initialQrMode?: 'dynamic' | 'static';
  initialAudio?: AudioValue | null;
  submitLabel: string;
  onSubmit: (data: {
    type: QrTypeKey;
    name: string;
    payload: unknown;
    qrMode: 'dynamic' | 'static';
  }) => Promise<string | null>;
```

```tsx
  const [qrMode, setQrMode] = useState<'dynamic' | 'static'>(initialQrMode ?? 'dynamic');
  const [audio, setAudio] = useState<AudioValue | null>(initialAudio ?? null);
```

V `buildPayload` ošetři zvuk — na začátek funkce přidej parametr a větev:

```tsx
function buildPayload(type: QrTypeKey, state: PayloadState, audio: AudioValue | null): unknown {
  if (type === 'audio') {
    return { trackId: audio?.trackId ?? '', ...(state.title ? { title: state.title } : {}) };
  }
```

a volání ve `submit` uprav na `buildPayload(activeType, payload, audio)`; do `onSubmit` předej `qrMode: isStaticCapable(activeType) ? qrMode : 'dynamic'`.

Nad blok s poli (`{(step === 2 || mode === 'edit') && (...)}`) vlož přepínač režimu a upload:

```tsx
      {isStaticCapable(activeType) && mode === 'create' && (
        <div>
          <span className="text-sm font-medium">{texts.dashboard.mode.label}</span>
          <div className="mt-1 flex gap-2">
            {(['dynamic', 'static'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setQrMode(option)}
                aria-pressed={qrMode === option}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  qrMode === option ? 'border-ink bg-ink text-white' : 'border-line hover:bg-line/40'
                }`}
              >
                {texts.dashboard.mode[option]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            {qrMode === 'static' ? texts.dashboard.mode.staticHint : texts.dashboard.mode.dynamicHint}
          </p>
        </div>
      )}

      {mode === 'edit' && initialQrMode === 'static' && (
        <p className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
          {texts.dashboard.mode.staticEditWarning}
        </p>
      )}

      {activeType === 'audio' && (step === 2 || mode === 'edit') && (
        <AudioUpload value={audio} onChange={setAudio} />
      )}
```

- [ ] **Step 4: Předat režim v obou stránkách**

V `src/app/dashboard/new/page.tsx` uprav `onSubmit`:

```tsx
          onSubmit={async ({ type, name, payload, qrMode }) => {
            const response = await fetch('/api/qr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type, name, payload, mode: qrMode }),
            });
```

a do `apiErrors` přidej:

```tsx
  invalid_mode: texts.dashboard.createError,
  invalid_track: texts.dashboard.createError,
```

V `src/components/edit-qr-form.tsx` rozšiř props o režim a stopu:

```tsx
export function EditQrForm({
  id,
  initialType,
  initialName,
  initialPayload,
  initialFolderId,
  initialQrMode,
  initialAudio,
  folders,
}: {
  id: string;
  initialType: string;
  initialName: string;
  initialPayload: unknown;
  initialFolderId: string | null;
  initialQrMode: 'dynamic' | 'static';
  initialAudio: { trackId: string; filename: string } | null;
  folders: { id: string; name: string }[];
}) {
```

Do `apiErrors` přidej `invalid_track: texts.dashboard.saveError,` a `mode_immutable: texts.dashboard.saveError,`.

Volání `QrTypeForm` uprav — režim se posílá jen do formuláře, ne do API (mění se nesmí):

```tsx
      <QrTypeForm
        mode="edit"
        initialType={initialType as QrTypeKey}
        initialName={initialName}
        initialPayload={initialPayload as Record<string, string | boolean>}
        initialQrMode={initialQrMode}
        initialAudio={initialAudio}
        submitLabel={texts.common.save}
        onSubmit={async ({ type, name, payload }) => {
```

V `src/app/dashboard/[id]/page.tsx` načti stopu spolu s kódem — nahraď řádek `const qr = await prisma.qrCode.findUnique({ where: { id } });`:

```tsx
  const qr = await prisma.qrCode.findUnique({
    where: { id },
    include: { audioTrack: { select: { id: true, filename: true } } },
  });
```

a doplň nové props do `<EditQrForm …>`:

```tsx
          initialFolderId={qr.folderId}
          initialQrMode={qr.mode}
          initialAudio={
            qr.audioTrack ? { trackId: qr.audioTrack.id, filename: qr.audioTrack.filename } : null
          }
          folders={folders}
```

- [ ] **Step 5: Ověřit build a projít flow ručně**

Run: `pnpm build`
Expected: `Compiled successfully`.

Run: `pnpm lint`
Expected: žádné chyby ani varování.

Ručně: přihlas se, vytvoř statický Wi-Fi kód a zvukový kód, naskenuj `/{hash}` v prohlížeči — u zvuku se musí objevit přehrávač a hrát.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/cs.ts src/components/audio-upload.tsx src/components/qr-type-form.tsx src/components/edit-qr-form.tsx src/app/dashboard/new/page.tsx "src/app/dashboard/[id]/page.tsx"
git commit -m "feat: audio type and static mode in qr wizard"
```

---

### Task 11: Karta kódu — odznak a skeny

**Files:**
- Modify: `src/components/qr-card.tsx`, `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `texts.dashboard.mode.staticBadge`, `texts.dashboard.mode.staticNoScans`.
- Produces: `QrCardData` nově obsahuje `mode: 'dynamic' | 'static'`.

- [ ] **Step 1: Rozšířit data karty**

V `src/components/qr-card.tsx` doplň do `QrCardData`:

```tsx
  mode: 'dynamic' | 'static';
```

- [ ] **Step 2: Zobrazit odznak a skrýt skeny**

V místě, kde se vykresluje počet skenů (`scanLabel(code.scanCount)`), použij podmínku:

```tsx
        {code.mode === 'static' ? (
          <span title={texts.dashboard.mode.staticNoScans}>—</span>
        ) : (
          <span>
            {code.scanCount} {scanLabel(code.scanCount)}
          </span>
        )}
```

Vedle stavového odznaku přidej:

```tsx
        {code.mode === 'static' && (
          <span className="whitespace-nowrap rounded-full bg-line px-2.5 py-0.5 text-xs font-medium text-muted">
            {texts.dashboard.mode.staticBadge}
          </span>
        )}
```

U statického kódu nevykresluj přepínač pozastavení — obal jeho JSX podmínkou `code.mode === 'dynamic' && (…)`.

- [ ] **Step 3: Předat `mode` ze serveru**

V `src/app/dashboard/page.tsx` doplň `mode: code.mode` do objektu předávaného do `<QrCard code={{ … }} />`.

- [ ] **Step 4: Ověřit build**

Run: `pnpm build`
Expected: `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/components/qr-card.tsx src/app/dashboard/page.tsx
git commit -m "feat: static badge and scan handling on qr card"
```

---

### Task 12: Zelené finále

**Files:** žádné nové

- [ ] **Step 1: Spustit celou sadu**

Run: `pnpm vitest run`
Expected: všechny unit testy PASS.

Run: `pnpm playwright test`
Expected: všechny E2E testy PASS (11 původních + 5 nových).

Run: `pnpm lint && pnpm exec tsc --noEmit`
Expected: bez chyb a varování.

- [ ] **Step 2: Ověřit, že se nic nerozbilo u starých kódů**

Run: `pnpm exec prisma studio` není potřeba — místo toho:

```bash
psql postgresql://qr4life:qr4life@localhost:5432/qr4life -c 'SELECT mode, count(*) FROM "QrCode" GROUP BY mode;'
```

Expected: všechny existující kódy mají `dynamic`.

- [ ] **Step 3: Push a deploy**

```bash
git push origin worktree-qr4life-implementation:main
```

Auto-deploy Coolify se u tohoto projektu neaktivuje spolehlivě — po pushi ověř stav aplikace `jqgwcwvtv4zqoe8rdsugvaab` a případně spusť deploy ručně přes MCP `mcp__lnrt-coolify__deploy`. Migrace se pouští sama ve start commandu (`prisma migrate deploy && node server.js`).

- [ ] **Step 4: Ověřit produkci**

```bash
curl -si https://qr.lnrtdev.cz/zzzzzzz | head -1
```

Expected: `HTTP/2 404`. Pak přes UI vytvoř zvukový kód a naskenuj ho na mobilu — přehrávač musí hrát.

## Poznámky k pokrytí specu

- Statický režim: T1 (sloupec), T2 (obsah), T6 (API + neměnnost), T7 (download), T10 (přepínač + varování), T11 (odznak, skeny).
- Zvuk: T1 (tabulka), T3 (sniffing + limity), T4 (payload), T5 (upload), T6 (vazba stopy), T8 (stránka + stream), T9 (úklid), T10 (formulář).
- Limity 15 MB / 20 stop: T3 (konstanty), T5 (vynucení), T10 (chybové hlášky).
- Kontrola vlastnictví: T5 (session), T6 (cizí trackId → 400), T8 (stream přes hash, stavy kódu).
