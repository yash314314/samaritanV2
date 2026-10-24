-- Patterns learned from a user's activity reviews belong to that user, so one
-- account's reviews cannot reclassify everyone else's activity. Existing rows
-- stay shared (NULL): the seeded set, plus anything learned before this change.

-- AlterTable
ALTER TABLE "AppPattern" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "AppPattern_userId_idx" ON "AppPattern"("userId");

-- AddForeignKey
ALTER TABLE "AppPattern" ADD CONSTRAINT "AppPattern_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
