import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { QrCard } from '@/components/qr-card';
import { DashboardRefresher } from '@/components/dashboard-refresher';
import { texts } from '@/lib/i18n/cs';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) return null;

  const codes = await prisma.qrCode.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { scans: true } } },
  });

  return (
    <div>
      <DashboardRefresher />
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold tracking-tight">{texts.dashboard.title}</h1>
        <Link
          href="/dashboard/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {texts.dashboard.newCode}
        </Link>
      </div>

      {!user.emailVerifiedAt && (
        <div className="mt-6 rounded-lg border border-accent/40 bg-accent/5 p-5">
          <h2 className="font-heading font-semibold">{texts.dashboard.verifyFirstTitle}</h2>
          <p className="mt-1 text-sm text-muted">{texts.dashboard.verifyFirstBody}</p>
        </div>
      )}

      {codes.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center">
          <h2 className="font-heading text-xl font-semibold">{texts.dashboard.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{texts.dashboard.emptyBody}</p>
          <Link
            href="/dashboard/new"
            className="mt-6 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            {texts.dashboard.createFirst}
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {codes.map((code) => (
            <QrCard
              key={code.id}
              code={{
                id: code.id,
                hash: code.hash,
                name: code.name,
                type: code.type,
                isActive: code.isActive,
                adminBlocked: code.adminBlocked,
                createdAt: code.createdAt.toISOString(),
                scanCount: code._count.scans,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
