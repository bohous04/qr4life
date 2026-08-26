import { prisma } from '@/lib/db';

/**
 * Zaloguje chybu do DB (přehled v adminu) i do konzole.
 * Nikdy nevyhazuje — logování nesmí rozbít požadavek.
 */
export async function logError(message: string, context?: string): Promise<void> {
  console.error(`[error] ${context ? `(${context}) ` : ''}${message}`);
  try {
    await prisma.errorLog.create({
      data: { message: message.slice(0, 2000), context: context?.slice(0, 500) },
    });
  } catch (error) {
    console.error('[error] nelze zapsat do errorLog:', error);
  }
}
