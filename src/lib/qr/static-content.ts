import { payloadSchema, type QrPayloadMap } from '@/lib/qr/payload-schema';
import { wifiString } from '@/lib/qr/wifi-string';
import { vcardString } from '@/lib/qr/vcard';

/**
 * Obsah statického kódu — to, co se zakóduje přímo do obrázku.
 * Dynamický kód místo toho kóduje {appUrl}/{hash}; rozhoduje download endpoint.
 */
export const STATIC_CAPABLE_TYPES = ['wifi', 'vcard', 'phone', 'sms', 'email', 'text'] as const;

export type StaticQrType = (typeof STATIC_CAPABLE_TYPES)[number];

export function isStaticCapable(type: string): type is StaticQrType {
  return (STATIC_CAPABLE_TYPES as readonly string[]).includes(type);
}

/** Telefonní číslo pro tel:/sms: — jen číslice a plus (stejně jako redirect-resolver). */
function telNumber(number: string): string {
  return number.replace(/[ ()-]/g, '');
}

export function staticContent(type: StaticQrType, payload: unknown): string | null {
  const parsed = payloadSchema(type, payload);
  if (!parsed) return null;

  switch (type) {
    case 'wifi':
      return wifiString(parsed as QrPayloadMap['wifi']);
    case 'vcard':
      return vcardString(parsed as QrPayloadMap['vcard']);
    case 'phone':
      return `tel:${telNumber((parsed as QrPayloadMap['phone']).number)}`;
    case 'sms': {
      const sms = parsed as QrPayloadMap['sms'];
      const body = sms.body ? `?body=${encodeURIComponent(sms.body)}` : '';
      return `sms:${telNumber(sms.number)}${body}`;
    }
    case 'email': {
      const email = parsed as QrPayloadMap['email'];
      const params = new URLSearchParams();
      if (email.subject) params.set('subject', email.subject);
      if (email.body) params.set('body', email.body);
      const query = params.toString();
      return `mailto:${email.to}${query ? `?${query}` : ''}`;
    }
    case 'text':
      return (parsed as QrPayloadMap['text']).text;
  }
}
