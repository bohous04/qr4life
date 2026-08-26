/**
 * Generuje vCard 3.0 (RFC 2426) pro typ „vizitka".
 * Řádky se oddělují CRLF, speciální znaky (\ , ;) se escapují.
 */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

export interface VCardPayload {
  firstName: string;
  lastName?: string;
  org?: string;
  title?: string;
  phone: string;
  email?: string;
  url?: string;
}

export function vcardString(p: VCardPayload): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(p.lastName ?? '')};${esc(p.firstName)};;;`,
    `FN:${esc([p.firstName, p.lastName].filter(Boolean).join(' '))}`,
  ];
  if (p.org) lines.push(`ORG:${esc(p.org)}`);
  if (p.title) lines.push(`TITLE:${esc(p.title)}`);
  lines.push(`TEL;TYPE=CELL:${p.phone}`);
  if (p.email) lines.push(`EMAIL:${p.email}`);
  if (p.url) lines.push(`URL:${p.url}`);
  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
}
