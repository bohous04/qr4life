-- CreateEnum
CREATE TYPE "QrMode" AS ENUM ('dynamic', 'static');

-- AlterEnum
ALTER TYPE "QrType" ADD VALUE 'audio';

-- AlterTable
ALTER TABLE "QrCode" ADD COLUMN     "mode" "QrMode" NOT NULL DEFAULT 'dynamic';

-- CreateTable
CREATE TABLE "AudioTrack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qrCodeId" TEXT,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AudioTrack_qrCodeId_key" ON "AudioTrack"("qrCodeId");

-- CreateIndex
CREATE INDEX "AudioTrack_userId_idx" ON "AudioTrack"("userId");

-- CreateIndex
CREATE INDEX "AudioTrack_createdAt_idx" ON "AudioTrack"("createdAt");

-- AddForeignKey
ALTER TABLE "AudioTrack" ADD CONSTRAINT "AudioTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioTrack" ADD CONSTRAINT "AudioTrack_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
