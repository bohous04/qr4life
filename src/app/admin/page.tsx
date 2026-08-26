import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { AdminRow } from '@/components/admin-row';
import { texts } from '@/lib/i18n/cs';

export const metadata = { title: texts.admin.title };

const TYPES = ['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text'] as const;
const STATUSES = ['active', 'paused', 'blocked'] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string }>;
}) {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect('/login');
  if (user.role !== 'admin') {
    return <p className="text-muted">{texts.admin.notAdmin}</p>;
  }

  const { type, status, q } = await searchParams;

  const codes = await prisma.qrCode.findMany({
    where: {
      ...(type && TYPES.includes(type as (typeof TYPES)[number])
        ? { type: type as (typeof TYPES)[number] }
        : {}),
      ...(status === 'active' ? { adminBlocked: false, isActive: true } : {}),
      ...(status === 'paused' ? { adminBlocked: false, isActive: false } : {}),
      ...(status === 'blocked' ? { adminBlocked: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { hash: { contains: q, mode: 'insensitive' as const } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
  });

  const logs = await prisma.errorLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const filterClass =
    'rounded-md border border-line bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none';

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">{texts.admin.title}</h1>
      <p className="mt-2 text-sm text-muted">{texts.admin.subtitle}</p>

      {/* Filtry */}
      <form method="get" className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder={texts.admin.searchPlaceholder}
          className={`${filterClass} min-w-0 flex-1 sm:max-w-xs`}
        />
        <select name="type" defaultValue={type ?? ''} className={filterClass}>
          <option value="">{texts.admin.filterAll}</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {texts.dashboard.typeNames[t]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ''} className={filterClass}>
          <option value="">{texts.admin.filterStatusAll}</option>
          <option value="active">{texts.dashboard.active}</option>
          <option value="paused">{texts.dashboard.paused}</option>
          <option value="blocked">{texts.dashboard.blocked}</option>
        </select>
        <button
          type="submit"
          className="whitespace-nowrap rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          {texts.admin.filterSubmit}
        </button>
      </form>

      {codes.length === 0 ? (
        <p className="mt-10 text-muted">{texts.admin.empty}</p>
      ) : (
        <div className="mt-6 space-y-3">
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

      {/* Logy chyb */}
      <h2 className="mt-14 font-heading text-2xl font-bold tracking-tight">{texts.admin.logsTitle}</h2>
      {logs.length === 0 ? (
        <p className="mt-4 text-muted">{texts.admin.logsEmpty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">{texts.admin.logsWhen}</th>
                <th className="px-4 py-2.5">{texts.admin.logsMessage}</th>
                <th className="px-4 py-2.5">{texts.admin.logsContext}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {new Date(log.createdAt).toLocaleString('cs-CZ')}
                  </td>
                  <td className="px-4 py-2.5">{log.message}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{log.context}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
