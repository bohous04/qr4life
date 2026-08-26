import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  getSessionUser,
} from '@/lib/auth/session';
import { resetDb } from './db';

let userId: string;

beforeEach(async () => {
  await resetDb();
  const user = await prisma.user.create({
    data: { email: 'test@example.com' },
  });
  userId = user.id;
});

afterEach(async () => {
  await resetDb();
});

describe('createSession / getSessionUser', () => {
  it('uloží hash, ne raw token', async () => {
    const { cookieValue } = await createSession(userId);
    const row = await prisma.session.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(cookieValue);
    expect(row.tokenHash).toHaveLength(64); // sha256 hex
    expect(SESSION_COOKIE).toBe('qfl_session');
  });

  it('vrátí uživatele podle cookie', async () => {
    const { cookieValue } = await createSession(userId);
    const user = await getSessionUser(cookieValue);
    expect(user?.id).toBe(userId);
  });

  it('neplatný token → null', async () => {
    await expect(getSessionUser('neexistuje')).resolves.toBeNull();
  });

  it('chybějící cookie → null', async () => {
    await expect(getSessionUser(null)).resolves.toBeNull();
  });

  it('prošlé sezení → null', async () => {
    const { cookieValue } = await createSession(userId);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(getSessionUser(cookieValue)).resolves.toBeNull();
  });

  it('smazaný uživatel → null (cascade)', async () => {
    const { cookieValue } = await createSession(userId);
    await prisma.user.delete({ where: { id: userId } });
    await expect(getSessionUser(cookieValue)).resolves.toBeNull();
  });
});

describe('destroySession', () => {
  it('smaže sezení', async () => {
    const { cookieValue } = await createSession(userId);
    await destroySession(cookieValue);
    await expect(getSessionUser(cookieValue)).resolves.toBeNull();
  });
});
