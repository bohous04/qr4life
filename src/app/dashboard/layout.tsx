import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import { texts } from '@/lib/i18n/cs';

export const metadata = { title: texts.dashboard.title };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-heading text-lg font-bold tracking-wide">
              QR<span className="text-accent">4</span>LIFE
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-muted hover:text-ink">
                {texts.nav.dashboard}
              </Link>
              {user.role === 'admin' && (
                <Link href="/admin" className="text-muted hover:text-ink">
                  {texts.nav.admin}
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/new"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              {texts.nav.newCode}
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-sm text-muted hover:text-ink">
                {texts.nav.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
