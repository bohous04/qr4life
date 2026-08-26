import { describe, expect, it } from 'vitest';
import { assertSafeHttpUrl } from '@/lib/security/url-safety';

describe('assertSafeHttpUrl', () => {
  it('pustí https', () => {
    expect(assertSafeHttpUrl('https://example.com/x')).toBe('https://example.com/x');
  });

  it('pustí http', () => {
    expect(assertSafeHttpUrl('http://example.com')).toBe('http://example.com/');
  });

  it('zablokuje javascript:', () => {
    expect(assertSafeHttpUrl('javascript:alert(1)')).toBeNull();
  });

  it('zablokuje data:', () => {
    expect(assertSafeHttpUrl('data:text/html,x')).toBeNull();
  });

  it('zablokuje ftp:', () => {
    expect(assertSafeHttpUrl('ftp://example.com')).toBeNull();
  });

  it('zablokuje tel: (má vlastní typ kódu)', () => {
    expect(assertSafeHttpUrl('tel:+420123456789')).toBeNull();
  });

  it('zablokuje credentials v URL', () => {
    expect(assertSafeHttpUrl('https://user:pass@evil.com')).toBeNull();
  });

  it('zablokuje nesmysl', () => {
    expect(assertSafeHttpUrl('not a url')).toBeNull();
    expect(assertSafeHttpUrl('')).toBeNull();
  });
});
