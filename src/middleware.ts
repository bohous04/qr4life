import { NextRequest, NextResponse } from 'next/server';

/**
 * CSRF ochrana: měnící požadavky musí mít Origin shodný s hostem.
 * GET požadavky nechází stav, nepodléhají CSRF.
 */
export function middleware(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return NextResponse.next();
  }
  const origin = request.headers.get('origin');
  if (!origin) return NextResponse.next(); // non-browser klienti (curl, aplikace)
  const originHost = new URL(origin).host;
  if (originHost === request.headers.get('host')) return NextResponse.next();
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export const config = {
  matcher: ['/api/:path*'],
};
