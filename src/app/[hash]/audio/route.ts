import { prisma } from '@/lib/db';

/**
 * Stream zvukové stopy. Adresuje se hashem kódu, ne id stopy — díky tomu
 * platí stavy kódu a id souboru nikam neuniká. Sken se počítá na /{hash},
 * ne tady, aby přetáčení nenafukovalo statistiku.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  const qr = await prisma.qrCode.findUnique({
    where: { hash },
    select: { id: true, isActive: true, adminBlocked: true, audioTrack: true },
  });
  if (!qr || !qr.audioTrack) return new Response(null, { status: 404 });
  if (qr.adminBlocked) return new Response(null, { status: 403 });
  if (!qr.isActive) return new Response(null, { status: 503 });

  const data = Buffer.from(qr.audioTrack.data);
  const total = data.byteLength;
  const headers: Record<string, string> = {
    'Content-Type': qr.audioTrack.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };

  const range = request.headers.get('range');
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    const start = match[1] === '' ? 0 : Number(match[1]);
    const end = match[2] === '' ? total - 1 : Math.min(Number(match[2]), total - 1);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${total}` },
      });
    }
    const chunk = data.subarray(start, end + 1);
    return new Response(chunk as unknown as BodyInit, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': String(chunk.byteLength),
      },
    });
  }

  return new Response(data as unknown as BodyInit, {
    status: 200,
    headers: { ...headers, 'Content-Length': String(total) },
  });
}
