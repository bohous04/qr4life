/**
 * Whitelist schémat cílových URL. javascript:, data: a podobné jsou
 * cesta k phishingu — pustíme jen http/https (tel:/sms:/mailto: mají
 * vlastní typy kódů a skládají se z validovaných dat).
 */
export function assertSafeHttpUrl(raw: string): string | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
