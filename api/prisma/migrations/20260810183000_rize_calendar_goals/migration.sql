ALTER TABLE "CalendarEvent" ADD COLUMN "description" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "location" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE "CalendarEvent" ADD COLUMN "busy" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CalendarEvent" ADD COLUMN "recurrenceRule" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "reminderMinutes" INTEGER;
ALTER TABLE "CalendarEvent" ADD COLUMN "externalId" TEXT;

ALTER TABLE "Goal" ADD COLUMN "description" TEXT;
ALTER TABLE "Goal" ADD COLUMN "unit" TEXT;
ALTER TABLE "Goal" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Goal" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "Goal" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Goal" ADD COLUMN "progress" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Goal" ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "CalendarEvent_status_idx" ON "CalendarEvent"("status");
CREATE INDEX "CalendarEvent_externalId_idx" ON "CalendarEvent"("externalId");
CREATE INDEX "Goal_active_period_idx" ON "Goal"("active", "period");
