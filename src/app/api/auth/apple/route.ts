import { createHmac, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { appleEnv, authorizeUrl } from '@/lib/auth/apple';
import { appUrl } from '@/lib/http';

const STATE_COOKIE = 'qfl_apple_state';

function signState(value: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET ?? 'dev')
    .update(value)
    .digest('base64url');
}

/** Zahájení Apple přihlášení — redirect na Apple. */
export async function GET() {
  const env = appleEnv();
  if (!env) {
    return NextResponse.json({ error: 'apple_not_configured' }, { status: 503 });
  }
  const nonce = randomBytes(16).toString('base64url');
  const state = `${nonce}.${signState(nonce)}`;
  const redirectUri = `${appUrl()}/api/auth/apple/callback`;
  const response = NextResponse.redirect(authorizeUrl(env, redirectUri, state), 302);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return response;
}
