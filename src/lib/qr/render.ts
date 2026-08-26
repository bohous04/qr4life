import QRCode from 'qrcode';

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

/** Data URI pro vložení do HTML (hero, Wi-Fi stránka) — barvy značky. */
export async function renderQrDataUrl(
  content: string,
  size = 400,
  colors?: { dark: string; light: string },
): Promise<string> {
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: size,
    color: { dark: colors?.dark ?? '#141210', light: colors?.light ?? '#FDFCFA' },
  });
}
