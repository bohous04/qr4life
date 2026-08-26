import { prisma } from '@/lib/db';

/** Smaže všechna data před každým testem (pořadí respektuje cizí klíče). */
export async function resetDb(): Promise<void> {
  await prisma.scan.deleteMany();
  await prisma.qrCode.deleteMany();
  await prisma.token.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}
