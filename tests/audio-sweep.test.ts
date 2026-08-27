import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { sweepOrphanTracks } from '@/lib/audio/sweep';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('sweepOrphanTracks', () => {
  it('smaže jen staré stopy bez kódu', async () => {
    const user = await prisma.user.create({
      data: { email: `sweep-${Date.now()}@example.com` },
    });
    const old = await prisma.audioTrack.create({
      data: {
        userId: user.id,
        filename: 'stara.mp3',
        mime: 'audio/mpeg',
        size: 1,
        data: Buffer.from([1]),
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    });
    const fresh = await prisma.audioTrack.create({
      data: {
        userId: user.id,
        filename: 'cerstva.mp3',
        mime: 'audio/mpeg',
        size: 1,
        data: Buffer.from([1]),
      },
    });

    const deleted = await sweepOrphanTracks();
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await prisma.audioTrack.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.audioTrack.findUnique({ where: { id: fresh.id } })).not.toBeNull();

    await prisma.user.delete({ where: { id: user.id } });
  });
});
