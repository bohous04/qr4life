'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { texts } from '@/lib/i18n/cs';

export type QrTypeKey = 'url' | 'wifi' | 'vcard' | 'phone' | 'sms' | 'email' | 'text';

const TYPES: QrTypeKey[] = ['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text'];

type PayloadState = Record<string, string | boolean>;

const emptyPayload: Record<QrTypeKey, PayloadState> = {
  url: { url: '' },
  wifi: { ssid: '', password: '', hidden: false },
  vcard: { firstName: '', lastName: '', org: '', title: '', phone: '', email: '', url: '' },
  phone: { number: '' },
  sms: { number: '', body: '' },
  email: { to: '', subject: '', body: '' },
  text: { text: '' },
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
};

function buildPayload(type: QrTypeKey, state: PayloadState): unknown {
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
 * Kroky 1–3 průvodce novým kódem, nebo editační formulář (kdy je typeFixed).
 * Volající dostane {type, name, payload} k odeslání na API.
 */
export function QrTypeForm({
  mode,
  initialType,
  initialName,
  initialPayload,
  typeFixed,
  submitLabel,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initialType?: QrTypeKey;
  initialName?: string;
  initialPayload?: unknown;
  typeFixed?: boolean;
  submitLabel: string;
  onSubmit: (data: { type: QrTypeKey; name: string; payload: unknown }) => Promise<string | null>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(typeFixed ? (mode === 'edit' ? 3 : 2) : 1);
  const [type, setType] = useState<QrTypeKey | null>(initialType ?? null);
  const [payload, setPayload] = useState<PayloadState>(
    () => ({ ...emptyPayload[initialType ?? 'url'], ...(initialPayload as PayloadState | undefined) }),
  );
  const [name, setName] = useState(initialName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeType = type ?? 'url';
  const fields = FIELDS_BY_TYPE[activeType];

  function pickType(next: QrTypeKey) {
    setType(next);
    setPayload({ ...emptyPayload[next] });
    setStep(2);
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
      payload: buildPayload(activeType, payload),
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
      {!typeFixed && (
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-sm text-muted hover:underline"
        >
          ← {texts.dashboard.step.type}: {texts.dashboard.typeNames[activeType]}
        </button>
      )}

      {(step === 2 || (mode === 'edit' && typeFixed)) && (
        <>
          <h2 className="font-heading text-xl font-semibold">{texts.dashboard.step.data}</h2>
          {mode === 'edit' && typeFixed && (
            <p className="rounded-md bg-line/40 px-3 py-2 text-sm text-muted">
              {texts.dashboard.editPage.changeTypeWarning}
            </p>
          )}
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
