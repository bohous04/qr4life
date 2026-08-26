import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { EditQrForm } from '@/components/edit-qr-form';
import { texts } from '@/lib/i18n/cs';

export default async function EditCodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) return null;

  const qr = await prisma.qrCode.findUnique({ where: { id } });
  if (!qr || qr.userId !== user.id) notFound();

  return (
    <div>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/qr/${qr.id}/download?format=png&size=256`}
          alt={qr.name}
          width={96}
          height={96}
          className="h-24 w-24"
        />
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {texts.dashboard.editPage.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {qr.name} · <code>{qr.hash}</code> ·{' '}
            {texts.dashboard.typeNames[qr.type as keyof typeof texts.dashboard.typeNames]}
          </p>
          <Link href="/dashboard" className="text-sm text-accent hover:underline">
            ← {texts.dashboard.title}
          </Link>
        </div>
      </div>
      <div className="mt-8">
        <EditQrForm
          id={qr.id}
          initialType={qr.type}
          initialName={qr.name}
          initialPayload={qr.payload}
        />
      </div>
    </div>
  );
}
