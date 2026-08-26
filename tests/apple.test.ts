import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';
import { generateKeyPairSync } from 'node:crypto';
import { prisma } from '@/lib/db';
import {
  appleConfigured,
  authorizeUrl,
  buildClientSecret,
  findOrCreateAppleUser,
  makeTestToken,
  verifyIdToken,
} from '@/lib/auth/apple';
import { resetDb } from './db';

/** Skutečný ES256 klíč pro podpis client_secret. */
const TEST_PEM = (() => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
})();

const ENV = {
  servicesId: 'cz.qr4life.app',
  teamId: 'TEAMTEST1',
  keyId: 'KEY123456',
  privateKey: TEST_PEM,
};

/** Nastaví Apple env pro verifyIdToken testy. */
function withAppleEnv(fn: () => Promise<void>): Promise<void> {
  process.env.APPLE_SERVICES_ID = 'cz.qr4life.app';
  process.env.APPLE_TEAM_ID = 'TEAMTEST1';
  process.env.APPLE_KEY_ID = 'KEY123456';
  process.env.APPLE_PRIVATE_KEY = TEST_PEM;
  return fn().finally(() => {
    delete process.env.APPLE_SERVICES_ID;
    delete process.env.APPLE_TEAM_ID;
    delete process.env.APPLE_KEY_ID;
    delete process.env.APPLE_PRIVATE_KEY;
  });
}

beforeEach(resetDb);
afterEach(resetDb);

describe('appleConfigured', () => {
  it('bez env proměnných není nakonfigurováno', () => {
    expect(appleConfigured()).toBe(false);
  });
});

describe('buildClientSecret', () => {
  it('má správné claims', async () => {
    const secret = await buildClientSecret(ENV);
    const claims = decodeJwt(secret) as Record<string, unknown>;
    expect(claims.iss).toBe('TEAMTEST1');
    expect(claims.aud).toBe('https://appleid.apple.com');
    expect(claims.sub).toBe('cz.qr4life.app');
    expect(typeof claims.exp).toBe('number');
    expect(typeof claims.iat).toBe('number');
  });
});

describe('verifyIdToken', () => {
  it('ověří platný token s vlastním klíčem', async () => {
    await withAppleEnv(async () => {
      const { token, getKey } = await makeTestToken({
        sub: 'apple-sub-1',
        email: 'jan@example.com',
        email_verified: true,
        iss: 'https://appleid.apple.com',
        aud: 'cz.qr4life.app',
      });
      const claims = await verifyIdToken(token, getKey);
      expect(claims.sub).toBe('apple-sub-1');
      expect(claims.email).toBe('jan@example.com');
      expect(claims.email_verified).toBe(true);
    });
  });

  it('odmítne špatný audience', async () => {
    await withAppleEnv(async () => {
      const { token, getKey } = await makeTestToken({
        sub: 'apple-sub-1',
        email: 'jan@example.com',
        iss: 'https://appleid.apple.com',
        aud: 'jiny.client.id',
      });
      await expect(verifyIdToken(token, getKey)).rejects.toThrow();
    });
  });
});

describe('findOrCreateAppleUser', () => {
  it('vytvoří nového uživatele s ověřeným e-mailem', async () => {
    const user = await findOrCreateAppleUser('sub-1', 'novy@example.com');
    expect(user?.email).toBe('novy@example.com');
    const row = await prisma.user.findUniqueOrThrow({ where: { email: 'novy@example.com' } });
    expect(row.appleSub).toBe('sub-1');
    expect(row.emailVerifiedAt).not.toBeNull();
  });

  it('propojí existující účet podle e-mailu', async () => {
    await prisma.user.create({
      data: { email: 'stary@example.com', passwordHash: 'x' },
    });
    const user = await findOrCreateAppleUser('sub-2', 'stary@example.com');
    expect(user?.appleSub).toBe('sub-2');
  });

  it('vrátí existujícího uživatele podle sub', async () => {
    await findOrCreateAppleUser('sub-3', 'treti@example.com');
    const again = await findOrCreateAppleUser('sub-3', 'treti@example.com');
    expect(again?.appleSub).toBe('sub-3');
    expect(await prisma.user.count()).toBe(1);
  });
});

describe('authorizeUrl', () => {
  it('obsahuje povinné parametry', () => {
    const url = new URL(authorizeUrl(ENV, 'https://qr.lnrtdev.cz/api/auth/apple/callback', 's3cret'));
    expect(url.origin + url.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('client_id')).toBe('cz.qr4life.app');
    expect(url.searchParams.get('redirect_uri')).toContain('/api/auth/apple/callback');
    expect(url.searchParams.get('state')).toBe('s3cret');
    expect(url.searchParams.get('scope')).toBe('name email');
  });
});
