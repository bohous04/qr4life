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
