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
  initialFolderId,
  folders,
}: {
  id: string;
  initialType: string;
  initialName: string;
  initialPayload: unknown;
  initialFolderId: string | null;
  folders: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [folderId, setFolderId] = useState<string>(initialFolderId ?? '');

  async function saveFolder(nextFolderId: string) {
    setFolderId(nextFolderId);
    await fetch(`/api/qr/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: nextFolderId === '' ? null : nextFolderId }),
    });
    setSaved(true);
    router.refresh();
  }

  return (
    <>
      {saved && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {texts.dashboard.saved}
        </p>
      )}

      {/* Složka */}
      <div className="mb-6 max-w-md">
        <label htmlFor="qr-folder" className="text-sm font-medium">
          {texts.dashboard.editPage.folderLabel}
        </label>
        <select
          id="qr-folder"
          value={folderId}
          onChange={(e) => saveFolder(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 focus:border-accent focus:outline-none"
        >
          <option value="">{texts.dashboard.editPage.noFolder}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <QrTypeForm
        mode="edit"
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
