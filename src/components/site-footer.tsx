import Link from 'next/link';
import { texts } from '@/lib/i18n/cs';

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 text-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
          {texts.home.footerCta.title}
        </h2>
        <p className="mt-3 text-muted">{texts.home.footerCta.subtitle}</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md border border-line px-5 py-2.5 text-sm font-medium hover:bg-line/40"
          >
            {texts.home.footerCta.login}
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            {texts.home.footerCta.register}
          </Link>
        </div>
        <div className="mt-16 flex flex-col items-center justify-between gap-4 text-sm text-muted md:flex-row">
          <span>© {new Date().getFullYear()} {texts.home.footer.copyright}</span>
          <a
            href="https://github.com/bohous04/qr4life"
            className="hover:text-ink"
            target="_blank"
            rel="noreferrer"
          >
            {texts.home.footer.github}
          </a>
          <span>{texts.common.credit}</span>
        </div>
      </div>
    </footer>
  );
}
