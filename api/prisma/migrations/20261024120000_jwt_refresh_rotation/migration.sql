-- Refresh tokens become opaque, hashed and rotated. Rows written by the old
-- scheme hold raw signed tokens, so they are dropped: those sessions log in again.
DELETE FROM "RefreshToken";

-- DropIndex
DROP INDEX IF EXISTS "RefreshToken_token_idx";

-- AlterTable
ALTER TABLE "RefreshToken"
    ADD COLUMN "familyId" TEXT NOT NULL,
    ADD COLUMN "client" TEXT NOT NULL DEFAULT 'web',
    ADD COLUMN "deviceId" TEXT,
    ADD COLUMN "userAgent" TEXT,
    ADD COLUMN "createdByIp" TEXT,
    ADD COLUMN "lastUsedAt" TIMESTAMP(3),
    ADD COLUMN "revokedAt" TIMESTAMP(3),
    ADD COLUMN "revokedReason" TEXT,
    ADD COLUMN "replacedById" TEXT;

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- AlterTable
ALTER TABLE "User"
    ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastLoginAt" TIMESTAMP(3);
