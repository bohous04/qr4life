import QRCode from 'qrcode';
import { wifiString } from '@/lib/qr/wifi-string';
import { vcardString } from '@/lib/qr/vcard';

/**
 * Jediné místo nastavení QR renderingu (spec §12): náhled v administraci
 * i stažený soubor vznikají stejným voláním, takže se nemohou lišit.
 */
export async function renderQr(
  content: string,
  format: 'png' | 'svg',
  size = 512,
): Promise<Buffer | string> {
  const options = {
    errorCorrectionLevel: 'M' as const,
    margin: 2,
    width: size,
  };
  if (format === 'svg') return QRCode.toString(content, { ...options, type: 'svg' });
  return QRCode.toBuffer(content, { ...options, type: 'png' });
}

/** Data URI pro vložení do HTML (Wi-Fi stránka). */
export async function renderQrDataUrl(content: string, size = 400): Promise<string> {
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: size,
  });
}

/** Obsah QR kódu podle typu (co se fyzicky zakóduje do obrázku). */
export function qrContent(type: string, payload: unknown): string | null {
  const p = payload as Record<string, unknown>;
  switch (type) {
    case 'url':
      return typeof p.url === 'string' ? p.url : null;
    case 'wifi':
      return typeof p.ssid === 'string'
        ? wifiString({ ssid: p.ssid, password: typeof p.password === 'string' ? p.password : null, hidden: p.hidden === true })
        : null;
    case 'vcard':
      return typeof p.firstName === 'string' && typeof p.phone === 'string'
        ? vcardString(p as never)
        : null;
    case 'phone':
      return typeof p.number === 'string' ? `tel:${p.number.replace(/[ ()-]/g, '')}` : null;
    case 'sms': {
      if (typeof p.number !== 'string') return null;
      const number = p.number.replace(/[ ()-]/g, '');
      const body = typeof p.body === 'string' && p.body ? `?body=${encodeURIComponent(p.body)}` : '';
      return `sms:${number}${body}`;
    }
    case 'email': {
      if (typeof p.to !== 'string') return null;
      const params = new URLSearchParams();
      if (typeof p.subject === 'string' && p.subject) params.set('subject', p.subject);
      if (typeof p.body === 'string' && p.body) params.set('body', p.body);
      const query = params.toString();
      return `mailto:${p.to}${query ? `?${query}` : ''}`;
    }
    case 'text':
      return typeof p.text === 'string' ? p.text : null;
    default:
      return null;
  }
}
