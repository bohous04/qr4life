import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { payloadSchema, type QrPayloadType } from '@/lib/qr/payload-schema';
import { checkSafeBrowsing } from '@/lib/security/safe-browsing';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text']).optional(),
  payload: z.unknown().optional(),
  isActive: z.boolean().optional(),
});

/** Změna kódu — jen vlastník (cizí id → 404, netesení existence). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const qr = await prisma.qrCode.findUnique({ where: { id } });
  if (!qr || qr.userId !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const type = (body.data.type ?? qr.type) as QrPayloadType;
  const payload =
    body.data.payload !== undefined
      ? payloadSchema(type, body.data.payload)
      : payloadSchema(type, qr.payload);
  if (!payload) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  // Safe Browsing i při změně cíle
  if (type === 'url') {
    const target = (payload as { url: string }).url;
    if ((await checkSafeBrowsing(target)) === 'unsafe') {
      return NextResponse.json({ error: 'unsafe_url' }, { status: 400 });
    }
  }

  const updated = await prisma.qrCode.update({
    where: { id: qr.id },
    data: {
      ...(body.data.name !== undefined ? { name: body.data.name } : {}),
      ...(body.data.type !== undefined ? { type: body.data.type } : {}),
      payload: payload as object,
      ...(body.data.isActive !== undefined ? { isActive: body.data.isActive } : {}),
    },
  });
  return NextResponse.json({ ok: true, isActive: updated.isActive });
}

/** Smazání kódu — jen vlastník. Cascade maže i scany. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const qr = await prisma.qrCode.findUnique({ where: { id } });
  if (!qr || qr.userId !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.qrCode.delete({ where: { id: qr.id } });
  return NextResponse.json({ ok: true });
}
