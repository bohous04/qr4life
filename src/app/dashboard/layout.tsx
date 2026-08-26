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
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/" className="whitespace-nowrap font-heading text-lg font-bold tracking-wide">
              QR<span className="text-accent">4</span>LIFE
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                href="/dashboard"
                className="whitespace-nowrap rounded-md border border-line px-3 py-1.5 font-medium hover:bg-line/40"
              >
                {texts.nav.dashboard}
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="whitespace-nowrap rounded-md border border-line px-3 py-1.5 font-medium hover:bg-line/40"
                >
                  {texts.nav.admin}
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/new"
              className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 sm:px-4 sm:py-2"
            >
              + {texts.nav.newCode}
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-line/40"
              >
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
