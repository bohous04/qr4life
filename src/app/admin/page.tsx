import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { AdminRow } from '@/components/admin-row';
import { texts } from '@/lib/i18n/cs';

export const metadata = { title: texts.admin.title };

const TYPES = ['url', 'wifi', 'vcard', 'phone', 'sms', 'email', 'text'] as const;

function resultsLabel(count: number): string {
  if (count === 1) return texts.admin.resultsOne;
  if (count >= 2 && count <= 4) return texts.admin.resultsFew;
  return texts.admin.resultsMany;
}

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

  const where = {
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
  };

  const [codes, totalCodes, activeCount, pausedCount, blockedCount, userCount, scanCount, logs] =
    await Promise.all([
      prisma.qrCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true } },
          _count: { select: { scans: true } },
        },
      }),
      prisma.qrCode.count(),
      prisma.qrCode.count({ where: { adminBlocked: false, isActive: true } }),
      prisma.qrCode.count({ where: { adminBlocked: false, isActive: false } }),
      prisma.qrCode.count({ where: { adminBlocked: true } }),
      prisma.user.count(),
      prisma.scan.count(),
      prisma.errorLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);

  const stats = [
    { label: texts.admin.statsTotal, value: totalCodes, accent: false },
    { label: texts.admin.statsActive, value: activeCount, accent: false },
    { label: texts.admin.statsPaused, value: pausedCount, accent: false },
    { label: texts.admin.statsBlocked, value: blockedCount, accent: blockedCount > 0 },
    { label: texts.admin.statsUsers, value: userCount, accent: false },
    { label: texts.admin.statsScans, value: scanCount, accent: false },
  ];

  const filterClass =
    'rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none';

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">{texts.admin.title}</h1>
      <p className="mt-2 text-sm text-muted">{texts.admin.subtitle}</p>

      {/* Statistiky */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line bg-white p-4">
            <div
              className={`font-heading text-2xl font-bold ${stat.accent ? 'text-red-600' : ''}`}
            >
              {stat.value}
            </div>
            <div className="mt-0.5 text-xs text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

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
          className="whitespace-nowrap rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {texts.admin.filterSubmit}
        </button>
        <span className="text-sm text-muted">
          {codes.length} {resultsLabel(codes.length)}
        </span>
      </form>

      {codes.length === 0 ? (
        <p className="mt-10 text-muted">{texts.admin.empty}</p>
      ) : (
        <div className="mt-4 space-y-3">
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
                createdAt: code.createdAt.toISOString(),
                scanCount: code._count.scans,
              }}
            />
          ))}
        </div>
      )}

      {/* Logy chyb */}
      <h2 className="mt-14 font-heading text-2xl font-bold tracking-tight">{texts.admin.logsTitle}</h2>
      {logs.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line p-6 text-center text-muted">
          {texts.admin.logsEmpty}
        </p>
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
