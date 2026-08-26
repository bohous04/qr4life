import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { AdminRow } from '@/components/admin-row';
import { texts } from '@/lib/i18n/cs';

export const metadata = { title: texts.admin.title };

export default async function AdminPage() {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect('/login');
  if (user.role !== 'admin') {
    return <p className="text-muted">{texts.admin.notAdmin}</p>;
  }

  const codes = await prisma.qrCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
  });

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">{texts.admin.title}</h1>
      <p className="mt-2 text-sm text-muted">{texts.admin.subtitle}</p>

      {codes.length === 0 ? (
        <p className="mt-10 text-muted">{texts.admin.empty}</p>
      ) : (
        <div className="mt-8 space-y-3">
          {codes.map((code) => (
            <AdminRow
              key={code.id}
              code={{
                id: code.id,
                hash: code.hash,
                name: code.name,
                type: code.type,
                isActive: code.isActive,
                adminBlocked: code.adminBlocked,
                blockedReason: code.blockedReason,
                ownerEmail: code.user.email,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
