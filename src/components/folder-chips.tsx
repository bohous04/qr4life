'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';

export interface FolderItem {
  id: string;
  name: string;
}

/** Chipsy složek nad přehledem kódů: filtr + vytváření + mazání složky. */
export function FolderChips({
  folders,
  selected,
}: {
  folders: FolderItem[];
  selected: string; // 'all' | 'none' | folderId
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  function navigate(folder: string) {
    router.push(folder === 'all' ? '/dashboard' : `/dashboard?folder=${encodeURIComponent(folder)}`);
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (response.ok) {
        setName('');
        setCreating(false);
        router.refresh();
        const { id } = (await response.json()) as { id: string };
        navigate(id);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(folderId: string) {
    setBusy(true);
    try {
      await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      router.refresh();
      if (selected === folderId) navigate('all');
    } finally {
      setBusy(false);
    }
  }

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:bg-line/40'
    }`;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => navigate('all')} className={chip(selected === 'all')}>
        {texts.dashboard.folders.all}
      </button>
      <button type="button" onClick={() => navigate('none')} className={chip(selected === 'none')}>
        {texts.dashboard.folders.none}
      </button>
      {folders.map((f) => (
        <span key={f.id} className={`group inline-flex items-center ${chip(selected === f.id)} !px-1`}>
          <button type="button" onClick={() => navigate(f.id)} className="py-1.5 pl-3.5 pr-1">
            {f.name}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(texts.dashboard.folders.deleteConfirm)) remove(f.id);
            }}
            disabled={busy}
            aria-label={texts.dashboard.folders.delete}
            className="px-1.5 py-1.5 text-xs opacity-40 hover:opacity-100"
          >
            ✕
          </button>
        </span>
      ))}
      {creating ? (
        <span className="inline-flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder={texts.dashboard.folders.namePlaceholder}
            className="w-40 rounded-full border border-accent px-3 py-1.5 text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-white"
          >
            {texts.dashboard.folders.create}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="whitespace-nowrap rounded-full border border-dashed border-line px-3.5 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-accent"
        >
          + {texts.dashboard.folders.new}
        </button>
      )}
    </div>
  );
}
