-- CreateTable
CREATE TABLE "DistractionBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "normalizedTarget" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'during_focus',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistractionBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistractionBlockEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT,
    "targetType" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "domain" TEXT,
    "windowTitle" TEXT,
    "processId" INTEGER,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "deviceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistractionBlockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistractionBlock_userId_targetType_normalizedTarget_scope_key" ON "DistractionBlock"("userId", "targetType", "normalizedTarget", "scope");

-- CreateIndex
CREATE INDEX "DistractionBlock_userId_active_idx" ON "DistractionBlock"("userId", "active");

-- CreateIndex
CREATE INDEX "DistractionBlock_userId_scope_idx" ON "DistractionBlock"("userId", "scope");

-- CreateIndex
CREATE INDEX "DistractionBlockEvent_userId_occurredAt_idx" ON "DistractionBlockEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "DistractionBlockEvent_ruleId_occurredAt_idx" ON "DistractionBlockEvent"("ruleId", "occurredAt");

-- CreateIndex
CREATE INDEX "DistractionBlockEvent_userId_outcome_idx" ON "DistractionBlockEvent"("userId", "outcome");
