import { describe, expect, it } from 'vitest';
import { mailtoUri, smsUri, telNumber, telUri } from '@/lib/qr/uri-format';

describe('telNumber', () => {
  it('odstraní mezery, závorky a pomlčky', () => {
    expect(telNumber('+420 (123) 456-789')).toBe('+420123456789');
  });

  it('zachová vedoucí plus', () => {
    expect(telNumber('+420123456789')).toBe('+420123456789');
  });

  it('číslo bez oddělovačů nechá beze změny', () => {
    expect(telNumber('123456789')).toBe('123456789');
  });
});

describe('telUri', () => {
  it('vrátí tel: s normalizovaným číslem', () => {
    expect(telUri('+420 123 456 789')).toBe('tel:+420123456789');
  });
});

describe('smsUri', () => {
  it('bez body nemá query', () => {
    expect(smsUri({ number: '+420123456789' })).toBe('sms:+420123456789');
  });

  it('s body přidá percent-encoded query', () => {
    expect(smsUri({ number: '+420123456789', body: 'Ahoj světe' })).toBe(
      `sms:+420123456789?body=${encodeURIComponent('Ahoj světe')}`,
    );
  });
});

describe('mailtoUri', () => {
  it('bez subjectu a body nemá query', () => {
    expect(mailtoUri({ to: 'a@b.cz' })).toBe('mailto:a@b.cz');
  });

  it('jen se subjectem', () => {
    expect(mailtoUri({ to: 'a@b.cz', subject: 'Hej' })).toBe('mailto:a@b.cz?subject=Hej');
  });

  it('jen s body', () => {
    // mailtoUri staví query přes URLSearchParams — mezera se kóduje jako "+", ne "%20".
    expect(mailtoUri({ to: 'a@b.cz', body: 'Text zprávy' })).toBe('mailto:a@b.cz?body=Text+zpr%C3%A1vy');
  });

  it('se subjectem i body', () => {
    expect(mailtoUri({ to: 'a@b.cz', subject: 'Hej', body: 'Text' })).toBe(
      `mailto:a@b.cz?subject=Hej&body=Text`,
    );
  });
});
