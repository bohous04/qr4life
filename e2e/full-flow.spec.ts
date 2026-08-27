import { expect, test, type APIRequestContext } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function uniqueEmail(): string {
  return `e2e-${randomBytes(6).toString('hex')}@example.com`;
}

async function registerAndGetVerifiedCookie(
  request: APIRequestContext,
  email: string,
  password = 'heslo-123456',
): Promise<string> {
  const register = await request.post('/api/auth/register', {
    data: { email, password },
  });
  expect(register.status()).toBe(201);

  // Ověřovací token převezmeme z DB (e-maily jsou v E2E vypnuté).
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const token = randomBytes(32).toString('base64url');
  const { createHash: _c } = await import('node:crypto');
  void _c;
  await prisma.token.create({
    data: {
      userId: user.id,
      type: 'verify_email',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const verify = await request.get(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
    maxRedirects: 0,
  });
  expect(verify.status()).toBe(302);

  const login = await request.post('/api/auth/login', { data: { email, password } });
  expect(login.status()).toBe(200);
  const cookies = await login.headersArray();
  const setCookie = cookies.find((h) => h.name === 'set-cookie');
  expect(setCookie).toBeTruthy();
  return (setCookie as { value: string }).value.split(';')[0];
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('registrace → ověření → login → vytvoření URL kódu → 302 redirect', async ({ request }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);

  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'url', name: 'E2E cedule', payload: { url: 'https://example.com/prvni' } },
  });
  expect(create.status()).toBe(201);
  const { id, hash, url } = (await create.json()) as { id: string; hash: string; url: string };
  expect(hash).toMatch(/^[a-zA-Z0-9]{7}$/);
  expect(url).toContain(hash);

  // PNG download
  const png = await request.get(`/api/qr/${id}/download?format=png`, { headers: { cookie } });
  expect(png.status()).toBe(200);
  const body = await png.body();
  expect(body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  // Redirect: 302 + no-store, žádná mezistránka
  const scan = await request.get(`/${hash}`, { maxRedirects: 0 });
  expect(scan.status()).toBe(302);
  expect(scan.headers().location).toBe('https://example.com/prvni');
  expect(scan.headers()['cache-control']).toBe('no-store');
});

test('změna cíle → tentýž kód vede na nový cíl', async ({ request }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);
  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'url', name: 'Změna', payload: { url: 'https://example.com/stare' } },
  });
  const { id, hash } = (await create.json()) as { id: string; hash: string };

  const patch = await request.patch(`/api/qr/${id}`, {
    headers: { cookie },
    data: { payload: { url: 'https://example.com/nove' } },
  });
  expect(patch.status()).toBe(200);

  const scan = await request.get(`/${hash}`, { maxRedirects: 0 });
  expect(scan.status()).toBe(302);
  expect(scan.headers().location).toBe('https://example.com/nove');
});

test('Wi-Fi kód zobrazí SSID, heslo a tlačítko kopírování', async ({ request, page }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);
  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: {
      type: 'wifi',
      name: 'Chalupa Wi-Fi',
      payload: { ssid: 'ChalupaNet', password: 'tajneheslo123', hidden: false },
    },
  });
  const { hash } = (await create.json()) as { hash: string };

  const response = await page.goto(`/${hash}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByText('ChalupaNet')).toBeVisible();
  await expect(page.getByText('tajneheslo123')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kopírovat heslo' })).toBeVisible();
  expect(await page.locator('img.qr').getAttribute('src')).toContain('data:image/png;base64,');
});

test('otevřená Wi-Fi (bez hesla) projde end-to-end a zobrazí se správně', async ({ request, page }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);
  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: {
      type: 'wifi',
      name: 'Otevřená síť',
      payload: { ssid: 'GuestNetwork', password: null, hidden: false },
    },
  });
  expect(create.status()).toBe(201);
  const { hash } = (await create.json()) as { hash: string };

  const response = await page.goto(`/${hash}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByText('GuestNetwork')).toBeVisible();
  expect(await page.locator('img.qr').getAttribute('src')).toContain('data:image/png;base64,');
});

test('neexistující hash → branded 404', async ({ page }) => {
  const response = await page.goto('/zzzzzzz');
  expect(response?.status()).toBe(404);
  await expect(page.getByText('Tenhle kód nikde nevidíme')).toBeVisible();
});

