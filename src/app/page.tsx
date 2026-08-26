import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { texts } from '@/lib/i18n/cs';

/** Ukázkový QR kód — statický SVG placeholder v duchu značky. */
function DemoQr() {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* 25×25 finder-pattern imitace; reálné kódy renderuje server (lib/qr/render) */}
      <svg viewBox="0 0 29 29" className="h-56 w-56 text-ink" role="img" aria-label="QR kód">
        <rect width="29" height="29" fill="none" />
        {[
          [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
          [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
          [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
          [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
          [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
          [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
          [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
        ))}
        <rect x="8" y="0" width="1" height="1" fill="currentColor" />
        <rect x="10" y="1" width="1" height="1" fill="currentColor" />
        <rect x="9" y="3" width="1" height="1" fill="currentColor" />
        <rect x="12" y="2" width="1" height="1" fill="currentColor" />
        <rect x="11" y="5" width="1" height="1" fill="currentColor" />
        <rect x="13" y="4" width="1" height="1" fill="currentColor" />
        <rect x="14" y="6" width="1" height="1" fill="currentColor" />
        <rect x="14" y="14" width="1" height="1" fill="currentColor" />
        <rect x="15" y="13" width="1" height="1" fill="currentColor" />
        <rect x="13" y="15" width="1" height="1" fill="currentColor" />
        <rect x="16" y="15" width="1" height="1" fill="currentColor" />
        <rect x="14" y="16" width="1" height="1" fill="currentColor" />
        <rect x="17" y="14" width="1" height="1" fill="currentColor" />
        <rect x="15" y="17" width="1" height="1" fill="currentColor" />
        <rect x="22" y="0" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="24" y="2" width="3" height="3" fill="currentColor" />
        <rect x="22" y="22" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="24" y="24" width="3" height="3" fill="currentColor" />
        <rect x="0" y="22" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="2" y="24" width="3" height="3" fill="currentColor" />
      </svg>
      <p className="text-sm text-muted">{texts.home.hero.demoCaption}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <div>
            <h1 className="font-heading text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              {texts.home.hero.title}
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted">{texts.home.hero.subtitle}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="rounded-md bg-accent px-6 py-3 font-semibold text-white hover:opacity-90"
              >
                {texts.home.hero.cta}
              </Link>
              <a
                href="#proc"
                className="rounded-md border border-line px-6 py-3 font-medium hover:bg-line/40"
              >
                {texts.home.hero.secondary}
              </a>
            </div>
          </div>
          <DemoQr />
        </section>

        {/* Proč dynamický */}
        <section id="proc" className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
            <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
              {texts.home.why.title}
            </h2>
            <p className="mt-3 max-w-xl text-muted">{texts.home.why.subtitle}</p>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {texts.home.why.points.map((point) => (
                <div key={point.title} className="grid grid-cols-[1fr_1fr] gap-6 rounded-lg border border-line p-6">
                  <div className="col-span-2">
                    <h3 className="font-heading text-xl font-semibold">{point.title}</h3>
                  </div>
                  <div className="text-sm text-muted line-through decoration-accent/70 decoration-2">
                    {texts.home.why.staticLabel}: {point.stat}
                  </div>
                  <div className="text-sm font-medium">
                    {texts.home.why.dynamicLabel}: {point.dyn}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Kde se hodí */}
        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
            <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
              {texts.home.useCases.title}
            </h2>
            <p className="mt-3 max-w-xl text-muted">{texts.home.useCases.subtitle}</p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {texts.home.useCases.cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg border border-line p-6 transition-colors hover:border-accent"
                >
                  <h3 className="font-heading text-lg font-semibold">{card.title}</h3>
                  <p className="mt-2 text-sm text-muted">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
