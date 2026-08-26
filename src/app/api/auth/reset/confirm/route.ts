import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { consumeToken } from '@/lib/auth/tokens';
import { hashPassword } from '@/lib/auth/password';

const bodySchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(200),
});

/** Potvrzení resetu hesla jednorázovým tokenem. */
export async function POST(request: NextRequest) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const userId = await consumeToken(body.data.token, 'reset_password');
  if (!userId) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const passwordHash = await hashPassword(body.data.password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  // Zneplatni všechna existující sezení — heslo se změnilo.
  await prisma.session.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
