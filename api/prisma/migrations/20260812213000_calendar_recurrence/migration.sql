ALTER TABLE "CalendarEvent"
  ADD COLUMN "recurrenceParentId" TEXT,
  ADD COLUMN "recurrenceOriginalStart" TIMESTAMP(3),
  ADD COLUMN "recurrenceException" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CalendarEvent_recurrenceParentId_idx" ON "CalendarEvent"("recurrenceParentId");
CREATE UNIQUE INDEX "CalendarEvent_recurrenceParentId_recurrenceOriginalStart_key"
  ON "CalendarEvent"("recurrenceParentId", "recurrenceOriginalStart");

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_recurrenceParentId_fkey"
  FOREIGN KEY ("recurrenceParentId") REFERENCES "CalendarEvent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
