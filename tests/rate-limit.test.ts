import { afterEach, describe, expect, it } from 'vitest';
import { hit, resetRateLimits } from '@/lib/security/rate-limit';

afterEach(() => resetRateLimits());

describe('hit', () => {
  it('propustí do limitu, poté blokuje', () => {
    let now = 1000;
    expect(hit('ip1', 2, 1000, () => now)).toBe(false);
    now = 1100;
    expect(hit('ip1', 2, 1000, () => now)).toBe(false);
    now = 1200;
    expect(hit('ip1', 2, 1000, () => now)).toBe(true);
  });

  it('po vypršení okna zase propouští', () => {
    let now = 2000;
    expect(hit('ip2', 1, 500, () => now)).toBe(false);
    now = 2600;
    expect(hit('ip2', 1, 500, () => now)).toBe(false);
  });

  it('klíče jsou nezávislé', () => {
    let now = 3000;
    expect(hit('a', 1, 1000, () => now)).toBe(false);
    expect(hit('b', 1, 1000, () => now)).toBe(false);
  });

  it('různá okna mají různé limity', () => {
    let now = 4000;
    for (let i = 0; i < 5; i++) {
      now += 10;
      hit('c', 5, 1000, () => now);
    }
    now += 10;
    expect(hit('c', 5, 1000, () => now)).toBe(true);
  });
});
