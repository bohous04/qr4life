import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';

export type ActionType = 'verify_email' | 'reset_password';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Vytvoří jednorázový akční token (ověření e-mailu, reset hesla).
 * Vrací raw hodnotu pro odkaz v e-mailu; v DB je jen hash.
 */
export async function issueToken(
  userId: string,
  type: ActionType,
  ttlMinutes: number,
): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  await prisma.token.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });
  return raw;
}

/**
 * Atomicky spotřebuje token. Vrací userId, nebo null
 * (neexistující / jiný typ / prošlý / již použitý).
 */
export async function consumeToken(
  raw: string,
  type: ActionType,
): Promise<string | null> {
  const result = await prisma.token.updateMany({
    where: {
      tokenHash: hashToken(raw),
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (result.count === 0) return null;
  const token = await prisma.token.findFirst({ where: { tokenHash: hashToken(raw) } });
  return token?.userId ?? null;
}
