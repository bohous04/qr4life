'use client';

import { useRouter } from 'next/navigation';
import { QrTypeForm } from '@/components/qr-type-form';
import { texts } from '@/lib/i18n/cs';

const apiErrors: Record<string, string> = {
  email_not_verified: texts.dashboard.verifyFirstBody,
  rate_limited: texts.dashboard.rateLimited,
  invalid_payload: texts.dashboard.createError,
  invalid: texts.dashboard.createError,
  invalid_mode: texts.dashboard.createError,
  invalid_track: texts.dashboard.createError,
};

/** Průvodce novým kódem: typ → obsah → název. */
export default function NewCodePage() {
  const router = useRouter();

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">{texts.dashboard.new.title}</h1>
      <div className="mt-8">
        <QrTypeForm
          mode="create"
          submitLabel={texts.dashboard.new.create}
          onSubmit={async ({ type, name, payload, qrMode }) => {
            const response = await fetch('/api/qr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type, name, payload, mode: qrMode }),
            });
            if (response.ok) {
              router.push('/dashboard');
              router.refresh();
              return null;
            }
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            return data.error ? (apiErrors[data.error] ?? texts.dashboard.createError) : texts.dashboard.createError;
          }}
        />
      </div>
    </div>
  );
}
