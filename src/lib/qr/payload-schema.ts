import { z } from 'zod';

/**
 * Payload každého typu QR kódu. Validace Zod schématem podle typu —
 * data žijí v JSONB, struktura je tu.
 */

/** Povolená http/https URL (ostatní schémata mají vlastní typy kódu). */
const httpUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((raw) => {
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL musí začínat http:// nebo https://');

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,20}$/, 'Neplatné telefonní číslo');

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === '' ? undefined : v));

const urlPayload = z.object({ url: httpUrl }).strict();

const wifiPayload = z
  .object({
    ssid: z.string().trim().min(1).max(32),
    // Prázdné heslo = otevřená síť (null).
    password: z
      .union([z.string().min(8).max(63), z.literal('')])
      .transform((v) => (v === '' ? null : v)),
    hidden: z.boolean(),
  })
  .strip();

const vcardPayload = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: optionalTrimmed(100),
    org: optionalTrimmed(100),
    title: optionalTrimmed(100),
    phone,
    email: z.email().optional(),
    url: httpUrl.optional(),
  })
  .strip();

const phonePayload = z.object({ number: phone }).strict();

const smsPayload = z
  .object({
    number: phone,
    body: optionalTrimmed(500),
  })
  .strip();

const emailPayload = z
  .object({
    to: z.email(),
    subject: optionalTrimmed(200),
    body: optionalTrimmed(2000),
  })
  .strip();

const textPayload = z.object({ text: z.string().trim().min(1).max(2000) }).strict();

export type QrPayloadMap = {
  url: z.infer<typeof urlPayload>;
  wifi: z.infer<typeof wifiPayload>;
  vcard: z.infer<typeof vcardPayload>;
  phone: z.infer<typeof phonePayload>;
  sms: z.infer<typeof smsPayload>;
  email: z.infer<typeof emailPayload>;
  text: z.infer<typeof textPayload>;
};

export type QrPayloadType = keyof QrPayloadMap;

const schemas: { [T in QrPayloadType]: z.ZodType<QrPayloadMap[T]> } = {
  url: urlPayload,
  wifi: wifiPayload,
  vcard: vcardPayload,
  phone: phonePayload,
  sms: smsPayload,
  email: emailPayload,
  text: textPayload,
};

/** Parsuje a validuje payload podle typu. Vrací null při nevalidním vstupu. */
export function payloadSchema<T extends QrPayloadType>(
  type: T,
  data: unknown,
): QrPayloadMap[T] | null {
  const schema = schemas[type];
  if (!schema) return null;
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
