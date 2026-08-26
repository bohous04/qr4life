'use client';

import Link from 'next/link';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';

/** Žádost o reset hesla — vždy zobrazí stejnou zprávu (netesení existence účtu). */
export default function ResetRequestPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    setBusy(true);
    try {
      await fetch('/api/auth/reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } finally {
      setDone(true);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{texts.auth.reset.title}</h1>
        <p className="mt-3 text-sm text-muted">{texts.auth.reset.requestDone}</p>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-accent hover:underline">
            {texts.auth.reset.backToLogin}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-heading text-2xl font-bold tracking-tight">{texts.auth.reset.title}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            {texts.auth.reset.email}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {texts.auth.reset.requestSubmit}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-muted hover:underline">
          {texts.auth.reset.backToLogin}
        </Link>
      </p>
    </>
  );
}
