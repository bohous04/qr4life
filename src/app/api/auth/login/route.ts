import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE, createSession } from '@/lib/auth/session';
import { hit } from '@/lib/security/rate-limit';
import { clientIp } from '@/lib/http';

const bodySchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

/** Fixní hash pro timing-konzistentní ověření neexistujících účtů. */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ZGF4c2F1c2FnZWltcHJvY2Vzcw$Tt4KJPiPcMCCgCJxCQkZ1cXCLtVSaGDSMK5heGqDDak';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const email = body.data.email.toLowerCase();

  if (
    process.env.E2E !== '1' &&
    (hit(`login:${ip}`, 10, 15 * 60 * 1000) || hit(`login:${ip}:${email}`, 10, 15 * 60 * 1000))
  ) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user?.passwordHash
    ? await verifyPassword(user.passwordHash, body.data.password)
    : await verifyPassword(DUMMY_HASH, body.data.password).catch(() => false);

  if (!user?.passwordHash || !ok) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const { cookieValue, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return response;
}
