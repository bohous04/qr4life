import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { hit } from '@/lib/security/rate-limit';
import { logError } from '@/lib/log-error';
import { clientIp } from '@/lib/http';

const createSchema = z.object({ name: z.string().trim().min(1).max(60) });

/** Seznam složek přihlášeného uživatele. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const folders = await prisma.folder.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  return NextResponse.json({ folders });
}

/** Vytvoření složky. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (hit(`folder-create:${clientIp(request)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  try {
    const folder = await prisma.folder.create({
      data: { userId: user.id, name: body.data.name },
      select: { id: true, name: true },
    });
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    await logError(`Vytvoření složky selhalo: ${error instanceof Error ? error.message : String(error)}`, 'POST /api/folders');
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
