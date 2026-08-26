'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { texts } from '@/lib/i18n/cs';

/** Horní navigace přihlášené části (dashboard + správa) se zvýrazněnou aktivní položkou. */
export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const items = [
    { href: '/dashboard', label: texts.nav.dashboard, active: pathname.startsWith('/dashboard') },
    ...(isAdmin
      ? [{ href: '/admin', label: texts.nav.admin, active: pathname.startsWith('/admin') }]
      : []),
  ];

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="whitespace-nowrap font-heading text-lg font-bold tracking-wide">
            QR<span className="text-accent">4</span>LIFE
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-md border px-3 py-1.5 font-medium ${
                  item.active
                    ? 'border-ink bg-ink text-white'
                    : 'border-line hover:bg-line/40'
                }`}
              >
                {item.label}
              </Link>
            ))}
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
  );
}