test('pozastavený kód → stránka o dočasné neaktivitě', async ({ request, page }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);
  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'url', name: 'Pauza', payload: { url: 'https://example.com' } },
  });
  const { id, hash } = (await create.json()) as { id: string; hash: string };
  await request.patch(`/api/qr/${id}`, { headers: { cookie }, data: { isActive: false } });

  const response = await page.goto(`/${hash}`);
  expect(response?.status()).toBe(503);
  await expect(page.getByText('Tento kód je dočasně neaktivní')).toBeVisible();
});

test('po odhlášení cizí kódy nepřístupné ani přes přímé API URL', async ({ request }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);
  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'url', name: 'Cizí', payload: { url: 'https://example.com/cizi' } },
  });
  const { id, hash } = (await create.json()) as { id: string; hash: string };

  // Útočník si založí vlastní účet
  const attackerEmail = uniqueEmail();
  const attackerCookie = await registerAndGetVerifiedCookie(request, attackerEmail);

  const patch = await request.patch(`/api/qr/${id}`, {
    headers: { cookie: attackerCookie },
    data: { payload: { url: 'https://evil.example' } },
  });
  expect(patch.status()).toBe(404);

  const remove = await request.delete(`/api/qr/${id}`, { headers: { cookie: attackerCookie } });
  expect(remove.status()).toBe(404);

  const download = await request.get(`/api/qr/${id}/download`, {
    headers: { cookie: attackerCookie },
  });
  expect(download.status()).toBe(404);

  // Veřejný redirect pořád funguje (kód je veřejný odkaz)
  const scan = await request.get(`/${hash}`, { maxRedirects: 0 });
  expect(scan.status()).toBe(302);
});

test('neověřený e-mail nemůže vytvořit kód', async ({ request }) => {
  const email = uniqueEmail();
  const register = await request.post('/api/auth/register', {
    data: { email, password: 'heslo-123456' },
  });
  expect(register.status()).toBe(201);
  const login = await request.post('/api/auth/login', { data: { email, password: 'heslo-123456' } });
  const setCookie = (await login.headersArray()).find((h) => h.name === 'set-cookie');
  const cookie = (setCookie as { value: string }).value.split(';')[0];

  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'url', name: 'X', payload: { url: 'https://example.com' } },
  });
  expect(create.status()).toBe(403);
});

test('vCard kód servíruje .vcf soubor', async ({ request }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);
  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: {
      type: 'vcard',
      name: 'Vizitka',
      payload: { firstName: 'Jan', lastName: 'Novák', phone: '+420123456789' },
    },
  });
  const { hash } = (await create.json()) as { hash: string };

  const scan = await request.get(`/${hash}`);
  expect(scan.status()).toBe(200);
  expect(scan.headers()['content-type']).toContain('text/vcard');
  expect(scan.headers()['content-disposition']).toContain('kontakt.vcf');
  const vcf = await scan.text();
  expect(vcf).toContain('BEGIN:VCARD');
  expect(vcf).toContain('FN:Jan Novák');
});

test('javascript: URL se odmítne', async ({ request }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);
  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'url', name: 'XSS', payload: { url: 'javascript:alert(1)' } },
  });
  expect(create.status()).toBe(400);
});

test('stažený QR se nemění se změnou cíle (kóduje jen /{hash})', async ({ request }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);
  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'url', name: 'Dynamický', payload: { url: 'https://example.com/verze-1' } },
  });
  const { id } = (await create.json()) as { id: string };

  const before = await (await request.get(`/api/qr/${id}/download?format=png`, { headers: { cookie } })).body();

  await request.patch(`/api/qr/${id}`, {
    headers: { cookie },
    data: { type: 'wifi', payload: { ssid: 'ZmenaTypu', password: '12345678', hidden: false } },
  });

  const after = await (await request.get(`/api/qr/${id}/download?format=png`, { headers: { cookie } })).body();

  // Vytištěný kód je vždy stejný — mění se jen cíl na serveru.
  expect(before.equals(after)).toBe(true);
});

