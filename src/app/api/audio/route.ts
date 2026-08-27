import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { hit } from '@/lib/security/rate-limit';
import { clientIp } from '@/lib/http';
import { detectAudioMime, MAX_AUDIO_BYTES, MAX_TRACKS_PER_USER } from '@/lib/audio/sniff';

/** Signalizuje, že stream těla překročil povolený limit bajtů. */
class StreamTooLargeError extends Error {}

/**
 * Obalí čtený stream tak, aby se po překročení `limitBytes` zahodil a
 * dál se z něj čte chyba `StreamTooLargeError` — parser (formData) tak
 * nikdy nenabufferuje víc, než kolik dovolujeme, ať už klient pošle
 * jakoukoli (nebo žádnou) Content-Length hlavičku.
 */
function capReadableStream(body: ReadableStream<Uint8Array>, limitBytes: number): ReadableStream<Uint8Array> {
  let received = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > limitBytes) {
          controller.error(new StreamTooLargeError('stream too large'));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

/**
 * Nahrání zvukové stopy. Stopa vzniká bez vazby na kód; naváže ji až
 * POST /api/qr. Osiřelé stopy maže sweep po 24 h.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!user.emailVerifiedAt) {
    return NextResponse.json({ error: 'email_not_verified' }, { status: 403 });
  }
  if (hit(`audio-upload:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Velikost hlídáme ještě před parsováním těla, ať se velký soubor
  // vůbec nedostane do paměti. Content-Length je jen rychlá předběžná
  // kontrola — dá se vynechat (chunked přenos) nebo zalhat, takže samotné
  // parsování níže musí být limitované na úrovni streamu.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_AUDIO_BYTES + 4096) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  // Tvrdý limit na streamu: i bez (nebo se lživou) Content-Length hlavičkou
  // se do paměti nikdy nenabufferuje víc bajtů, než kolik dovolujeme.
  let form: FormData | null;
  try {
    const limitedBody = request.body ? capReadableStream(request.body, MAX_AUDIO_BYTES + 4096) : null;
    // `duplex` chybí ve verzi lib.dom.d.ts, kterou používáme, ale runtime
    // (Node/undici) ho pro streamované tělo vyžaduje.
    const boundRequest = limitedBody
      ? new Request(
          request.url,
          {
            method: 'POST',
            headers: request.headers,
            body: limitedBody,
            duplex: 'half',
          } as RequestInit & { duplex: 'half' },
        )
      : request;
    form = await boundRequest.formData();
  } catch (err) {
    if (err instanceof StreamTooLargeError) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 });
    }
    form = null;
  }

  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (file.size > MAX_AUDIO_BYTES) {
    // Pás a šle: pojistka pro případ, že by se limit streamu obešel.
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectAudioMime(new Uint8Array(buffer.subarray(0, 16)));
  if (!mime) return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });

  const count = await prisma.audioTrack.count({ where: { userId: user.id } });
  if (count >= MAX_TRACKS_PER_USER) {
    return NextResponse.json({ error: 'track_limit' }, { status: 409 });
  }

  const track = await prisma.audioTrack.create({
    data: {
      userId: user.id,
      filename: file.name.slice(0, 200) || 'audio',
      mime,
      size: buffer.byteLength,
      data: buffer,
    },
    select: { id: true, filename: true, size: true, mime: true },
  });

  return NextResponse.json(track, { status: 201 });
}
