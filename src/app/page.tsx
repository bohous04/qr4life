import Link from 'next/link';
import { cookies } from 'next/headers';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { renderQrDataUrl } from '@/lib/qr/render';
import { appUrl } from '@/lib/http';
import { texts } from '@/lib/i18n/cs';

/** Ukázkový QR kód — reálný render v designu značky (jako na OG image). */
async function DemoQr() {
  const dataUrl = await renderQrDataUrl(appUrl(), 512);
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative rounded-[28px] bg-ink p-8">
        {/* oranžový akcent jako na OG image */}
        <div className="absolute -right-2 -top-2 h-6 w-6 rounded-md bg-accent" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt={texts.qr.previewAlt}
          width={224}
          height={224}
          className="h-52 w-52 rounded-xl"
        />
      </div>
      <p className="text-sm text-muted">{texts.home.hero.demoCaption}</p>
    </div>
  );
}

export default async function Home() {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  const primaryCtaHref = user ? '/dashboard/new' : '/register';

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
                href={primaryCtaHref}
                className="rounded-md bg-accent px-6 py-3 font-semibold text-white hover:opacity-90"
              >
                {user ? texts.nav.newCode : texts.home.hero.cta}
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
