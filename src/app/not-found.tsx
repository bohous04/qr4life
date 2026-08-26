import Link from 'next/link';
import { texts } from '@/lib/i18n/cs';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="font-heading text-lg font-bold tracking-wide">
        QR<span className="text-accent">4</span>LIFE
      </div>
      <h1 className="mt-8 font-heading text-4xl font-bold tracking-tight md:text-5xl">
        {texts.notFound.title}
      </h1>
      <p className="mt-4 text-muted">{texts.notFound.body}</p>
      <Link
        href="/"
        className="mt-8 rounded-md bg-accent px-6 py-3 font-semibold text-white hover:opacity-90"
      >
        {texts.notFound.goHome}
      </Link>
    </div>
  );
}
