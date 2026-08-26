'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { QrTypeForm, type QrTypeKey } from '@/components/qr-type-form';
import { texts } from '@/lib/i18n/cs';

const apiErrors: Record<string, string> = {
  invalid_payload: texts.dashboard.saveError,
  invalid: texts.dashboard.saveError,
};

/** Editační formulář existujícího kódu (typ lze změnit, obsah se přepíše). */
export function EditQrForm({
  id,
  initialType,
  initialName,
  initialPayload,
}: {
  id: string;
  initialType: string;
  initialName: string;
  initialPayload: unknown;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  return (
    <>
      {saved && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {texts.dashboard.saved}
        </p>
      )}
      <QrTypeForm
        mode="edit"
        typeFixed
        initialType={initialType as QrTypeKey}
        initialName={initialName}
        initialPayload={initialPayload as Record<string, string | boolean>}
        submitLabel={texts.common.save}
        onSubmit={async ({ type, name, payload }) => {
          setSaved(false);
          const response = await fetch(`/api/qr/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, name, payload }),
          });
          if (response.ok) {
            setSaved(true);
            router.refresh();
            return null;
          }
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          return data.error ? (apiErrors[data.error] ?? texts.dashboard.saveError) : texts.dashboard.saveError;
        }}
      />
    </>
  );
}
