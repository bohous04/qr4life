'use client';

import Link from 'next/link';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';

/** Nastavení nového hesla jednorázovým tokenem z e-mailu. */
export default function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    const { token } = await searchParams;
    if (!token) {
      setError(texts.auth.reset.invalidToken);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (response.ok) {
        setDone(true);
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(
        data.error === 'invalid_token'
          ? texts.auth.reset.invalidToken
          : texts.auth.reset.weakPassword,
      );
    } catch {
      setError(texts.auth.reset.genericError);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{texts.auth.reset.title}</h1>
        <p className="mt-3 text-sm text-muted">{texts.auth.reset.confirmDone}</p>
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
          <label htmlFor="password" className="text-sm font-medium">
            {texts.auth.reset.newPassword}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-accent">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {texts.auth.reset.confirmSubmit}
        </button>
      </form>
    </>
  );
}
