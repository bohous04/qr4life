'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';

export interface AdminCodeRow {
  id: string;
  hash: string;
  name: string;
  type: string;
  mode: 'dynamic' | 'static';
  isActive: boolean;
  adminBlocked: boolean;
  blockedReason: string | null;
  ownerEmail: string;
  createdAt: string;
  scanCount: number;
}

/** Řádek v admin přehledu: náhled, badge typ/stav, meta, blokace/odblokace. */
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

  const badge = (label: string, classes: string) => (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );

  const statusBadge = code.adminBlocked
    ? badge(texts.dashboard.blocked, 'bg-red-100 text-red-700')
    : code.isActive
      ? badge(texts.dashboard.active, 'bg-green-100 text-green-800')
      : badge(texts.dashboard.paused, 'bg-line text-muted');

  const typeBadge = badge(
    texts.dashboard.typeNames[code.type as keyof typeof texts.dashboard.typeNames],
    'bg-accent/10 text-accent',
  );

  const isStatic = code.mode === 'static';

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white p-4 transition-colors hover:border-accent/50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/qr/${code.id}/download?format=png&size=128`}
        alt={texts.qr.previewAlt}
        width={56}
        height={56}
        className="h-14 w-14 shrink-0 rounded-md border border-line"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{code.name}</span>
          {typeBadge}
          {isStatic && (
            <span className="whitespace-nowrap rounded-full bg-line px-2.5 py-0.5 text-xs font-medium text-muted">
              {texts.dashboard.mode.staticBadge}
            </span>
          )}
          {statusBadge}
          {code.adminBlocked && code.blockedReason && (
            <span className="text-xs text-red-500">({code.blockedReason})</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
          <a
            href={`/${code.hash}`}
            target="_blank"
            rel="noreferrer"
            title={texts.admin.openCode}
            className="font-mono text-xs hover:text-accent hover:underline"
          >
            /{code.hash}
          </a>
          <span className="truncate">{code.ownerEmail}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted/80">
          {new Date(code.createdAt).toLocaleDateString('cs-CZ')} ·{' '}
          {/* Statický kód se neskenuje přes appku — počet skenů by tu byl zavádějící nula */}
          {isStatic ? (
            <span title={texts.dashboard.mode.staticNoScans}>—</span>
          ) : (
            <>
              {code.scanCount} {texts.admin.scansLabel}
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isStatic ? (
          // Obsah statického kódu je zapečený v obrázku, který nikdy neprochází
          // přes /{hash} — blokace (i odblokace) by tu byla čistě kosmetická
          // a mohla by admina mylně ujistit, že je zneužití zastaveno.
          // Ovládání proto vůbec nenabízíme, ať se nedá omylem spolehnout.
          <span
            title={texts.admin.staticBlockNote}
            className="whitespace-nowrap rounded-md border border-dashed border-line px-3 py-1.5 text-sm text-muted"
          >
            {texts.admin.staticBlockDisabled}
          </span>
        ) : code.adminBlocked ? (
          <button
            type="button"
            onClick={unblock}
            disabled={busy}
            className="whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-line/40"
          >
            {texts.admin.unblock}
          </button>
        ) : !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="whitespace-nowrap rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {texts.admin.block}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={texts.admin.blockReasonPlaceholder}
              className="w-44 rounded-md border border-line px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={block}
              disabled={busy}
              className="whitespace-nowrap rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              {texts.admin.block}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-sm"
            >
              {texts.common.cancel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
