'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';

export interface AdminCodeRow {
  id: string;
  hash: string;
  name: string;
  type: string;
  isActive: boolean;
  adminBlocked: boolean;
  blockedReason: string | null;
  ownerEmail: string;
}

/** Řádek v admin přehledu s blokací/odblokací. */
export function AdminRow({ code }: { code: AdminCodeRow }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function block() {
    setBusy(true);
    try {
      await fetch(`/api/admin/qr/${code.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: true, reason: reason || 'admin' }),
      });
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function unblock() {
    setBusy(true);
    try {
      await fetch(`/api/admin/qr/${code.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: false }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const status = code.adminBlocked
    ? texts.dashboard.blocked
    : code.isActive
      ? texts.dashboard.active
      : texts.dashboard.paused;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {code.name} <span className="text-muted">· {code.ownerEmail}</span>
        </div>
        <div className="text-sm text-muted">
          <code>{code.hash}</code> ·{' '}
          {texts.dashboard.typeNames[code.type as keyof typeof texts.dashboard.typeNames]} ·{' '}
          <span className={code.adminBlocked ? 'text-red-600' : ''}>{status}</span>
          {code.adminBlocked && code.blockedReason && ` (${code.blockedReason})`}
        </div>
      </div>

      {code.adminBlocked ? (
        <button
          type="button"
          onClick={unblock}
          disabled={busy}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-line/40"
        >
          {texts.admin.unblock}
        </button>
      ) : !confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          {texts.admin.block}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={texts.admin.blockReasonPlaceholder}
            className="rounded-md border border-line px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={block}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            {texts.admin.block}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md border border-line px-3 py-1.5 text-sm"
          >
            {texts.common.cancel}
          </button>
        </div>
      )}
    </div>
  );
}
