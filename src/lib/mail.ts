import nodemailer from 'nodemailer';

/**
 * Odeslání e-mailu přes vlastní SMTP. Bez nastaveného SMTP_HOST
 * se obsah vypíše do konzole (dev režim bez e-mailů).
 */
export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(`[mail:dev] to=${options.to} subject=${options.subject}\n${options.text}`);
    return;
  }
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false, // 587 + STARTTLS
    requireTLS: true,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: options.to,
    subject: options.subject,
    text: options.text,
  });
}
