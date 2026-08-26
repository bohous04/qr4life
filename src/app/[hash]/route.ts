import { after, type NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/db';
import { resolveScan } from '@/lib/qr/redirect-resolver';
import {
  blockedHtml,
  branded404Html,
  inactiveHtml,
  textPageHtml,
  wifiPageHtml,
} from '@/lib/qr/pages-html';
import { wifiString } from '@/lib/qr/wifi-string';
import { isReservedPath } from '@/lib/qr/hash';

const NO_STORE = { 'Cache-Control': 'no-store' };

function htmlResponse(body: string, status: number, extra?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE, ...extra },
  });
}

/**
 * Redirect endpoint — nejkritičtější část aplikace.
 * Vždy 302 (nikdy 301) + Cache-Control: no-store, aby změna cíle
 * byla okamžitě účinná.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;

  if (isReservedPath(hash)) return htmlResponse(branded404Html(), 404);

  const qr = await prisma.qrCode.findUnique({ where: { hash } });
  if (!qr) return htmlResponse(branded404Html(), 404);
  if (qr.adminBlocked) return htmlResponse(blockedHtml(), 403);
  if (!qr.isActive) return htmlResponse(inactiveHtml(), 503);

  const resolution = resolveScan({ type: qr.type, payload: qr.payload, isActive: qr.isActive, adminBlocked: qr.adminBlocked });
  if (!resolution) return htmlResponse(branded404Html(), 404);

  // Sken logujeme až po odeslání odpovědi, aby nezdržoval redirect.
  after(() =>
    prisma.scan
      .create({
        data: {
          qrCodeId: qr.id,
          userAgent: _request.headers.get('user-agent')?.slice(0, 512),
          country: _request.headers.get('cf-ipcountry'),
        },
      })
      .catch(() => undefined),
  );

  switch (resolution.kind) {
    case 'redirect':
      return new Response(null, { status: 302, headers: { Location: resolution.location, ...NO_STORE } });
    case 'vcard':
      return new Response(resolution.vcf, {
        status: 200,
        headers: {
          'Content-Type': 'text/vcard; charset=utf-8',
          'Content-Disposition': `attachment; filename="${resolution.filename}"`,
          ...NO_STORE,
        },
      });
    case 'text':
      return htmlResponse(textPageHtml(resolution.text), 200);
    case 'wifi': {
      const dataUrl = await QRCode.toDataURL(wifiString(resolution.payload), {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 400,
      });
      return htmlResponse(wifiPageHtml({ ...resolution.payload, wifiQrDataUrl: dataUrl }), 200);
    }
  }
}
