import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';

export const SESSION_COOKIE = 'qfl_session';
const SESSION_TTL_DAYS = 30;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface CreatedSession {
  cookieValue: string;
  expiresAt: Date;
}

/** Vytvoří DB sezení a vrátí hodnotu pro httpOnly cookie. */
export async function createSession(userId: string): Promise<CreatedSession> {
  const raw = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });
  return { cookieValue: raw, expiresAt };
}

/** Vrátí uživatele podle hodnoty session cookie, nebo null. */
export async function getSessionUser(cookieValue: string | null | undefined) {
  if (!cookieValue) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(cookieValue) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
}

/** Smaže sezení (logout). */
export async function destroySession(cookieValue: string): Promise<void> {
  await prisma.session
    .delete({ where: { tokenHash: hashToken(cookieValue) } })
    .catch(() => undefined);
}
