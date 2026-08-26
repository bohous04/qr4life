import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { consumeToken } from '@/lib/auth/tokens';
import { appUrl } from '@/lib/http';

/** Ověření e-mailu kliknutím na odkaz z e-mailu. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const userId = token ? await consumeToken(token, 'verify_email') : null;
  if (!userId) {
    return NextResponse.redirect(new URL('/login?verified=0', appUrl()), 302);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  return NextResponse.redirect(new URL('/login?verified=1', appUrl()), 302);
}
