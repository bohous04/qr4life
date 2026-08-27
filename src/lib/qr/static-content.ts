import { payloadSchema, type QrPayloadMap } from '@/lib/qr/payload-schema';
import { wifiString } from '@/lib/qr/wifi-string';
import { vcardString } from '@/lib/qr/vcard';
import { mailtoUri, smsUri, telUri } from '@/lib/qr/uri-format';

/**
 * Obsah statického kódu — to, co se zakóduje přímo do obrázku.
 * Dynamický kód místo toho kóduje {appUrl}/{hash}; rozhoduje download endpoint.
 */
export const STATIC_CAPABLE_TYPES = ['wifi', 'vcard', 'phone', 'sms', 'email', 'text'] as const;

export type StaticQrType = (typeof STATIC_CAPABLE_TYPES)[number];

export function isStaticCapable(type: string): type is StaticQrType {
  return (STATIC_CAPABLE_TYPES as readonly string[]).includes(type);
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
      return telUri((parsed as QrPayloadMap['phone']).number);
    case 'sms':
      return smsUri(parsed as QrPayloadMap['sms']);
    case 'email':
      return mailtoUri(parsed as QrPayloadMap['email']);
    case 'text':
      return (parsed as QrPayloadMap['text']).text;
  }
}
