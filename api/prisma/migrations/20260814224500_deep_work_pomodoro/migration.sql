ALTER TABLE "DeepWorkSession"
ADD COLUMN "timerMode" TEXT NOT NULL DEFAULT 'countdown',
ADD COLUMN "focusMinutes" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN "shortBreakMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "longBreakMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "totalRounds" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "currentRound" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "currentPhase" TEXT NOT NULL DEFAULT 'focus',
ADD COLUMN "phaseStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "phaseEndsAt" TIMESTAMP(3),
ADD COLUMN "pausedAt" TIMESTAMP(3),
ADD COLUMN "pausedRemainingSeconds" INTEGER,
ADD COLUMN "ambientSound" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "ambientVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.35;

ALTER TABLE "FocusIntervention"
ADD COLUMN "resolution" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3);

ALTER TABLE "DistractionBlockEvent"
ADD COLUMN "deepWorkId" TEXT;

CREATE INDEX "DistractionBlockEvent_deepWorkId_occurredAt_idx"
ON "DistractionBlockEvent"("deepWorkId", "occurredAt");

UPDATE "DeepWorkSession"
SET
  "focusMinutes" = "plannedMinutes",
  "phaseStartedAt" = "startedAt",
  "phaseEndsAt" = CASE
    WHEN "status" = 'active' THEN "startedAt" + ("plannedMinutes" * INTERVAL '1 minute')
    ELSE "endedAt"
  END;

CREATE TABLE "DeepWorkPhase" (
  "id" TEXT NOT NULL,
  "deepWorkId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "round" INTEGER NOT NULL,
  "plannedSeconds" INTEGER NOT NULL,
  "actualSeconds" INTEGER NOT NULL DEFAULT 0,
  "pausedSeconds" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "DeepWorkPhase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeepWorkPhase_deepWorkId_startedAt_idx" ON "DeepWorkPhase"("deepWorkId", "startedAt");
CREATE INDEX "DeepWorkPhase_deepWorkId_round_type_idx" ON "DeepWorkPhase"("deepWorkId", "round", "type");

ALTER TABLE "DeepWorkPhase"
ADD CONSTRAINT "DeepWorkPhase_deepWorkId_fkey"
FOREIGN KEY ("deepWorkId") REFERENCES "DeepWorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
