import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { hit } from '@/lib/security/rate-limit';
import { clientIp } from '@/lib/http';

/**
 * Velikost dávky čtené z `substring()` na jedno volání databáze. 256 KiB
 * je kompromis mezi počtem SQL dotazů (menší dávka = víc roundtripů) a
 * špičkovou pamětí na požadavek (větší dávka = víc bufferu najednou) —
 * i plné 15MB stopy se tak přehrávač dočká po kouscích, ne jako jeden
 * blok v paměti procesu.
 */
const CHUNK_BYTES = 256 * 1024;

/**
 * Limit streamu: 300 požadavků za minutu na dvojici (IP, hash). Jeden
 * poslech přehrávače s `preload="metadata"` a přetáčením znamená víc
 * Range požadavků (metadata, pak dílčí načítání při seeku) a za jednou
 * IP (NAT restaurace, kanceláře) může poslouchat víc lidí najednou —
 * limit proto počítáme na klienta i kód zvlášť, ne globálně, a nastavený
 * dost vysoko, aby normální přehrávání nikdy nenarazilo (celá 15MB stopa
 * stažená po 256KB dávkách je ~60 požadavků, limit tak pokryje i několik
 * souběžných plných stažení za minutu).
 */
const STREAM_LIMIT = 300;
const STREAM_WINDOW_MS = 60 * 1000;

/**
 * Stream vybrané části zvukového souboru přímo z Postgresu přes
 * `substring()`. Nikdy nenačítá celý blob do paměti procesu — vždy jen
 * po `CHUNK_BYTES` — díky čemuž je špičková paměť na požadavek shora
 * omezená bez ohledu na velikost stopy.
 */
function createByteRangeStream(trackId: string, start: number, length: number): ReadableStream<Uint8Array> {
  let offset = start;
  const end = start + length; // exkluzivní horní mez

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= end) {
        controller.close();
        return;
      }
      const take = Math.min(CHUNK_BYTES, end - offset);
      // 1-based offset — substring() v Postgresu čísluje bajty od 1.
      // Explicitní ::int: Prisma bez něj parametry posílá jako bigint a
      // Postgres nemá substring(bytea, bigint, bigint) přetížení.
      const rows = await prisma.$queryRaw<{ chunk: Uint8Array }[]>`
        SELECT substring("data" from ${offset + 1}::int for ${take}::int) AS chunk
        FROM "AudioTrack"
        WHERE id = ${trackId}
      `;
      const chunk = rows[0]?.chunk;
      if (!chunk || chunk.byteLength === 0) {
        controller.close();
        return;
      }
      // Buffer.from(u8) by bajty zkopíroval; tahle forma jen obalí
      // existující paměť bez kopie.
      controller.enqueue(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      offset += chunk.byteLength;
    },
  });
}

/**
 * Stream zvukové stopy. Adresuje se hashem kódu, ne id stopy — díky tomu
 * platí stavy kódu a id souboru nikam neuniká. Sken se počítá na /{hash},
 * ne tady, aby přetáčení nenafukovalo statistiku.
 *
 * Výkonově kritická cesta: veřejný, neautentizovaný endpoint, o který si
 * `<audio>` element řekne při každém načtení stránky i při každém
 * přetočení. Proto se z DB nikdy netahá celý `data` sloupec (až 15 MB) —
 * jen `size` pro spočítání hlaviček a požadovaný rozsah bajtů přes
 * `substring()`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;

  if (hit(`audio-stream:${clientIp(request)}:${hash}`, STREAM_LIMIT, STREAM_WINDOW_MS)) {
    return new Response(null, { status: 429 });
  }

  const qr = await prisma.qrCode.findUnique({
    where: { hash },
    select: {
      isActive: true,
      adminBlocked: true,
      audioTrack: { select: { id: true, mime: true, size: true } },
    },
  });
  if (!qr || !qr.audioTrack) return new Response(null, { status: 404 });
  if (qr.adminBlocked) return new Response(null, { status: 403 });
  if (!qr.isActive) return new Response(null, { status: 503 });

  const { id: trackId, mime, size: total } = qr.audioTrack;
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };

  const range = request.headers.get('range');
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    let start: number;
    let end: number;
    if (match[1] === '') {
      // Sufixový tvar "bytes=-N" = posledních N bajtů (RFC 7233), ne od 0.
      const suffixLength = Number(match[2]);
      start = Math.max(total - suffixLength, 0);
      end = total - 1;
      if (suffixLength <= 0) {
        // Nulová/neplatná délka sufixu nelze uspokojit.
        return new Response(null, {
          status: 416,
          headers: { ...headers, 'Content-Range': `bytes */${total}` },
        });
      }
    } else {
      start = Number(match[1]);
      end = match[2] === '' ? total - 1 : Math.min(Number(match[2]), total - 1);
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${total}` },
      });
    }
    const length = end - start + 1;
    return new Response(createByteRangeStream(trackId, start, length), {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': String(length),
      },
    });
  }

  return new Response(createByteRangeStream(trackId, 0, total), {
    status: 200,
    headers: { ...headers, 'Content-Length': String(total) },
  });
}
