import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { issueToken } from '@/lib/auth/tokens';
import { sendMail } from '@/lib/mail';
import { hit } from '@/lib/security/rate-limit';
import { clientIp, appUrl } from '@/lib/http';
import { texts } from '@/lib/i18n/cs';

const bodySchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(200),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  // E2E=1 vypne limity (testy běží z jedné IP a rychle za sebou).
  if (process.env.E2E !== '1' && hit(`register:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const email = body.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }

  const passwordHash = await hashPassword(body.data.password);
  const isAdmin = email === (process.env.ADMIN_EMAIL ?? '').toLowerCase();
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      ...(isAdmin ? { role: 'admin' as const } : {}),
    },
  });

  const token = await issueToken(user.id, 'verify_email', 48 * 60);
  const url = `${appUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: texts.email.verify.subject,
    text: texts.email.verify.body.replace('{url}', url),
  }).catch(() => undefined);

  return NextResponse.json({ ok: true }, { status: 201 });
}
