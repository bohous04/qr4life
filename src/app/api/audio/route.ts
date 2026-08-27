import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { hit } from '@/lib/security/rate-limit';
import { clientIp } from '@/lib/http';
import { detectAudioMime, MAX_AUDIO_BYTES, MAX_TRACKS_PER_USER } from '@/lib/audio/sniff';

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
  // vůbec nedostane do paměti.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_AUDIO_BYTES + 4096) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (file.size > MAX_AUDIO_BYTES) {
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
