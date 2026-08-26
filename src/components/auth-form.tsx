'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';

type Mode = 'register' | 'login';

function errorMessage(mode: Mode, apiError?: string): string {
  if (mode === 'register') {
    const map: Record<string, string> = {
      email_taken: texts.auth.register.emailTaken,
      rate_limited: texts.auth.register.rateLimited,
    };
    return map[apiError ?? ''] ?? texts.auth.register.genericError;
  }
  const map: Record<string, string> = {
    invalid_credentials: texts.auth.login.invalid,
    rate_limited: texts.auth.login.rateLimited,
  };
  return map[apiError ?? ''] ?? texts.auth.login.genericError;
}

/** Sdílený formulář pro registraci a přihlášení. */
export function AuthForm({ mode, appleEnabled }: { mode: Mode; appleEnabled?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = mode === 'register' ? texts.auth.register : texts.auth.login;

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        if (mode === 'login') {
          router.push('/dashboard');
          router.refresh();
        } else {
          router.push('/verify-info');
        }
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(errorMessage(mode, data.error));
    } catch {
      setError(errorMessage(mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="font-heading text-2xl font-bold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.subtitle}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            {copy.email}
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
        <div>
          <label htmlFor="password" className="text-sm font-medium">
            {copy.password}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
          />
          {mode === 'register' && (
            <p className="mt-1 text-xs text-muted">{texts.auth.register.passwordHint}</p>
          )}
        </div>

        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {copy.submit}
        </button>
      </form>

      {appleEnabled && mode === 'login' && (
        <Link
          href="/api/auth/apple"
          className="mt-3 block w-full rounded-md border border-ink py-2.5 text-center font-medium hover:bg-line/40"
        >
          {texts.auth.register.appleButton}
        </Link>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        {mode === 'login' ? (
          <>
            {texts.auth.login.noAccount}{' '}
            <Link href="/register" className="font-medium text-accent hover:underline">
              {texts.auth.login.registerLink}
            </Link>
          </>
        ) : (
          <>
            {texts.auth.register.haveAccount}{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              {texts.auth.register.loginLink}
            </Link>
          </>
        )}
      </p>

      {mode === 'login' && (
        <p className="mt-2 text-center text-sm">
          <Link href="/reset/request" className="text-muted hover:underline">
            {texts.auth.login.forgot}
          </Link>
        </p>
      )}
    </>
  );
}
