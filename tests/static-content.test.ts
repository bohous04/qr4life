import { describe, expect, it } from 'vitest';
import { isStaticCapable, staticContent } from '@/lib/qr/static-content';

describe('isStaticCapable', () => {
  it('povolí jen typy bez závislosti na serveru', () => {
    expect(isStaticCapable('wifi')).toBe(true);
    expect(isStaticCapable('text')).toBe(true);
    expect(isStaticCapable('url')).toBe(false);
    expect(isStaticCapable('audio')).toBe(false);
  });
});

describe('staticContent', () => {
  it('wifi vrací WIFI: řetězec', () => {
    expect(staticContent('wifi', { ssid: 'Home', password: null, hidden: false })).toBe(
      'WIFI:T:nopass;S:Home;;',
    );
  });

  it('vcard vrací vCard dokument', () => {
    const vcf = staticContent('vcard', { firstName: 'Jan', phone: '+420123456789' });
    expect(vcf).toContain('BEGIN:VCARD');
    expect(vcf).toContain('FN:Jan');
  });

  it('phone, sms a email vrací URI schémata', () => {
    expect(staticContent('phone', { number: '+420 123 456 789' })).toBe('tel:+420123456789');
    expect(staticContent('sms', { number: '+420123456789', body: 'ahoj ty' })).toBe(
      'sms:+420123456789?body=ahoj%20ty',
    );
    expect(staticContent('email', { to: 'a@b.cz', subject: 'Hej' })).toBe(
      'mailto:a@b.cz?subject=Hej',
    );
  });

  it('text vrací holý text', () => {
    expect(staticContent('text', { text: 'Zavírací doba 8–17' })).toBe('Zavírací doba 8–17');
  });

  it('nevalidní payload vrací null', () => {
    expect(staticContent('phone', { number: 'nope' })).toBeNull();
  });
});
