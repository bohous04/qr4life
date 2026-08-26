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
}

function scanLabel(count: number): string {
  if (count === 1) return texts.dashboard.scanCountOne;
  if (count >= 2 && count <= 4) return texts.dashboard.scanCountFew;
  return texts.dashboard.scanCount;
}

/** Karta kódu v přehledu: náhled, název, toggle, download, mazání. */
export function QrCard({ code }: { code: QrCardData }) {
  const router = useRouter();
  const [name, setName] = useState(code.name);
  const [isActive, setIsActive] = useState(code.isActive);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${code.hash}`;

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

  return (
    <div className="flex gap-5 rounded-lg border border-line bg-white p-5">
      {/* Náhled — stejný endpoint jako download (spec §12) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/qr/${code.id}/download?format=png&size=256`}
        alt={`QR ${name}`}
        width={112}
        height={112}
        className="h-28 w-28 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
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
        </div>

        <div className="mt-1 flex items-center gap-2 text-sm text-muted">
          <code className="truncate">{publicUrl}</code>
          <button type="button" onClick={copyLink} className="shrink-0 text-accent hover:underline">
            {copied ? texts.dashboard.linkCopied : texts.dashboard.copyLink}
          </button>
        </div>

        <div className="mt-2 text-sm text-muted">
          {texts.dashboard.typeNames[code.type as keyof typeof texts.dashboard.typeNames]} ·{' '}
          {code.scanCount} {scanLabel(code.scanCount)} ·{' '}
          {new Date(code.createdAt).toLocaleDateString('cs-CZ')}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-red-600 hover:underline"
              disabled={busy}
            >
              {texts.dashboard.delete}
            </button>
          ) : (
            <span className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2">
              <span className="text-xs text-red-800">{texts.dashboard.deleteConfirmBody}</span>
              <button
                type="button"
                onClick={remove}
                className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white"
              >
                {texts.dashboard.deleteConfirmSubmit}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded bg-white px-2 py-1 text-xs font-medium"
              >
                {texts.dashboard.deleteConfirmCancel}
              </button>
            </span>
          )}
          <Link href={`/dashboard/${code.id}`} className="text-accent hover:underline">
            {texts.dashboard.edit}
          </Link>
          <a
            href={`/api/qr/${code.id}/download?format=png`}
            className="text-muted hover:underline"
          >
            {texts.dashboard.downloadPng}
          </a>
          <a
            href={`/api/qr/${code.id}/download?format=svg`}
            className="text-muted hover:underline"
          >
            {texts.dashboard.downloadSvg}
          </a>
          {!code.adminBlocked && (
            <button
              type="button"
              onClick={() => {
                setIsActive(!isActive);
                patch({ isActive: !isActive });
              }}
              disabled={busy}
              className="ml-auto text-muted hover:underline"
            >
              {isActive ? texts.dashboard.pause : texts.dashboard.resume}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
