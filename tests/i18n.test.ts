import { describe, expect, it } from 'vitest';
import { texts } from '@/lib/i18n/cs';

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

describe('i18n slovník', () => {
  it('obsahuje klíč home.hero.title', () => {
    expect(isNonEmptyString(texts.home.hero.title)).toBe(true);
  });

  it('obsahuje klíč auth.login.submit', () => {
    expect(isNonEmptyString(texts.auth.login.submit)).toBe(true);
  });

  it('obsahuje klíč qr.status.inactive', () => {
    expect(isNonEmptyString(texts.qr.status.inactiveTitle)).toBe(true);
  });

  it('obsahuje klíč notfound.title', () => {
    expect(isNonEmptyString(texts.notFound.title)).toBe(true);
  });

  it('má 6 kartiček scénářů použití', () => {
    expect(texts.home.useCases.cards).toHaveLength(6);
  });

  it('má 4 porovnávací body static vs. dynamický', () => {
    expect(texts.home.why.points).toHaveLength(4);
  });

  it('má názvy a popisky všech 7 typů kódů', () => {
    const types = ['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text'] as const;
    for (const type of types) {
      expect(isNonEmptyString(texts.dashboard.typeNames[type])).toBe(true);
      expect(isNonEmptyString(texts.dashboard.typeDescriptions[type])).toBe(true);
    }
  });
});
