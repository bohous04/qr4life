'use client';

import { useEffect, useRef, useState } from 'react';
import { texts } from '@/lib/i18n/cs';

export interface AudioValue {
  trackId: string;
  filename: string;
}

const uploadErrors: Record<string, string> = {
  too_large: texts.dashboard.audio.tooLarge,
  unsupported_type: texts.dashboard.audio.unsupported,
  track_limit: texts.dashboard.audio.limit,
};

/** Výběr souboru + okamžité nahrání na /api/audio; vrací id stopy. */
export function AudioUpload({
  value,
  onChange,
}: {
  value: AudioValue | null;
  onChange: (next: AudioValue | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Uvolní starou náhledovou URL při každé změně (nová stopa i unmount).
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/audio', { method: 'POST', body: form });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError((data.error && uploadErrors[data.error]) ?? texts.dashboard.audio.failed);
        // Náhrada selhala — pokud už existovala platná stopa, necháme ji být,
        // ať formulář neodešle prázdné trackId. Vyčistit smí jen to, co nikdy nebylo.
        if (!value) onChange(null);
        return;
      }
      const track = (await response.json()) as { id: string; filename: string };
      onChange({ trackId: track.id, filename: track.filename });
      setPreviewUrl(URL.createObjectURL(file));
    } catch {
      // Výpadek sítě apod. — ukázat chybu, ale zachovat poslední platnou stopu.
      setError(texts.dashboard.audio.failed);
      if (!value) onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="text-sm font-medium">{texts.dashboard.typeNames.audio} *</label>
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-line/40 disabled:opacity-50"
        >
          {busy
            ? texts.dashboard.audio.uploading
            : value
              ? texts.dashboard.audio.replace
              : texts.dashboard.audio.pick}
        </button>
        {value && <span className="truncate text-sm text-muted">{value.filename}</span>}
      </div>
      {previewUrl && <audio className="mt-3 w-full" controls src={previewUrl} />}
      <p className="mt-1 text-xs text-muted">{texts.dashboard.audio.hint}</p>
      {error && <p className="mt-1 text-sm text-accent">{error}</p>}
    </div>
  );
}
