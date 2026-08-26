import { payloadSchema, type QrPayloadMap, type QrPayloadType } from '@/lib/qr/payload-schema';
import { vcardString } from '@/lib/qr/vcard';
import { texts } from '@/lib/i18n/cs';

export type ScanInput = {
  type: QrPayloadType;
  payload: unknown;
  isActive: boolean;
  adminBlocked: boolean;
};

export type Resolution =
  | { kind: 'redirect'; location: string }
  | { kind: 'vcard'; vcf: string; filename: string }
  | { kind: 'text'; text: string }
  | { kind: 'wifi'; payload: QrPayloadMap['wifi'] };

/** Telefonní číslo pro tel:/sms: — jen číslice a plus. */
function telNumber(number: string): string {
  return number.replace(/[ ()-]/g, '');
}

/**
 * Čistá funkce: rozhodne, co se stane po naskenování.
 * Neexistující/pozastavený/blokovaný řeší caller (DB lookup).
 */
export function resolveScan(qr: ScanInput): Resolution | null {
  // Payload z JSONB znovu validujeme — obrana proti ručně pozměněným datům.
  const payload = payloadSchema(qr.type, qr.payload);
  if (!payload) return null;
  switch (qr.type) {
    case 'url': {
      return { kind: 'redirect', location: (payload as QrPayloadMap['url']).url };
    }
    case 'phone': {
      return { kind: 'redirect', location: `tel:${telNumber((payload as QrPayloadMap['phone']).number)}` };
    }
    case 'sms': {
      const sms = payload as QrPayloadMap['sms'];
      const body = sms.body ? `?body=${encodeURIComponent(sms.body)}` : '';
      return { kind: 'redirect', location: `sms:${telNumber(sms.number)}${body}` };
    }
    case 'email': {
      const email = payload as QrPayloadMap['email'];
      const params = new URLSearchParams();
      if (email.subject) params.set('subject', email.subject);
      if (email.body) params.set('body', email.body);
      const query = params.toString();
      return { kind: 'redirect', location: `mailto:${email.to}${query ? `?${query}` : ''}` };
    }
    case 'vcard': {
      return {
        kind: 'vcard',
        vcf: vcardString(payload as QrPayloadMap['vcard']),
        filename: texts.qr.vcardFilename,
      };
    }
    case 'text': {
      return { kind: 'text', text: (payload as QrPayloadMap['text']).text };
    }
    case 'wifi': {
      return { kind: 'wifi', payload: payload as QrPayloadMap['wifi'] };
    }
  }
}
