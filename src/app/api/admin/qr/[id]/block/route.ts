import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';

const bodySchema = z.object({
  blocked: z.boolean(),
  reason: z.string().trim().max(200).optional(),
});

/** Admin blokace kódu. Jen role admin. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const qr = await prisma.qrCode.findUnique({ where: { id } });
  if (!qr) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  await prisma.qrCode.update({
    where: { id: qr.id },
    data: body.data.blocked
      ? { adminBlocked: true, blockedReason: body.data.reason ?? 'admin' }
      : { adminBlocked: false, blockedReason: null },
  });
  return NextResponse.json({ ok: true });
}
