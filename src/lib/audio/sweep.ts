import { prisma } from '@/lib/db';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Smaže nahrané stopy, které se nikdy nenavázaly na kód. */
export async function sweepOrphanTracks(olderThanMs: number = DAY_MS): Promise<number> {
  const result = await prisma.audioTrack.deleteMany({
    where: { qrCodeId: null, createdAt: { lt: new Date(Date.now() - olderThanMs) } },
  });
  return result.count;
}

/** Spustí periodický úklid (6 h). Volá se z instrumentation. */
export function startOrphanTrackSweep(): void {
  setInterval(() => {
    sweepOrphanTracks().catch((error) => console.warn('[audio] sweep:', error));
  }, 6 * 60 * 60 * 1000).unref();
}
