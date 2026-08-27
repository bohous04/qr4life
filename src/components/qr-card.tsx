'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';

export interface QrCardData {
  id: string;
  hash: string;
  name: string;
  type: string;
  isActive: boolean;
  adminBlocked: boolean;
  createdAt: string;
  scanCount: number;
  mode: 'dynamic' | 'static';
}

function scanLabel(count: number): string {
  if (count === 1) return texts.dashboard.scanCountOne;
  if (count >= 2 && count <= 4) return texts.dashboard.scanCountFew;
  return texts.dashboard.scanCount;
}

/** Karta kódu v přehledu: náhled, název, přehledné akce, mazání s potvrzením. */
export function QrCard({ code }: { code: QrCardData }) {
  const router = useRouter();
  const [name, setName] = useState(code.name);
  const [isActive, setIsActive] = useState(code.isActive);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/${code.hash}` : `/${code.hash}`;

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/qr/${code.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/qr/${code.id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusLabel = code.adminBlocked
    ? texts.dashboard.blocked
    : isActive
      ? texts.dashboard.active
      : texts.dashboard.paused;

  const actionClass =
    'whitespace-nowrap rounded-md border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-line/40';

  return (
    <div className="rounded-lg border border-line bg-white p-4 sm:p-5">
      <div className="flex gap-4 sm:gap-5">
        {/* Náhled — stejný endpoint jako download (spec §12) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/qr/${code.id}/download?format=png&size=256`}
          alt={texts.qr.previewAlt}
          width={96}
          height={96}
          className="h-24 w-24 shrink-0 sm:h-28 sm:w-28"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== code.name && patch({ name })}
              className="min-w-0 flex-1 rounded-md border border-transparent px-1 py-0.5 font-heading text-lg font-semibold hover:border-line focus:border-accent focus:outline-none"
              aria-label={texts.dashboard.name.label}
            />
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                code.adminBlocked
                  ? 'bg-red-100 text-red-700'
                  : isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-line text-muted'
              }`}
            >
              {statusLabel}
            </span>
            {/* Statický kód: odznak vedle stavu — obrázek nese obsah přímo */}
            {code.mode === 'static' && (
              <span className="whitespace-nowrap rounded-full bg-line px-2.5 py-0.5 text-xs font-medium text-muted">
                {texts.dashboard.mode.staticBadge}
              </span>
            )}
          </div>

          <div className="mt-1 text-sm text-muted">
            {texts.dashboard.typeNames[code.type as keyof typeof texts.dashboard.typeNames]} ·{' '}
            {/* Statický kód se neskenuje přes appku — počet skenů nemá smysl */}
            {code.mode === 'static' ? (
              <span title={texts.dashboard.mode.staticNoScans}>—</span>
            ) : (
              <span className="whitespace-nowrap">
                {code.scanCount} {scanLabel(code.scanCount)}
              </span>
            )}{' '}
            · {new Date(code.createdAt).toLocaleDateString('cs-CZ')}
          </div>

          {/* URL + kopírování — na mobilu zkráceně, celá se ukáže po rozbalení */}
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-line/40 px-2 py-1 text-xs text-muted sm:text-sm">
              /{code.hash}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-line/40"
            >
              {copied ? texts.dashboard.linkCopied : texts.dashboard.copyLink}
            </button>
          </div>
        </div>
      </div>

      {/* Akce — mřížka tlačítek, na mobilu i desktopu stejně přehledná */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        <Link href={`/dashboard/${code.id}`} className={`${actionClass} text-center`}>
          {texts.dashboard.edit}
        </Link>
        <a href={`/api/qr/${code.id}/download?format=png`} className={`${actionClass} text-center`}>
          {texts.dashboard.downloadPng}
        </a>
        <a href={`/api/qr/${code.id}/download?format=svg`} className={`${actionClass} text-center`}>
          {texts.dashboard.downloadSvg}
        </a>
        {/* Statický kód nemá co pozastavit — obraz nese obsah přímo */}
        {code.mode === 'dynamic' && !code.adminBlocked && (
          <button
            type="button"
            onClick={() => {
              setIsActive(!isActive);
              patch({ isActive: !isActive });
            }}
            disabled={busy}
            className={`${actionClass} col-span-3 text-center sm:col-span-1`}
          >
            {isActive ? texts.dashboard.pause : texts.dashboard.resume}
          </button>
        )}
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className={`${actionClass} col-span-3 border-red-200 text-center text-red-600 hover:bg-red-50 sm:col-span-1 sm:ml-auto`}
          >
            {texts.dashboard.delete}
          </button>
        ) : (
          <div className="col-span-3 flex items-center justify-end gap-2 rounded-md bg-red-50 px-3 py-2">
            <span className="text-xs text-red-800">{texts.dashboard.deleteConfirmTitle}</span>
            <button
              type="button"
              onClick={remove}
              className="whitespace-nowrap rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
            >
              {texts.dashboard.deleteConfirmSubmit}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="whitespace-nowrap rounded bg-white px-2.5 py-1 text-xs font-medium"
            >
              {texts.dashboard.deleteConfirmCancel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
