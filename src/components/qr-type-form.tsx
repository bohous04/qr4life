'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';
import { AudioUpload, type AudioValue } from '@/components/audio-upload';

export type QrTypeKey = 'url' | 'wifi' | 'vcard' | 'phone' | 'sms' | 'email' | 'text' | 'audio';

const TYPES: QrTypeKey[] = ['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text', 'audio'];

// Typy, které umí i statický režim (obsah zapečený přímo v obrázku).
// Nejde o import z lib/qr/static-content.ts — ten by do klientského
// bundlu natáhl Zod a serverové moduly.
const STATIC_CAPABLE: QrTypeKey[] = ['wifi', 'vcard', 'phone', 'sms', 'email', 'text'];

function isStaticCapable(type: QrTypeKey): boolean {
  return STATIC_CAPABLE.includes(type);
}

type PayloadState = Record<string, string | boolean>;

const emptyPayload: Record<QrTypeKey, PayloadState> = {
  url: { url: '' },
  wifi: { ssid: '', password: '', hidden: false },
  vcard: { firstName: '', lastName: '', org: '', title: '', phone: '', email: '', url: '' },
  phone: { number: '' },
  sms: { number: '', body: '' },
  email: { to: '', subject: '', body: '' },
  text: { text: '' },
  audio: { trackId: '' },
};

const fieldLabels: Record<string, string> = {
  url: texts.dashboard.fields.url,
  ssid: texts.dashboard.fields.ssid,
  password: texts.dashboard.fields.wifiPassword,
  hidden: texts.dashboard.fields.hidden,
  firstName: texts.dashboard.fields.firstName,
  lastName: texts.dashboard.fields.lastName,
  org: texts.dashboard.fields.org,
  title: texts.dashboard.fields.title,
  phone: texts.dashboard.fields.phone,
  email: texts.dashboard.fields.email,
  subject: texts.dashboard.fields.emailSubject,
  body: texts.dashboard.fields.smsBody,
  text: texts.dashboard.fields.textContent,
  to: texts.dashboard.fields.email,
};

const FIELDS_BY_TYPE: Record<QrTypeKey, { key: string; type: 'text' | 'email' | 'tel' | 'checkbox' | 'textarea' | 'url'; optional?: boolean }[]> = {
  url: [{ key: 'url', type: 'url' }],
  wifi: [
    { key: 'ssid', type: 'text' },
    { key: 'password', type: 'text', optional: true },
    { key: 'hidden', type: 'checkbox', optional: true },
  ],
  vcard: [
    { key: 'firstName', type: 'text' },
    { key: 'lastName', type: 'text', optional: true },
    { key: 'org', type: 'text', optional: true },
    { key: 'title', type: 'text', optional: true },
    { key: 'phone', type: 'tel' },
    { key: 'email', type: 'email', optional: true },
    { key: 'url', type: 'url', optional: true },
  ],
  phone: [{ key: 'number', type: 'tel' }],
  sms: [
    { key: 'number', type: 'tel' },
    { key: 'body', type: 'textarea', optional: true },
  ],
  email: [
    { key: 'to', type: 'email' },
    { key: 'subject', type: 'text', optional: true },
    { key: 'body', type: 'textarea', optional: true },
  ],
  text: [{ key: 'text', type: 'textarea' }],
  audio: [],
};

function buildPayload(type: QrTypeKey, state: PayloadState, audio: AudioValue | null): unknown {
  if (type === 'audio') {
    // Vlastní titulek zvukového kódu nemá pole ve formuláři — název kódu
    // (state name) už tuhle roli plní, druhé pole by bylo duplicitní.
    return { trackId: audio?.trackId ?? '' };
  }
  if (type === 'wifi') {
    return {
      ssid: state.ssid,
      password: state.password === '' ? null : state.password,
      hidden: state.hidden === true,
    };
  }
  if (type === 'vcard') {
    return {
      firstName: state.firstName,
      ...(state.lastName ? { lastName: state.lastName } : {}),
      ...(state.org ? { org: state.org } : {}),
      ...(state.title ? { title: state.title } : {}),
      phone: state.phone,
      ...(state.email ? { email: state.email } : {}),
      ...(state.url ? { url: state.url } : {}),
    };
  }
  if (type === 'sms') {
    return { number: state.number, ...(state.body ? { body: state.body } : {}) };
  }
  if (type === 'email') {
    return { to: state.to, ...(state.subject ? { subject: state.subject } : {}), ...(state.body ? { body: state.body } : {}) };
  }
  return state;
}

/**
 * Kroky 1–3 průvodce novým kódem, nebo editační formulář
 * (v editaci lze typ změnit — obsah se přepíše, hash zůstává).
 * Volající dostane {type, name, payload} k odeslání na API.
 */
