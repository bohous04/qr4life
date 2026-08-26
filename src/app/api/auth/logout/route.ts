import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, destroySession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookieValue) await destroySession(cookieValue);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
