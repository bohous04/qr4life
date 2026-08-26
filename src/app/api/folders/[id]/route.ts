import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';

const patchSchema = z.object({ name: z.string().trim().min(1).max(60) });

/** Přejmenování složky — jen vlastník. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.userId !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const updated = await prisma.folder.update({
    where: { id: folder.id },
    data: { name: body.data.name },
    select: { id: true, name: true },
  });
  return NextResponse.json(updated);
}

/** Smazání složky — kódy zůstávají, jen ztratí složku (SetNull). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.userId !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await prisma.folder.delete({ where: { id: folder.id } });
  return NextResponse.json({ ok: true });
}
