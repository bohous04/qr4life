import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password', () => {
  it('hash se nerovná plaintextu', async () => {
    const hash = await hashPassword('tajne-heslo');
    expect(hash).not.toBe('tajne-heslo');
    expect(hash.startsWith('$argon2')).toBe(true);
  });

  it('verify potvrdí správné heslo', async () => {
    const hash = await hashPassword('tajne-heslo');
    await expect(verifyPassword(hash, 'tajne-heslo')).resolves.toBe(true);
  });

  it('verify odmítne špatné heslo', async () => {
    const hash = await hashPassword('tajne-heslo');
    await expect(verifyPassword(hash, 'spatne')).resolves.toBe(false);
  });

  it('dva hash téhož hesla se liší (sůl)', async () => {
    const a = await hashPassword('stejne');
    const b = await hashPassword('stejne');
    expect(a).not.toBe(b);
  });
});
