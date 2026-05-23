/*
  Warnings:

  - You are about to drop the column `timestamp` on the `Activity` table. All the data in the column will be lost.
  - Added the required column `duration` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endTime` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Activity` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Activity_timestamp_idx";

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "timestamp",
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "type" TEXT;

-- CreateIndex
CREATE INDEX "Activity_startTime_idx" ON "Activity"("startTime");
