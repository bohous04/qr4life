import { describe, expect, it } from 'vitest';
import { payloadSchema, type QrPayloadMap } from '@/lib/qr/payload-schema';

describe('payloadSchema', () => {
  it('url: platná https adresa projde', () => {
    expect(payloadSchema('url', { url: 'https://example.com/x' })).toEqual({
      url: 'https://example.com/x',
    });
  });

  it('url: http projde', () => {
    expect(payloadSchema('url', { url: 'http://example.com' })).toEqual({
      url: 'http://example.com',
    });
  });

  it('url: javascript: schéma odmítne', () => {
    expect(payloadSchema('url', { url: 'javascript:alert(1)' })).toBeNull();
  });

  it('url: data: schéma odmítne', () => {
    expect(payloadSchema('url', { url: 'data:text/html,x' })).toBeNull();
  });

  it('url: chybí url pole', () => {
    expect(payloadSchema('url', {})).toBeNull();
  });

  it('wifi: platný payload projde a odstraní neznámé klíče', () => {
    const result = payloadSchema('wifi', {
      ssid: 'Home',
      password: '12345678',
      hidden: false,
      extra: 'x',
    });
    expect(result).toEqual({ ssid: 'Home', password: '12345678', hidden: false });
  });

  it('wifi: ssid delší než 32 znaků odmítne', () => {
    expect(payloadSchema('wifi', { ssid: 'a'.repeat(33), password: null, hidden: false })).toBeNull();
  });

  it('wifi: krátké heslo odmítne', () => {
    expect(payloadSchema('wifi', { ssid: 'Home', password: '1234567', hidden: false })).toBeNull();
  });

  it('wifi: dlouhé heslo odmítne', () => {
    expect(payloadSchema('wifi', { ssid: 'Home', password: 'a'.repeat(64), hidden: false })).toBeNull();
  });

  it('wifi: prázdné heslo znamená otevřenou síť (null)', () => {
    expect(payloadSchema('wifi', { ssid: 'Home', password: '', hidden: false })).toEqual({
      ssid: 'Home',
      password: null,
      hidden: false,
    });
  });

  it('wifi: null heslo je povoleno pro otevřenou síť', () => {
    expect(payloadSchema('wifi', { ssid: 'Chalupa', password: null, hidden: false })).toEqual({
      ssid: 'Chalupa',
      password: null,
      hidden: false,
    });
  });

  it('wifi: null a prázdný string normalizují oba na null', () => {
    const withNull = payloadSchema('wifi', { ssid: 'Open', password: null, hidden: false });
    const withEmpty = payloadSchema('wifi', { ssid: 'Open', password: '', hidden: false });
    expect(withNull).toEqual(withEmpty);
    expect(withNull?.password).toBeNull();
  });

  it('wifi: 7-znaků dlouhé heslo se stále odmítne', () => {
    expect(payloadSchema('wifi', { ssid: 'Home', password: '1234567', hidden: false })).toBeNull();
  });

  it('phone: platné číslo projde', () => {
    expect(payloadSchema('phone', { number: '+420 123 456 789' })).toEqual({
      number: '+420 123 456 789',
    });
  });

  it('phone: písmena odmítne', () => {
    expect(payloadSchema('phone', { number: 'abc123' })).toBeNull();
  });

  it('sms: číslo i volitelný text projdou', () => {
    expect(payloadSchema('sms', { number: '+420123456789', body: 'Ahoj' })).toEqual({
      number: '+420123456789',
      body: 'Ahoj',
    });
  });

  it('email: platná adresa projde', () => {
    expect(
      payloadSchema('email', { to: 'jan@example.com', subject: 'Ahoj', body: 'Text' }),
    ).toEqual({ to: 'jan@example.com', subject: 'Ahoj', body: 'Text' });
  });

  it('email: neplatná adresa odmítne', () => {
    expect(payloadSchema('email', { to: 'neplatny' })).toBeNull();
  });

  it('text: platný text projde', () => {
    expect(payloadSchema('text', { text: 'Ahoj světe' })).toEqual({ text: 'Ahoj světe' });
  });

  it('text: prázdný text odmítne', () => {
    expect(payloadSchema('text', { text: '  ' })).toBeNull();
  });

  it('text: text nad 2000 znaků odmítne', () => {
    expect(payloadSchema('text', { text: 'a'.repeat(2001) })).toBeNull();
  });

  it('vcard: minimální vizitka projde', () => {
    expect(payloadSchema('vcard', { firstName: 'Jan', phone: '+420123456789' })).toEqual({
      firstName: 'Jan',
      phone: '+420123456789',
    });
  });

  it('vcard: plná vizitka projde', () => {
    const data = {
      firstName: 'Jan',
      lastName: 'Novák',
      org: 'QR4Life',
      title: 'CEO',
      phone: '+420123456789',
      email: 'jan@example.com',
      url: 'https://example.com',
    };
    expect(payloadSchema('vcard', data)).toEqual(data);
  });

  it('vcard: chybí telefon odmítne', () => {
    expect(payloadSchema('vcard', { firstName: 'Jan' })).toBeNull();
  });

  it('trimuje mezery u stringů', () => {
    expect(payloadSchema('url', { url: '  https://example.com  ' })).toEqual({
      url: 'https://example.com',
    });
  });

  it('neznámý typ odmítne', () => {
    expect(payloadSchema('nonsense' as keyof QrPayloadMap, {})).toBeNull();
  });
});

describe('audio payload', () => {
  it('vyžaduje trackId ve tvaru cuid', () => {
    expect(payloadSchema('audio', { trackId: 'cmta6j8dh0008pppuer6q0fww' })).toEqual({
      trackId: 'cmta6j8dh0008pppuer6q0fww',
    });
    expect(payloadSchema('audio', {})).toBeNull();
    expect(payloadSchema('audio', { trackId: 'x' })).toBeNull();
  });

  it('bere volitelný název stopy a zahazuje neznámé klíče', () => {
    expect(
      payloadSchema('audio', {
        trackId: 'cmta6j8dh0008pppuer6q0fww',
        title: 'Znělka',
        evil: 1,
      }),
    ).toEqual({ trackId: 'cmta6j8dh0008pppuer6q0fww', title: 'Znělka' });
  });
});
