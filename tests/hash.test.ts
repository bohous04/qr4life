import { describe, expect, it } from 'vitest';
import { RESERVED_PATHS, generateHash, isReservedPath } from '@/lib/qr/hash';

describe('generateHash', () => {
  it('generuje 7 znaků base62', () => {
    expect(generateHash()).toMatch(/^[a-zA-Z0-9]{7}$/);
  });

  it('generuje náhodné hashe (200 vzorků, ≥190 unikátních)', () => {
    const hashes = new Set(Array.from({ length: 200 }, () => generateHash()));
    expect(hashes.size).toBeGreaterThanOrEqual(190);
  });
});

describe('isReservedPath', () => {
  it.each(['login', 'register', 'api', 'dashboard', 'admin', '_next', 'favicon.ico'])(
    'rezervuje %s',
    (path) => {
      expect(isReservedPath(path)).toBe(true);
    },
  );

  it('nerezervuje obyčejný hash', () => {
    expect(isReservedPath('abc1234')).toBe(false);
  });

  it('rozlišuje velikost písmen', () => {
    expect(isReservedPath('Login')).toBe(false);
  });

  it('obsahuje alespoň 18 rezervovaných cest', () => {
    expect(RESERVED_PATHS.length).toBeGreaterThanOrEqual(18);
  });
});
