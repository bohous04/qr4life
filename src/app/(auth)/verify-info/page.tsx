'use client';

import Link from 'next/link';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';

/** Informace po registraci: ověř e-mail + možnost poslat odkaz znovu. */
export default function VerifyInfoPage() {
  const [resent, setResent] = useState(false);
  const [email, setEmail] = useState('');

  async function resend() {
    if (!email) return;
    await fetch('/api/auth/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => undefined);
    setResent(true);
  }

  return (
    <>
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        {texts.auth.register.checkEmailTitle}
      </h1>
      <p className="mt-2 text-sm text-muted">{texts.auth.register.checkEmailBody}</p>

      <div className="mt-6 space-y-3">
        <input
          type="email"
          required
          placeholder={texts.auth.register.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={resend}
          disabled={!email || resent}
          className="w-full rounded-md border border-ink py-2.5 font-medium hover:bg-line/40 disabled:opacity-50"
        >
          {resent ? texts.auth.register.resent : texts.auth.register.resend}
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-accent hover:underline">
          {texts.auth.login.title}
        </Link>
      </p>
    </>
  );
}
