import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { consumeToken, issueToken } from '@/lib/auth/tokens';
import { resetDb } from './db';

let userId: string;

beforeEach(async () => {
  await resetDb();
  const user = await prisma.user.create({
    data: { email: 'tokeny@example.com' },
  });
  userId = user.id;
});

afterEach(async () => {
  await resetDb();
});

describe('issueToken / consumeToken', () => {
  it('vrátí raw token, v DB je hash', async () => {
    const raw = await issueToken(userId, 'verify_email', 60);
    const row = await prisma.token.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(raw);
    expect(row.tokenHash).toHaveLength(64);
  });

  it('spotřebuje platný token a vrátí userId', async () => {
    const raw = await issueToken(userId, 'verify_email', 60);
    await expect(consumeToken(raw, 'verify_email')).resolves.toBe(userId);
  });

  it('token lze spotřebovat jen jednou', async () => {
    const raw = await issueToken(userId, 'verify_email', 60);
    await consumeToken(raw, 'verify_email');
    await expect(consumeToken(raw, 'verify_email')).resolves.toBeNull();
  });

  it('odmítne špatný typ', async () => {
    const raw = await issueToken(userId, 'verify_email', 60);
    await expect(consumeToken(raw, 'reset_password')).resolves.toBeNull();
  });

  it('odmítne prošlý token', async () => {
    const raw = await issueToken(userId, 'reset_password', -1);
    await expect(consumeToken(raw, 'reset_password')).resolves.toBeNull();
  });

  it('odmítne neexistující token', async () => {
    await expect(consumeToken('neexistuje', 'verify_email')).resolves.toBeNull();
  });
});
