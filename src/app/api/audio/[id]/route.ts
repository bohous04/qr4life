import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';

/**
 * Smazání dosud nenavázané zvukové stopy. Slouží formuláři k uvolnění
 * slotu (max. 20 stop na uživatele) při výměně souboru ještě před
 * vytvořením/uložením kódu — bez tohohle endpointu by staré nahrávky
 * zůstávaly jako sirotci až do sweepe (24 h).
 *
 * Podmínka `qrCodeId: null` je součástí `deleteMany` where klauzule, ne
 * samostatné kontroly předem — atomicky tak řeší i souběh, kdy se stopa
 * naváže na kód mezi kontrolou a smazáním. Stopu navázanou na kód nejde
 * smazat tudy vůbec: ta patří výhradně endpointům /api/qr (výměna nebo
 * smazání celého kódu), jinak by kód zůstal bez zvuku.
 *
 * Cizí, navázaná i neexistující stopa vrací stejné 404 — požadavek tak
 * nejde použít k ověření, čí stopa pod daným id je.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await prisma.audioTrack.deleteMany({
    where: { id, userId: user.id, qrCodeId: null },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
