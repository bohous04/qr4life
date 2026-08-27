/** Next.js instrumentation — spustí se při startu serveru (nodejs runtime). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startSafeBrowsingSweep } = await import('@/lib/security/safe-browsing');
  startSafeBrowsingSweep();
  const { startOrphanTrackSweep } = await import('@/lib/audio/sweep');
  startOrphanTrackSweep();
}
