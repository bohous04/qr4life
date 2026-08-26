import { randomInt } from 'node:crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LENGTH = 7;

/** Cesty vyhrazené aplikaci — generátor hashů je nesmí obsadit. */
export const RESERVED_PATHS = [
  'login',
  'register',
  'logout',
  'dashboard',
  'admin',
  'api',
  'w',
  't',
  'verify',
  'reset',
  'apple',
  'static',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'assets',
  'docs',
  'public',
  '.well-known',
] as const;

export function isReservedPath(path: string): boolean {
  return (RESERVED_PATHS as readonly string[]).includes(path);
}

export function generateHash(): string {
  let out = '';
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
