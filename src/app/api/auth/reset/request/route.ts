import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { issueToken } from '@/lib/auth/tokens';
import { sendMail } from '@/lib/mail';
import { hit } from '@/lib/security/rate-limit';
import { clientIp, appUrl } from '@/lib/http';
import { texts } from '@/lib/i18n/cs';

const bodySchema = z.object({ email: z.email().max(254) });

/** Žádost o reset hesla. Vrací vždy 200, netesí existenci účtu. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (hit(`reset:${ip}`, 5, 60 * 60 * 1000)) {
    // I při rate limitu odpoví stejně, aby šel limit netesit.
    return NextResponse.json({ ok: true });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: true });

  const email = body.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await issueToken(user.id, 'reset_password', 60);
    const url = `${appUrl()}/reset/confirm?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: email,
      subject: texts.email.reset.subject,
      text: texts.email.reset.body
        .replace('{email}', email)
        .replace('{url}', url),
    }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
