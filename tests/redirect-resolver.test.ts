import { describe, expect, it } from 'vitest';
import { resolveScan, type ScanInput } from '@/lib/qr/redirect-resolver';

const base: ScanInput = { type: 'url', payload: { url: 'https://example.com' }, isActive: true, adminBlocked: false };

describe('resolveScan', () => {
  it('url → redirect na cílovou URL', () => {
    expect(resolveScan(base)).toEqual({ kind: 'redirect', location: 'https://example.com' });
  });

  it('phone → tel: bez mezer', () => {
    const r = resolveScan({ ...base, type: 'phone', payload: { number: '+420 123 456 789' } });
    expect(r).toEqual({ kind: 'redirect', location: 'tel:+420123456789' });
  });

  it('sms → sms: s encoded body', () => {
    const r = resolveScan({
      ...base,
      type: 'sms',
      payload: { number: '+420123456789', body: 'Ahoj světe' },
    });
    expect(r).toEqual({
      kind: 'redirect',
      location: `sms:+420123456789?body=${encodeURIComponent('Ahoj světe')}`,
    });
  });

  it('sms bez body nemá query', () => {
    const r = resolveScan({ ...base, type: 'sms', payload: { number: '+420123456789' } });
    expect(r).toEqual({ kind: 'redirect', location: 'sms:+420123456789' });
  });

  it('email → mailto: se subject a body', () => {
    const r = resolveScan({
      ...base,
      type: 'email',
      payload: { to: 'jan@example.com', subject: 'Ahoj', body: 'Text' },
    });
    expect(r).toEqual({
      kind: 'redirect',
      location: `mailto:jan@example.com?subject=${encodeURIComponent('Ahoj')}&body=${encodeURIComponent('Text')}`,
    });
  });

  it('vcard → vcf obsah se jménem souboru', () => {
    const r = resolveScan({
      ...base,
      type: 'vcard',
      payload: { firstName: 'Jan', phone: '+420123456789' },
    });
    expect(r).toMatchObject({ kind: 'vcard', filename: 'kontakt.vcf' });
    expect(r).not.toBeNull();
    if (r && r.kind === 'vcard') expect(r.vcf).toContain('BEGIN:VCARD');
  });

  it('text → html', () => {
    const r = resolveScan({ ...base, type: 'text', payload: { text: 'Ahoj' } });
    expect(r).toMatchObject({ kind: 'text', text: 'Ahoj' });
  });

  it('wifi → wifi payload', () => {
    const payload = { ssid: 'Home', password: '12345678', hidden: false };
    const r = resolveScan({ ...base, type: 'wifi', payload });
    expect(r).toEqual({ kind: 'wifi', payload });
  });

  it('nevalidní payload → null', () => {
    expect(resolveScan({ ...base, payload: { url: 'javascript:alert(1)' } })).toBeNull();
  });

  it('audio s titulkem → title z payloadu', () => {
    const r = resolveScan({
      ...base,
      type: 'audio',
      payload: { trackId: 'clx0000000000000000000000', title: 'Znělka' },
    });
    expect(r).toEqual({ kind: 'audio', title: 'Znělka' });
  });

  it('audio bez titulku → title null (fallback na jméno souboru řeší volající, ne tahle čistá funkce)', () => {
    const r = resolveScan({
      ...base,
      type: 'audio',
      payload: { trackId: 'clx0000000000000000000000' },
    });
    expect(r).toEqual({ kind: 'audio', title: null });
  });
});
