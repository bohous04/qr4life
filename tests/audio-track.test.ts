import { describe, expect, it, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AudioTrack', () => {
  it('uloží binární data a smaže se s kódem', async () => {
    const user = await prisma.user.create({
      data: { email: `track-${Date.now()}@example.com`, emailVerifiedAt: new Date() },
    });
    const qr = await prisma.qrCode.create({
      data: {
        userId: user.id,
        hash: `t${Date.now().toString(36).slice(-6)}`,
        name: 'Stopa',
        type: 'audio',
        payload: { trackId: 'placeholder' },
      },
    });
    const track = await prisma.audioTrack.create({
      data: {
        userId: user.id,
        qrCodeId: qr.id,
        filename: 'song.mp3',
        mime: 'audio/mpeg',
        size: 3,
        data: Buffer.from([1, 2, 3]),
      },
    });

    const loaded = await prisma.audioTrack.findUniqueOrThrow({ where: { id: track.id } });
    expect(Buffer.from(loaded.data)).toEqual(Buffer.from([1, 2, 3]));

    await prisma.qrCode.delete({ where: { id: qr.id } });
    expect(await prisma.audioTrack.findUnique({ where: { id: track.id } })).toBeNull();

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('nový kód je defaultně dynamický', async () => {
    const user = await prisma.user.create({
      data: { email: `mode-${Date.now()}@example.com` },
    });
    const qr = await prisma.qrCode.create({
      data: {
        userId: user.id,
        hash: `m${Date.now().toString(36).slice(-6)}`,
        name: 'Kód',
        type: 'text',
        payload: { text: 'ahoj' },
      },
    });
    expect(qr.mode).toBe('dynamic');
    await prisma.user.delete({ where: { id: user.id } });
  });
});
