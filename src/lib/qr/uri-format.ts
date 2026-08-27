/**
 * Sdílené čisté helpery pro stavbu URI schémat (tel:, sms:, mailto:).
 * Bez závislostí na Prisma/Zod/src/app — používá je jak redirect-resolver
 * (skener → redirect), tak static-content (obsah tištěného statického kódu).
 */

/** Telefonní číslo pro tel:/sms: — jen číslice a plus. */
export function telNumber(number: string): string {
  return number.replace(/[ ()-]/g, '');
}

/** URI schéma tel:. */
export function telUri(number: string): string {
  return `tel:${telNumber(number)}`;
}

/** URI schéma sms: s volitelně encoded body. */
export function smsUri(payload: { number: string; body?: string }): string {
  const body = payload.body ? `?body=${encodeURIComponent(payload.body)}` : '';
  return `sms:${telNumber(payload.number)}${body}`;
}

/** URI schéma mailto: se subjectem a/nebo body v query stringu. */
export function mailtoUri(payload: { to: string; subject?: string; body?: string }): string {
  const params = new URLSearchParams();
  if (payload.subject) params.set('subject', payload.subject);
  if (payload.body) params.set('body', payload.body);
  const query = params.toString();
  return `mailto:${payload.to}${query ? `?${query}` : ''}`;
}