test('složky: vytvoření, přesun kódu, filtr, smazání složky', async ({ request }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);

  const createFolder = await request.post('/api/folders', {
    headers: { cookie },
    data: { name: 'Cedule' },
  });
  expect(createFolder.status()).toBe(201);
  const { id: folderId } = (await createFolder.json()) as { id: string };

  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'url', name: 'Ve složce', payload: { url: 'https://example.com' } },
  });
  const { id: qrId } = (await create.json()) as { id: string };

  const move = await request.patch(`/api/qr/${qrId}`, {
    headers: { cookie },
    data: { folderId },
  });
  expect(move.status()).toBe(200);

  // Cizí složka se odmítne
  const otherEmail = uniqueEmail();
  const otherCookie = await registerAndGetVerifiedCookie(request, otherEmail);
  const otherFolder = await request.post('/api/folders', {
    headers: { cookie: otherCookie },
    data: { name: 'Cizí' },
  });
  const { id: otherFolderId } = (await otherFolder.json()) as { id: string };
  const steal = await request.patch(`/api/qr/${qrId}`, {
    headers: { cookie },
    data: { folderId: otherFolderId },
  });
  expect(steal.status()).toBe(400);

  // Smazání složky — kód zůstává bez složky
  const remove = await request.delete(`/api/folders/${folderId}`, { headers: { cookie } });
  expect(remove.status()).toBe(200);
  const qr = await prisma.qrCode.findUniqueOrThrow({ where: { id: qrId } });
  expect(qr.folderId).toBeNull();
});

test('admin vidí náhled cizího kódu, běžný uživatel ne', async ({ request }) => {
  const ownerEmail = uniqueEmail();
  const ownerCookie = await registerAndGetVerifiedCookie(request, ownerEmail);
  const create = await request.post('/api/qr', {
    headers: { cookie: ownerCookie },
    data: { type: 'url', name: 'Admin náhled', payload: { url: 'https://example.com/nahled' } },
  });
  const { id } = (await create.json()) as { id: string };

  // Běžný uživatel cizí náhled nedostane
  const strangerEmail = uniqueEmail();
  const strangerCookie = await registerAndGetVerifiedCookie(request, strangerEmail);
  const denied = await request.get(`/api/qr/${id}/download?format=png&size=128`, {
    headers: { cookie: strangerCookie },
  });
  expect(denied.status()).toBe(404);

  // Admin ano — náhledy ve správě musí načíst PNG
  const adminEmail = uniqueEmail();
  const adminCookie = await registerAndGetVerifiedCookie(request, adminEmail);
  await prisma.user.update({ where: { email: adminEmail }, data: { role: 'admin' } });
  const allowed = await request.get(`/api/qr/${id}/download?format=png&size=128`, {
    headers: { cookie: adminCookie },
  });
  expect(allowed.status()).toBe(200);
  expect(allowed.headers()['content-type']).toBe('image/png');
});

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
        buffer: Buffer.from('MZ       '),
      },
    },
  });
  expect(fake.status()).toBe(415);
});

test('upload zvuku: nadměrný soubor s Content-Length skončí 413', async ({ request }) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);

  // Playwright request fixture spočítá Content-Length sama — zachytí ho
  // už předběžná kontrola v handleru.
  const oversized = await request.post('/api/audio', {
    headers: { cookie },
    multipart: {
      file: { name: 'big.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3(15 * 1024 * 1024 + 1024) },
    },
  });
  expect(oversized.status()).toBe(413);
  expect((await oversized.json()) as { error: string }).toEqual({ error: 'too_large' });
});

