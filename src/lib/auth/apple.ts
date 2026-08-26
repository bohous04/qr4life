import { generateKeyPairSync } from 'node:crypto';
import {
  SignJWT,
  createRemoteJWKSet,
  decodeJwt,
  importPKCS8,
  jwtVerify,
} from 'jose';
import { prisma } from '@/lib/db';

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

const APPLE_AUDIENCE = APPLE_ISSUER;

export interface AppleEnv {
  servicesId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}

/** Načte Apple credentials z env; vrací null, když cokoli chybí. */
export function appleEnv(): AppleEnv | null {
  const servicesId = process.env.APPLE_SERVICES_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const rawKey = process.env.APPLE_PRIVATE_KEY;
  if (!servicesId || !teamId || !keyId || !rawKey) return null;
  // Coolify multiline env obalí hodnotu uvozovkami; odstraníme je + podporíme \\n.
  let privateKey = rawKey.trim();
  if (
    (privateKey.startsWith("'") && privateKey.endsWith("'")) ||
    (privateKey.startsWith('"') && privateKey.endsWith('"'))
  ) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;
  if (!privateKey.includes('PRIVATE KEY')) return null;
  return { servicesId, teamId, keyId, privateKey };
}

export function appleConfigured(): boolean {
  return appleEnv() !== null;
}

/** Podepíše client_secret JWT (ES256) pro token endpoint. */
export async function buildClientSecret(env: AppleEnv): Promise<string> {
  const key = await importPKCS8(env.privateKey, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env.keyId })
    .setIssuer(env.teamId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience(APPLE_AUDIENCE)
    .setSubject(env.servicesId)
    .sign(key);
}

/** Vymění authorization code za tokeny. */
export async function exchangeCode(
  env: AppleEnv,
  code: string,
  redirectUri: string,
): Promise<{ idToken: string } | null> {
  const clientSecret = await buildClientSecret(env);
  const body = new URLSearchParams({
    client_id: env.servicesId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { id_token?: string };
  return data.id_token ? { idToken: data.id_token } : null;
}

export interface AppleIdTokenClaims {
  sub: string;
  email: string;
  email_verified: boolean;
}

/** Ověří id_token proti Apple JWKS (audience + issuer + podpis). */
export async function verifyIdToken(
  idToken: string,
  getKey?: Parameters<typeof jwtVerify>[1],
): Promise<AppleIdTokenClaims> {
  const env = appleEnv();
  if (!env) throw new Error('Apple není nakonfigurováno');
  const key = getKey ?? createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  const { payload } = await jwtVerify(idToken, key, {
    issuer: APPLE_ISSUER,
    audience: env.servicesId,
  });
  const claims = payload as Partial<AppleIdTokenClaims>;
  if (!claims.sub || !claims.email) {
    throw new Error('id_token postrádá sub nebo email');
  }
  return {
    sub: claims.sub,
    email: claims.email,
    email_verified: claims.email_verified !== false,
  };
}

/**
 * Najde nebo vytvoří uživatele podle Apple sub.
 * Existující účet se stejným e-mailem propojí.
 */
export async function findOrCreateAppleUser(
  sub: string,
  email: string,
): Promise<{ id: string; email: string; appleSub: string | null } | null> {
  const normalized = email.toLowerCase();
  const bySub = await prisma.user.findUnique({ where: { appleSub: sub } });
  if (bySub) return bySub;

  const byEmail = await prisma.user.findUnique({ where: { email: normalized } });
  if (byEmail) {
    if (byEmail.appleSub && byEmail.appleSub !== sub) return null;
    return prisma.user.update({ where: { id: byEmail.id }, data: { appleSub: sub } });
  }

  const isAdmin = normalized === (process.env.ADMIN_EMAIL ?? '').toLowerCase();
  return prisma.user.create({
    data: {
      email: normalized,
      appleSub: sub,
      emailVerifiedAt: new Date(),
      ...(isAdmin ? { role: 'admin' as const } : {}),
    },
  });
}

/** Authorizační URL pro redirect na Apple. */
export function authorizeUrl(env: AppleEnv, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    response_mode: 'form_post',
    client_id: env.servicesId,
    redirect_uri: redirectUri,
    scope: 'name email',
    state,
  });
  return `${APPLE_AUTH_URL}?${params.toString()}`;
}

// ---- testovací helper (používá jen test suite) ----

/** Vygeneruje testovací ES256 klíč + podepsaný id_token pro unit testy. */
export async function makeTestToken(
  claims: Record<string, unknown>,
): Promise<{ token: string; getKey: Parameters<typeof jwtVerify>[1] }> {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .sign(privateKey);
  const getKey: Parameters<typeof jwtVerify>[1] = async () => publicKey;
  return { token, getKey };
}

// decodeJwt se používá v testech k dekódování claims.
export { decodeJwt };
