import { payloadSchema, type QrPayloadMap, type QrPayloadType } from '@/lib/qr/payload-schema';
import { vcardString } from '@/lib/qr/vcard';
import { texts } from '@/lib/i18n/cs';
import { mailtoUri, smsUri, telUri } from '@/lib/qr/uri-format';

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
  | { kind: 'wifi'; payload: QrPayloadMap['wifi'] }
  | { kind: 'audio'; title: string };

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
      return { kind: 'redirect', location: telUri((payload as QrPayloadMap['phone']).number) };
    }
    case 'sms': {
      return { kind: 'redirect', location: smsUri(payload as QrPayloadMap['sms']) };
    }
    case 'email': {
      return { kind: 'redirect', location: mailtoUri(payload as QrPayloadMap['email']) };
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
    case 'audio': {
      const audio = payload as QrPayloadMap['audio'];
      return { kind: 'audio', title: audio.title ?? texts.qr.audio.title };
    }
  }
}