test('upload zvuku: nadměrný soubor bez Content-Length (chunked) skončí 413, ne 400 ani 201', async ({
  request,
}) => {
  const email = uniqueEmail();
  const cookie = await registerAndGetVerifiedCookie(request, email);

  // Playwright request fixture vždy dopočítá Content-Length ze zadaného
  // bufferu, takže díra v předběžné kontrole (chybějící/lživá hlavička,
  // chunked přenos) se s ní nedá nasimulovat. Použijeme proto přímo
  // nativní fetch se streamovaným (ReadableStream) tělem — Node/undici
  // pak pošle Transfer-Encoding: chunked a Content-Length vůbec
  // nenastaví, přesně jako útočník, který hlavičku vynechá.
  const boundary = `----e2e-${randomBytes(8).toString('hex')}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
  );
  const oversized = fakeMp3(15 * 1024 * 1024 + 1024);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(head);
      controller.enqueue(oversized);
      controller.enqueue(tail);
      controller.close();
    },
  });

  const res = await fetch('http://localhost:3100/api/audio', {
    method: 'POST',
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  expect(res.status).toBe(413);
  expect((await res.json()) as { error: string }).toEqual({ error: 'too_large' });
});

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

test('PATCH audio kódu: neplatná složka nesmí smazat navázanou stopu', async ({ request }) => {
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());

  const upload1 = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'puvodni.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3() } },
  });
  const track1 = (await upload1.json()) as { id: string };

  const created = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'audio', name: 'Znělka', payload: { trackId: track1.id, title: 'Znělka' } },
  });
  expect(created.status()).toBe(201);
  const { id: qrId } = (await created.json()) as { id: string };

  const upload2 = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'nova.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3() } },
  });
  const track2 = (await upload2.json()) as { id: string };

  // Cizí složka existujícího uživatele — nepatří volajícímu.
  const otherCookie = await registerAndGetVerifiedCookie(request, uniqueEmail());
  const otherFolder = await request.post('/api/folders', {
    headers: { cookie: otherCookie },
    data: { name: 'Cizí' },
  });
  const { id: otherFolderId } = (await otherFolder.json()) as { id: string };

  const patch = await request.patch(`/api/qr/${qrId}`, {
    headers: { cookie },
    data: {
      type: 'audio',
      payload: { trackId: track2.id, title: 'Nová znělka' },
      folderId: otherFolderId,
    },
  });
  expect(patch.status()).toBe(400);
  expect((await patch.json()).error).toBe('invalid_folder');

  // Původní stopa zůstává navázaná — žádná ztráta dat před tím, než requst zvalidoval vše.
  const original = await prisma.audioTrack.findUniqueOrThrow({ where: { id: track1.id } });
  expect(original.qrCodeId).toBe(qrId);

  // Nová stopa se nenavázala — request selhal dřív, než k mutaci vůbec došlo.
  const untouched = await prisma.audioTrack.findUniqueOrThrow({ where: { id: track2.id } });
  expect(untouched.qrCodeId).toBeNull();

  // Kód sám je nezměněný a pořád ukazuje na původní stopu.
  const qr = await prisma.qrCode.findUniqueOrThrow({ where: { id: qrId } });
  expect(qr.type).toBe('audio');
  expect((qr.payload as { trackId: string }).trackId).toBe(track1.id);

  // Kód dál "existuje" a odpovídá konzistentně (přehrávač zvuku je pozdější úkol).
  const scan = await request.get(`/${qr.hash}`, { maxRedirects: 0 });
  expect(scan.status()).not.toBe(500);
});

test('statický kód: PATCH na type audio bez mode se odmítne, uložený kód se nezmění', async ({
  request,
}) => {
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());

  const create = await request.post('/api/qr', {
    headers: { cookie },
    data: {
      type: 'wifi',
      mode: 'static',
      name: 'Staticky wifi',
      payload: { ssid: 'StatickaSit', password: 'tajneheslo', hidden: false },
    },
  });
  expect(create.status()).toBe(201);
  const { id: qrId } = (await create.json()) as { id: string };

  const upload = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'znelka.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3() } },
  });
  const track = (await upload.json()) as { id: string };

  const patch = await request.patch(`/api/qr/${qrId}`, {
    headers: { cookie },
    data: { type: 'audio', payload: { trackId: track.id } },
  });
  expect(patch.status()).toBe(400);
  expect((await patch.json()).error).toBe('invalid_mode');

  const qr = await prisma.qrCode.findUniqueOrThrow({ where: { id: qrId } });
  expect(qr.type).toBe('wifi');
  expect(qr.mode).toBe('static');
  expect((qr.payload as { ssid: string }).ssid).toBe('StatickaSit');
});

test('PATCH audio kódu na type text: 200, stará stopa se smaže', async ({ request }) => {
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());

  const upload = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'znelka.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3() } },
  });
  const track = (await upload.json()) as { id: string };

  const created = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'audio', name: 'Znělka', payload: { trackId: track.id } },
  });
  const { id: qrId } = (await created.json()) as { id: string };

  const patch = await request.patch(`/api/qr/${qrId}`, {
    headers: { cookie },
    data: { type: 'text', payload: { text: 'Už žádný zvuk' } },
  });
  expect(patch.status()).toBe(200);

  const qr = await prisma.qrCode.findUniqueOrThrow({ where: { id: qrId } });
  expect(qr.type).toBe('text');

  const deletedTrack = await prisma.audioTrack.findUnique({ where: { id: track.id } });
  expect(deletedTrack).toBeNull();
});

test('PATCH audio kódu: výměna za jinou volnou stopu → 200, nová navázaná, stará smazaná', async ({
  request,
}) => {
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());

  const upload1 = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'puvodni.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3() } },
  });
  const track1 = (await upload1.json()) as { id: string };

  const created = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'audio', name: 'Znělka', payload: { trackId: track1.id } },
  });
  const { id: qrId } = (await created.json()) as { id: string };

  const upload2 = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'nova.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3() } },
  });
  const track2 = (await upload2.json()) as { id: string };

  const patch = await request.patch(`/api/qr/${qrId}`, {
    headers: { cookie },
    data: { type: 'audio', payload: { trackId: track2.id, title: 'Nová znělka' } },
  });
  expect(patch.status()).toBe(200);

  const boundTrack = await prisma.audioTrack.findUniqueOrThrow({ where: { id: track2.id } });
  expect(boundTrack.qrCodeId).toBe(qrId);

  const oldTrack = await prisma.audioTrack.findUnique({ where: { id: track1.id } });
  expect(oldTrack).toBeNull();
});

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

test('zvukový stream: sufixový Range vrátí posledních N bajtů', async ({ request }) => {
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
  const { hash } = (await created.json()) as { id: string; hash: string };

  const suffix = await request.get(`/${hash}/audio`, { headers: { Range: 'bytes=-100' } });
  expect(suffix.status()).toBe(206);
  expect(suffix.headers()['content-range']).toBe('bytes 1948-2047/2048');
  const body = await suffix.body();
  expect(body.byteLength).toBe(100);
  expect(body).toEqual(fakeMp3().subarray(1948));
});

test('zvukový stream: 403 pro adminem blokovaný kód, 404 pro neexistující hash, 416 pro neuspokojitelný rozsah', async ({
  request,
}) => {
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

  // Neexistující hash → 404
  const missing = await request.get('/nonexistent-hash-xyz/audio');
  expect(missing.status()).toBe(404);

  // Neuspokojitelný rozsah (za koncem souboru) → 416
  const unsatisfiable = await request.get(`/${hash}/audio`, {
    headers: { Range: 'bytes=999999-' },
  });
  expect(unsatisfiable.status()).toBe(416);
  expect(unsatisfiable.headers()['content-range']).toBe('bytes */2048');

  // Adminem blokovaný kód → 403
  const adminEmail = uniqueEmail();
  const adminCookie = await registerAndGetVerifiedCookie(request, adminEmail);
  await prisma.user.update({ where: { email: adminEmail }, data: { role: 'admin' } });
  const block = await request.post(`/api/admin/qr/${id}/block`, {
    headers: { cookie: adminCookie },
    data: { blocked: true, reason: 'test' },
  });
  expect(block.status()).toBe(200);

  const blocked = await request.get(`/${hash}/audio`);
  expect(blocked.status()).toBe(403);
});

test('zvukový stream: rozsahový i celý požadavek na větší stopě vrátí přesně odpovídající bajty', async ({
  request,
}) => {
  // Stopa přes 500 KB, aby rozsahový požadavek níže přesáhl velikost
  // jedné dávky (256 KiB) čtené přes substring() a ověřil i skládání
  // víc dávek za sebou, ne jen samotnou délku.
  const trackBytes = fakeMp3(500 * 1024);
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());
  const upload = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'pisen.mp3', mimeType: 'audio/mpeg', buffer: trackBytes } },
  });
  const track = (await upload.json()) as { id: string };
  const created = await request.post('/api/qr', {
    headers: { cookie },
    data: { type: 'audio', name: 'Znělka', payload: { trackId: track.id, title: 'Znělka' } },
  });
  const { hash } = (await created.json()) as { id: string; hash: string };

  const partial = await request.get(`/${hash}/audio`, {
    headers: { Range: 'bytes=100000-399999' },
  });
  expect(partial.status()).toBe(206);
  expect(partial.headers()['content-range']).toBe('bytes 100000-399999/512000');
  expect(partial.headers()['content-length']).toBe('300000');
  const partialBody = await partial.body();
  expect(partialBody.byteLength).toBe(300000);
  expect(partialBody).toEqual(trackBytes.subarray(100000, 400000));

  const full = await request.get(`/${hash}/audio`);
  expect(full.status()).toBe(200);
  expect(full.headers()['content-length']).toBe('512000');
  const fullBody = await full.body();
  expect(fullBody.byteLength).toBe(512000);
  expect(fullBody).toEqual(trackBytes);
});

test('upload zvuku: cca 12 MB (mezi starým 10MB stropem middlewaru a 15MB limitem) projde', async ({
  request,
}) => {
  const cookie = await registerAndGetVerifiedCookie(request, uniqueEmail());
  const bigButAllowed = 12 * 1024 * 1024;
  const upload = await request.post('/api/audio', {
    headers: { cookie },
    multipart: { file: { name: 'dvanact-mb.mp3', mimeType: 'audio/mpeg', buffer: fakeMp3(bigButAllowed) } },
  });
  expect(upload.status()).toBe(201);
  const track = (await upload.json()) as { size: number };
  expect(track.size).toBe(bigButAllowed);
});
