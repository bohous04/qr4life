import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { qrContent, renderQr } from '@/lib/qr/render';

/**
 * Stažení QR kódu (PNG/SVG). Jen vlastník — cizí id vrací 404,
 * aby nelezlo, které kódy existují.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return new Response(null, { status: 404 });

  const { id } = await params;
  const qr = await prisma.qrCode.findUnique({ where: { id } });
  if (!qr || qr.userId !== user.id) return new Response(null, { status: 404 });

  const content = qrContent(qr.type, qr.payload);
  if (!content) return new Response(null, { status: 404 });

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
