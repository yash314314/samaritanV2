-- CreateTable
CREATE TABLE "DeepWorkSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" TEXT,
    "plannedMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "enforcement" TEXT NOT NULL,
    "allowedApps" TEXT[],
    "allowedDomains" TEXT[],
    "blockedApps" TEXT[],
    "blockedDomains" TEXT[],
    "focusScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "interruptionMs" INTEGER NOT NULL DEFAULT 0,
    "productiveMs" INTEGER NOT NULL DEFAULT 0,
    "distractionMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeepWorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusIntervention" (
    "id" TEXT NOT NULL,
    "deepWorkId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "domain" TEXT,
    "windowTitle" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "FocusIntervention_pkey" PRIMARY KEY ("id")
);