export function QrTypeForm({
  mode,
  initialType,
  initialName,
  initialPayload,
  initialQrMode,
  initialAudio,
  submitLabel,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initialType?: QrTypeKey;
  initialName?: string;
  initialPayload?: unknown;
  initialQrMode?: 'dynamic' | 'static';
  initialAudio?: AudioValue | null;
  submitLabel: string;
  onSubmit: (data: {
    type: QrTypeKey;
    name: string;
    payload: unknown;
    qrMode: 'dynamic' | 'static';
  }) => Promise<string | null>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(mode === 'edit' ? 2 : 1);
  const [type, setType] = useState<QrTypeKey>(initialType ?? 'url');
  const [payload, setPayload] = useState<PayloadState>(
    () => ({ ...emptyPayload[initialType ?? 'url'], ...(initialPayload as PayloadState | undefined) }),
  );
  const [name, setName] = useState(initialName ?? '');
  const [qrMode, setQrMode] = useState<'dynamic' | 'static'>(initialQrMode ?? 'dynamic');
  const [audio, setAudio] = useState<AudioValue | null>(initialAudio ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeType = type;
  const fields = FIELDS_BY_TYPE[activeType];

  function pickType(next: QrTypeKey) {
    setType(next);
    setPayload({ ...emptyPayload[next] });
    setStep(2);
  }

  function changeTypeEdit(next: QrTypeKey) {
    setType(next);
    setPayload({ ...emptyPayload[next] });
  }

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!name.trim()) {
      setError(texts.dashboard.name.required);
      return;
    }
    setBusy(true);
    setError(null);
    const apiError = await onSubmit({
      type: activeType,
      name: name.trim(),
      payload: buildPayload(activeType, payload, audio),
      qrMode: isStaticCapable(activeType) ? qrMode : 'dynamic',
    });
    if (apiError) setError(apiError);
    setBusy(false);
  }

  function renderField(field: (typeof fields)[number]) {
    const label = fieldLabels[field.key] ?? field.key;
    if (field.type === 'checkbox') {
      return (
        <label key={field.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={payload[field.key] === true}
            onChange={(e) => setPayload({ ...payload, [field.key]: e.target.checked })}
          />
          {label}
        </label>
      );
    }
    if (field.type === 'textarea') {
      return (
        <div key={field.key}>
          <label className="text-sm font-medium">
            {label}
            {!field.optional && ' *'}
          </label>
          <textarea
            required={!field.optional}
            rows={3}
            value={String(payload[field.key] ?? '')}
            onChange={(e) => setPayload({ ...payload, [field.key]: e.target.value })}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
          />
        </div>
      );
    }
    return (
      <div key={field.key}>
        <label className="text-sm font-medium">
          {label}
          {!field.optional && ' *'}
        </label>
        <input
          type={field.type}
          required={!field.optional}
          value={String(payload[field.key] ?? '')}
          onChange={(e) => setPayload({ ...payload, [field.key]: e.target.value })}
          className="mt-1 w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>
    );
  }

  if (step === 1) {
    return (
      <div>
        <h2 className="font-heading text-xl font-semibold">{texts.dashboard.new.pickType}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => pickType(t)}
              className="rounded-lg border border-line bg-white p-5 text-left hover:border-accent"
            >
              <div className="font-heading font-semibold">
                {texts.dashboard.typeNames[t]}
              </div>
              <div className="mt-1 text-sm text-muted">{texts.dashboard.typeDescriptions[t]}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      {mode === 'create' ? (
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-sm text-muted hover:underline"
        >
          ← {texts.dashboard.step.type}: {texts.dashboard.typeNames[activeType]}
        </button>
      ) : (
        <>
          {/* Editace: typ lze změnit — obsah se přepíše, hash zůstává */}
          <div>
            <label htmlFor="qr-type" className="text-sm font-medium">
              {texts.dashboard.editPage.typeLabel}
            </label>
            <select
              id="qr-type"
              value={activeType}
              onChange={(e) => changeTypeEdit(e.target.value as QrTypeKey)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 focus:border-accent focus:outline-none"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {texts.dashboard.typeNames[t]}
                </option>
              ))}
            </select>
            <p className="mt-1 rounded-md bg-line/40 px-3 py-2 text-sm text-muted">
              {texts.dashboard.editPage.changeTypeWarning}
            </p>
          </div>
        </>
      )}

      {isStaticCapable(activeType) && mode === 'create' && (
        <div>
          <span className="text-sm font-medium">{texts.dashboard.mode.label}</span>
          <div className="mt-1 flex gap-2">
            {(['dynamic', 'static'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setQrMode(option)}
                aria-pressed={qrMode === option}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  qrMode === option ? 'border-ink bg-ink text-white' : 'border-line hover:bg-line/40'
                }`}
              >
                {texts.dashboard.mode[option]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            {qrMode === 'static' ? texts.dashboard.mode.staticHint : texts.dashboard.mode.dynamicHint}
          </p>
        </div>
      )}

      {mode === 'edit' && initialQrMode === 'static' && (
        <p className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
          {texts.dashboard.mode.staticEditWarning}
        </p>
      )}

      {activeType === 'audio' && (step === 2 || mode === 'edit') && (
        <AudioUpload value={audio} onChange={setAudio} />
      )}

      {/* Nadpis dáváme jen tam, kde pod ním opravdu něco je — audio má
          vlastní blok (AudioUpload výše) a prázdný seznam polí. */}
      {(step === 2 || mode === 'edit') && fields.length > 0 && (
        <>
          <h2 className="font-heading text-xl font-semibold">{texts.dashboard.step.data}</h2>
          {fields.map(renderField)}
        </>
      )}

      <h2 className="font-heading text-xl font-semibold">{texts.dashboard.step.name}</h2>
      <div>
        <label className="text-sm font-medium">{texts.dashboard.name.label} *</label>
        <input
          required
          value={name}
          placeholder={texts.dashboard.name.placeholder}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-6 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-md border border-line px-6 py-2.5 font-medium hover:bg-line/40"
        >
          {texts.common.cancel}
        </button>
      </div>
    </form>
  );
}
