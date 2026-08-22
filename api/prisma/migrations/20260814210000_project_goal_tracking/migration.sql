ALTER TABLE "Project"
ADD COLUMN "description" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "DeepWorkSession"
ADD COLUMN "projectId" TEXT;

ALTER TABLE "Goal"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "GoalProgress" (
  "id" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "target" DOUBLE PRECISION NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoalProgress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeepWorkSession_userId_startedAt_idx" ON "DeepWorkSession"("userId", "startedAt");
CREATE INDEX "DeepWorkSession_projectId_startedAt_idx" ON "DeepWorkSession"("projectId", "startedAt");
CREATE UNIQUE INDEX "GoalProgress_goalId_periodStart_key" ON "GoalProgress"("goalId", "periodStart");
CREATE INDEX "GoalProgress_goalId_periodStart_idx" ON "GoalProgress"("goalId", "periodStart");
CREATE INDEX "GoalProgress_completed_periodEnd_idx" ON "GoalProgress"("completed", "periodEnd");

ALTER TABLE "DeepWorkSession"
ADD CONSTRAINT "DeepWorkSession_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GoalProgress"
ADD CONSTRAINT "GoalProgress_goalId_fkey"
FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
