-- CreateTable
CREATE TABLE "SmartBreakSettings" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "workThresholdMinutes" INTEGER NOT NULL DEFAULT 90,
    "breakDurationMinutes" INTEGER NOT NULL DEFAULT 10,
    "snoozeMinutes" INTEGER NOT NULL DEFAULT 15,
    "resetIdleMinutes" INTEGER NOT NULL DEFAULT 5,
    "workHoursOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartBreakSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SmartBreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "openKey" TEXT,
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "continuousWorkMs" INTEGER NOT NULL DEFAULT 0,
    "recommendedMinutes" INTEGER NOT NULL DEFAULT 10,
    "reason" TEXT NOT NULL,
    "calendarSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmartBreak_openKey_key" ON "SmartBreak"("openKey");

-- CreateIndex
CREATE INDEX "SmartBreak_userId_suggestedAt_idx" ON "SmartBreak"("userId", "suggestedAt");

-- CreateIndex
CREATE INDEX "SmartBreak_userId_status_idx" ON "SmartBreak"("userId", "status");

-- CreateIndex
CREATE INDEX "SmartBreak_dueAt_idx" ON "SmartBreak"("dueAt");
