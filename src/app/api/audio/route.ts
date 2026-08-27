import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { hit } from '@/lib/security/rate-limit';
import { clientIp } from '@/lib/http';
import {
  detectAudioMime,
  MAX_AUDIO_BYTES,
  MAX_TRACKS_PER_USER,
  MAX_UPLOAD_REQUEST_BYTES,
  sanitizeAudioFilename,
} from '@/lib/audio/sniff';

/**
 * Stav ořezávání streamu, sdílený mezi `capReadableStream` a handlerem.
 * Nespoléháme na to, že se chyba, kterou stream vyhodí, dochová beze
 * změny až do `catch` bloku po `formData()` — undici multipart parser
 * ji může zabalit nebo nahradit jinou. Místo identity chyby proto po
 * jakémkoli selhání parsování čteme tenhle sdílený příznak.
 */
interface StreamCapState {
  exceeded: boolean;
  received: number;
}

/**
 * Obalí čtený stream tak, aby se po překročení `limitBytes` zahodil a
 * nastavil se `state.exceeded` — parser (formData) tak nikdy
 * nenabufferuje víc, než kolik dovolujeme, ať už klient pošle jakoukoli
 * (nebo žádnou) Content-Length hlavičku.
 */
function capReadableStream(
  body: ReadableStream<Uint8Array>,
  limitBytes: number,
  state: StreamCapState,
): ReadableStream<Uint8Array> {
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        state.received += chunk.byteLength;
        if (state.received > limitBytes) {
          state.exceeded = true;
          controller.error(new Error('stream too large'));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

/**
 * Kolik uploadů se smí zpracovávat současně, napříč všemi uživateli.
 * `clientIp()` čte první záznam z X-Forwarded-For, kterou si klient za
 * Traefikem může nastavit sám — limit jen podle IP tedy jde obejít.
 * I bez obcházení ale každý pokus (přijatý i zamítnutý limitem na
 * uživatele) nejdřív nabufferuje desítky MB a pak čeká na zámek řádku
 * uživatele (`SELECT ... FOR UPDATE` v transakci níže) — souběžné
 * pokusy by se tak řadily za sebe a žraly paměť i připojení z poolu,
 * než se vůbec rozhodne o zamítnutí. In-process čítač proto zamítne
 * nadbytečné uploady rovnou, ještě před bufferováním těla.
 */
const MAX_CONCURRENT_UPLOADS = 3;
let inFlightUploads = 0;

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
  // Kombinace IP a id uživatele: IP se dá za Traefikem zfalšovat
  // (spoofnutá/sdílená X-Forwarded-For by jinak obešla limit), ale
  // přihlášený uživatel má vždy jen svůj vlastní účet — limit na
  // user.id proto drží i při podvržené IP.
  if (
    process.env.E2E !== '1' &&
    (hit(`audio-upload:${clientIp(request)}`, 20, 60 * 60 * 1000) ||
      hit(`audio-upload-user:${user.id}`, 20, 60 * 60 * 1000))
  ) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  if (inFlightUploads >= MAX_CONCURRENT_UPLOADS) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  inFlightUploads++;

  try {
    // Velikost hlídáme ještě před parsováním těla, ať se velký soubor
    // vůbec nedostane do paměti. Content-Length je jen rychlá předběžná
    // kontrola — dá se vynechat (chunked přenos) nebo zalhat, takže samotné
    // parsování níže musí být limitované na úrovni streamu.
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_UPLOAD_REQUEST_BYTES) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 });
    }

    // Tvrdý limit na streamu: i bez (nebo se lživou) Content-Length hlavičkou
    // se do paměti nikdy nenabufferuje víc bajtů, než kolik dovolujeme.
    const capState: StreamCapState = { exceeded: false, received: 0 };
    let form: FormData | null;
    try {
      const limitedBody = request.body ? capReadableStream(request.body, MAX_UPLOAD_REQUEST_BYTES, capState) : null;
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
    } catch {
      // Rozlišujeme podle sdíleného příznaku, ne podle instance chyby —
      // ta se přes undici multipart parser nemusí dochovat beze změny.
      form = null;
    }

    if (form === null && capState.exceeded) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 });
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

    const filename = sanitizeAudioFilename(file.name);

    // Kontrola limitu a vložení musí být atomické — jinak dva souběžné
    // uploady mohou oba přečíst počet pod limitem a oba vložit. Řádek
    // uživatele proto nejdřív zamkneme (`FOR UPDATE`), teprve pak počítáme
    // a vkládáme: souběžné uploady stejného uživatele se tak serializují.
    const track = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;

      const count = await tx.audioTrack.count({ where: { userId: user.id } });
      if (count >= MAX_TRACKS_PER_USER) {
        return null;
      }

      return tx.audioTrack.create({
        data: {
          userId: user.id,
          filename,
          mime,
          size: buffer.byteLength,
          data: buffer,
        },
        select: { id: true, filename: true, size: true, mime: true },
      });
    }, {
      // Uvnitř zámku se zapisuje až 15 MB blobu — výchozích 5 s Prismy
      // by za zátěže stačit nemuselo a legitimní upload by spadl na 500.
      timeout: 20_000,
      maxWait: 10_000,
    });

    if (!track) {
      return NextResponse.json({ error: 'track_limit' }, { status: 409 });
    }

    return NextResponse.json(track, { status: 201 });
  } finally {
    inFlightUploads--;
  }
}
