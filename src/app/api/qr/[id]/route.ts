import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { payloadSchema, type QrPayloadType } from '@/lib/qr/payload-schema';
import { checkSafeBrowsing } from '@/lib/security/safe-browsing';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text', 'audio']).optional(),
  payload: z.unknown().optional(),
  isActive: z.boolean().optional(),
  folderId: z.string().cuid().nullable().optional(),
  mode: z.enum(['dynamic', 'static']).optional(),
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

  // Režim je vlastnost vytištěného obrázku — po vytvoření se nemění.
  if (body.data.mode !== undefined && body.data.mode !== qr.mode) {
    return NextResponse.json({ error: 'mode_immutable' }, { status: 400 });
  }

  const type = (body.data.type ?? qr.type) as QrPayloadType;
  const payload =
    body.data.payload !== undefined
      ? payloadSchema(type, body.data.payload)
      : payloadSchema(type, qr.payload);
  if (!payload) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  // Výměna zvukové stopy: nová musí patřit uživateli a být volná, stará se maže.
  if (type === 'audio') {
    const requested = (payload as { trackId: string }).trackId;
    const track = await prisma.audioTrack.findUnique({ where: { id: requested } });
    if (!track || track.userId !== user.id || (track.qrCodeId !== null && track.qrCodeId !== qr.id)) {
      return NextResponse.json({ error: 'invalid_track' }, { status: 400 });
    }
    if (track.qrCodeId === null) {
      await prisma.audioTrack.deleteMany({ where: { qrCodeId: qr.id, id: { not: track.id } } });
      await prisma.audioTrack.update({ where: { id: track.id }, data: { qrCodeId: qr.id } });
    }
  } else {
    // Změna typu pryč od zvuku odpojenou stopu nemá komu nechat.
    await prisma.audioTrack.deleteMany({ where: { qrCodeId: qr.id } });
  }

  // Složka musí patřit uživateli (nebo null = bez složky)
  let folderId: string | null | undefined;
  if (body.data.folderId !== undefined) {
    if (body.data.folderId === null) {
      folderId = null;
    } else {
      const folder = await prisma.folder.findUnique({ where: { id: body.data.folderId } });
      if (!folder || folder.userId !== user.id) {
        return NextResponse.json({ error: 'invalid_folder' }, { status: 400 });
      }
      folderId = folder.id;
    }
  }

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
      ...(folderId !== undefined ? { folderId } : {}),
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
