ALTER TABLE "CalendarEvent"
  ADD COLUMN "calendarSourceId" TEXT,
  ADD COLUMN "attendeeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "attendeeStatus" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'synced',
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "CalendarConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "accountLabel" TEXT,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "syncCursor" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarSource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "providerCalendarId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "timezone" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "primary" BOOLEAN NOT NULL DEFAULT false,
  "syncCursor" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarTrackingSettings" (
  "userId" TEXT NOT NULL,
  "meetingKeyword" TEXT NOT NULL DEFAULT '#rize-meeting',
  "focusKeyword" TEXT NOT NULL DEFAULT '#rize-focus',
  "breakKeyword" TEXT NOT NULL DEFAULT '#rize-break',
  "attendeeThreshold" INTEGER NOT NULL DEFAULT 2,
  "offlineMeetingCreation" BOOLEAN NOT NULL DEFAULT true,
  "offlineMeetingMinutes" INTEGER NOT NULL DEFAULT 10,
  "confirmationThresholdSeconds" INTEGER NOT NULL DEFAULT 60,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarTrackingSettings_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "CalendarSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "calendarEventId" TEXT,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "title" TEXT NOT NULL,
  "scheduledStart" TIMESTAMP(3),
  "scheduledEnd" TIMESTAMP(3),
  "actualStart" TIMESTAMP(3),
  "actualEnd" TIMESTAMP(3),
  "actualDurationMs" INTEGER NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "projectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingEvidence" (
  "id" TEXT NOT NULL,
  "calendarSessionId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "signalType" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalendarEvent_calendarSourceId_idx" ON "CalendarEvent"("calendarSourceId");
CREATE UNIQUE INDEX "CalendarEvent_calendarSourceId_externalId_key" ON "CalendarEvent"("calendarSourceId", "externalId");
CREATE INDEX "CalendarConnection_userId_idx" ON "CalendarConnection"("userId");
CREATE UNIQUE INDEX "CalendarConnection_userId_provider_accountLabel_key" ON "CalendarConnection"("userId", "provider", "accountLabel");
CREATE INDEX "CalendarSource_userId_idx" ON "CalendarSource"("userId");
CREATE UNIQUE INDEX "CalendarSource_connectionId_providerCalendarId_key" ON "CalendarSource"("connectionId", "providerCalendarId");
CREATE INDEX "CalendarSession_userId_scheduledStart_idx" ON "CalendarSession"("userId", "scheduledStart");
CREATE INDEX "CalendarSession_userId_status_idx" ON "CalendarSession"("userId", "status");
CREATE INDEX "CalendarSession_actualStart_actualEnd_idx" ON "CalendarSession"("actualStart", "actualEnd");
CREATE UNIQUE INDEX "CalendarSession_calendarEventId_type_key" ON "CalendarSession"("calendarEventId", "type");
CREATE UNIQUE INDEX "MeetingEvidence_calendarSessionId_activityId_key" ON "MeetingEvidence"("calendarSessionId", "activityId");
CREATE INDEX "MeetingEvidence_calendarSessionId_startedAt_idx" ON "MeetingEvidence"("calendarSessionId", "startedAt");
CREATE INDEX "MeetingEvidence_activityId_idx" ON "MeetingEvidence"("activityId");

ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_calendarSourceId_fkey" FOREIGN KEY ("calendarSourceId") REFERENCES "CalendarSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarSource" ADD CONSTRAINT "CalendarSource_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarSession" ADD CONSTRAINT "CalendarSession_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarSession" ADD CONSTRAINT "CalendarSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingEvidence" ADD CONSTRAINT "MeetingEvidence_calendarSessionId_fkey" FOREIGN KEY ("calendarSessionId") REFERENCES "CalendarSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingEvidence" ADD CONSTRAINT "MeetingEvidence_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
