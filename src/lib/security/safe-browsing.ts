import { prisma } from '@/lib/db';

/**
 * Google Safe Browsing v4 — kontrola cílových URL typu „odkaz".
 * Aktivní jen s GOOGLE_SAFE_BROWSING_KEY; chyba API je fail-open
 * (doména nesmí přestat fungovat kvůli výpadku GSB), zablokování
 * řeší admin blokace kódu.
 */
export type SafetyVerdict = 'ok' | 'unsafe';

export async function checkSafeBrowsing(url: string): Promise<SafetyVerdict> {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return 'ok';

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          client: { clientId: 'qr4life', clientVersion: '1.0.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      },
    );
    if (!response.ok) {
      console.warn(`[safe-browsing] HTTP ${response.status}`);
      return 'ok';
    }
    const data = (await response.json()) as { matches?: unknown[] };
    return data.matches && data.matches.length > 0 ? 'unsafe' : 'ok';
  } catch (error) {
    console.warn('[safe-browsing] kontrola selhala:', error);
    return 'ok';
  }
}

/**
 * Průchod všemi url kódy na pozadí (volá instrumentation interval).
 * Zasažené kódy se zablokují s důvodem safe-browsing.
 */
export async function sweepUnsafeUrls(): Promise<number> {
  if (!process.env.GOOGLE_SAFE_BROWSING_KEY) return 0;
  const codes = await prisma.qrCode.findMany({
    where: { type: 'url', adminBlocked: false },
    select: { id: true, payload: true },
  });
  let blocked = 0;
  for (const code of codes) {
    const url = (code.payload as { url?: unknown }).url;
    if (typeof url !== 'string') continue;
    if ((await checkSafeBrowsing(url)) === 'unsafe') {
      await prisma.qrCode.update({
        where: { id: code.id },
        data: { adminBlocked: true, blockedReason: 'safe-browsing' },
      });
      blocked += 1;
    }
  }
  if (blocked > 0) console.warn(`[safe-browsing] zablokováno ${blocked} kódů`);
  return blocked;
}

/** Spustí periodický re-check (12 h). Volá se z instrumentation. */
export function startSafeBrowsingSweep(): void {
  if (!process.env.GOOGLE_SAFE_BROWSING_KEY) return;
  setInterval(() => {
    sweepUnsafeUrls().catch((error) => console.warn('[safe-browsing] sweep:', error));
  }, 12 * 60 * 60 * 1000).unref();
}
