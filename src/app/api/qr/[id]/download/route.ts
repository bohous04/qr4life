import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { renderQr } from '@/lib/qr/render';
import { appUrl } from '@/lib/http';
import { isStaticCapable, staticContent } from '@/lib/qr/static-content';

/**
 * Stažení QR kódu (PNG/SVG). Jen vlastník, plus admin kvůli náhledům
 * ve správě — cizí id vrací běžnému uživateli 404, aby nelezlo,
 * které kódy existují.
 *
 * Dynamický kód kóduje VÝHRADNĚ krátkou redirect URL /{hash} — to je
 * jeho smysl: vytištěný kód zůstává, cíl se mění v administraci.
 * Statický kód nese obsah přímo (viz static-content.ts).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return new Response(null, { status: 404 });

  const { id } = await params;
  const qr = await prisma.qrCode.findUnique({ where: { id } });
  if (!qr || (qr.userId !== user.id && user.role !== 'admin')) {
    return new Response(null, { status: 404 });
  }

  // Statický kód nese obsah přímo; dynamický kóduje krátkou redirect URL.
  let content = `${appUrl()}/${qr.hash}`;
  if (qr.mode === 'static' && isStaticCapable(qr.type)) {
    const direct = staticContent(qr.type, qr.payload);
    if (!direct) return new Response(null, { status: 404 });
    content = direct;
  }

  const format = request.nextUrl.searchParams.get('format') === 'svg' ? 'svg' : 'png';
  const sizeParam = Number(request.nextUrl.searchParams.get('size') ?? 512);
  const size = Number.isFinite(sizeParam) ? Math.min(Math.max(sizeParam, 128), 2048) : 512;

  const body = await renderQr(content, format, size);
  return new Response(body as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': format === 'svg' ? 'image/svg+xml' : 'image/png',
      'Content-Disposition': `attachment; filename="qr4life-${qr.hash}.${format}"`,
      'Cache-Control': 'no-store',
    },
  });
}
