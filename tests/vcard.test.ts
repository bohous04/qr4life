import { describe, expect, it } from 'vitest';
import { vcardString } from '@/lib/qr/vcard';

describe('vcardString', () => {
  it('vygeneruje základní vCard 3.0', () => {
    const vcf = vcardString({
      firstName: 'Jan',
      lastName: 'Novák',
      phone: '+420123456789',
    });
    expect(vcf).toContain('BEGIN:VCARD');
    expect(vcf).toContain('VERSION:3.0');
    expect(vcf).toContain('N:Novák;Jan;;;');
    expect(vcf).toContain('FN:Jan Novák');
    expect(vcf).toContain('TEL;TYPE=CELL:+420123456789');
    expect(vcf).toContain('END:VCARD');
    expect(vcf.endsWith('\r\n')).toBe(true);
  });

  it('escapuje čárky a středníky ve jméně', () => {
    const vcf = vcardString({
      firstName: 'Jan, starší',
      lastName: 'Novák; ml.',
      phone: '+420123456789',
    });
    expect(vcf).toContain('N:Novák\\; ml.;Jan\\, starší;;;');
  });

  it('volitelná pole chybí, když nejsou zadána', () => {
    const vcf = vcardString({ firstName: 'Jan', phone: '+420123456789' });
    expect(vcf).not.toContain('ORG:');
    expect(vcf).not.toContain('TITLE:');
    expect(vcf).not.toContain('EMAIL:');
    expect(vcf).not.toContain('URL:');
  });

  it('zahrne všechna volitelná pole', () => {
    const vcf = vcardString({
      firstName: 'Jan',
      lastName: 'Novák',
      org: 'QR4Life',
      title: 'CEO',
      phone: '+420123456789',
      email: 'jan@example.com',
      url: 'https://example.com',
    });
    expect(vcf).toContain('ORG:QR4Life');
    expect(vcf).toContain('TITLE:CEO');
    expect(vcf).toContain('EMAIL:jan@example.com');
    expect(vcf).toContain('URL:https://example.com');
  });
});
