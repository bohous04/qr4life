import Link from 'next/link';
import { texts } from '@/lib/i18n/cs';

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="font-heading text-lg font-bold tracking-wide">
        QR<span className="text-accent">4</span>LIFE
      </Link>
      <nav className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-md px-4 py-2 text-sm font-medium text-ink hover:bg-line/40"
        >
          {texts.nav.login}
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {texts.nav.register}
        </Link>
      </nav>
    </header>
  );
}
