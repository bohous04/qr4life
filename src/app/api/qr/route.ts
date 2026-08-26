import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { payloadSchema, type QrPayloadType } from '@/lib/qr/payload-schema';
import { generateHash, isReservedPath } from '@/lib/qr/hash';
import { hit } from '@/lib/security/rate-limit';
import { checkSafeBrowsing } from '@/lib/security/safe-browsing';
import { logError } from '@/lib/log-error';
import { clientIp, appUrl } from '@/lib/http';

const bodySchema = z.object({
  type: z.enum(['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text']),
  name: z.string().trim().min(1).max(100),
  payload: z.unknown(),
});

const QR_TYPES: QrPayloadType[] = ['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text'];

/** Vytvoření nového QR kódu. Vyžaduje přihlášení i ověřený e-mail. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!user.emailVerifiedAt) {
    return NextResponse.json({ error: 'email_not_verified' }, { status: 403 });
  }
  if (hit(`qr-create:${clientIp(request)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  if (hit(`qr-create-user:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const payload = payloadSchema(body.data.type as QrPayloadType, body.data.payload);
  if (!payload) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  // Safe Browsing při uložení (bez klíče okamžitě 'ok')
  if (body.data.type === 'url') {
    const target = (payload as { url: string }).url;
    if ((await checkSafeBrowsing(target)) === 'unsafe') {
      return NextResponse.json({ error: 'unsafe_url' }, { status: 400 });
    }
  }

  // Kolize hashe: retry na unique constraint (P2002), max 5 pokusů.
  for (let attempt = 0; attempt < 5; attempt++) {
    const hash = generateHash();
    if (isReservedPath(hash)) continue;
    try {
      const qr = await prisma.qrCode.create({
        data: {
          userId: user.id,
          hash,
          name: body.data.name,
          type: body.data.type,
          payload: payload as object,
        },
      });
      return NextResponse.json(
        { id: qr.id, hash: qr.hash, url: `${appUrl()}/${qr.hash}` },
        { status: 201 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        continue;
      }
      await logError(`Vytvoření kódu selhalo: ${error instanceof Error ? error.message : String(error)}`, 'POST /api/qr');
      throw error;
    }
  }
  return NextResponse.json({ error: 'hash_collision' }, { status: 500 });
}

export type { QR_TYPES };
