import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  appleEnv,
  exchangeCode,
  findOrCreateAppleUser,
  verifyIdToken,
} from '@/lib/auth/apple';
import { SESSION_COOKIE, createSession } from '@/lib/auth/session';
import { logError } from '@/lib/log-error';
import { appUrl } from '@/lib/http';

const STATE_COOKIE = 'qfl_apple_state';

function stateValid(cookieState: string | undefined, formState: string): boolean {
  if (!cookieState || cookieState !== formState) return false;
  const [nonce, signature] = cookieState.split('.');
  if (!nonce || !signature) return false;
  const expected = createHmac('sha256', process.env.SESSION_SECRET ?? 'dev')
    .update(nonce)
    .digest('base64url');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false; // různé délky podpisu → neplatný state
  }
}

/** Apple posílá code+state POSTem (response_mode=form_post). */
export async function POST(request: NextRequest) {
  const env = appleEnv();
  if (!env) {
    return NextResponse.redirect(new URL('/login?apple=unconfigured', appUrl()), 302);
  }

  const form = await request.formData();
  const code = form.get('code');
  const state = form.get('state');
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  if (typeof code !== 'string' || typeof state !== 'string' || !stateValid(cookieState, state)) {
    return NextResponse.redirect(new URL('/login?apple=state', appUrl()), 302);
  }

  const redirectUri = `${appUrl()}/api/auth/apple/callback`;
  const tokens = await exchangeCode(env, code, redirectUri);
  if (!tokens) {
    await logError('Apple token exchange selhal', 'apple/callback');
    return NextResponse.redirect(new URL('/login?apple=exchange', appUrl()), 302);
  }

  try {
    const claims = await verifyIdToken(tokens.idToken);
    if (!claims.email_verified) {
      return NextResponse.redirect(new URL('/login?apple=email', appUrl()), 302);
    }
    const user = await findOrCreateAppleUser(claims.sub, claims.email);
    if (!user) {
      return NextResponse.redirect(new URL('/login?apple=conflict', appUrl()), 302);
    }
    const { cookieValue, expiresAt } = await createSession(user.id);
    const response = NextResponse.redirect(new URL('/dashboard', appUrl()), 302);
    response.cookies.set(SESSION_COOKIE, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    await logError(`Apple id_token verifikace selhala: ${error instanceof Error ? error.message : String(error)}`, 'apple/callback');
    return NextResponse.redirect(new URL('/login?apple=token', appUrl()), 302);
  }
}
