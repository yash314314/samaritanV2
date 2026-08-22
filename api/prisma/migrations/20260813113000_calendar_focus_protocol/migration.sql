ALTER TABLE "CalendarEvent"
  ADD COLUMN "focusAutoStart" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "focusEnforcement" TEXT NOT NULL DEFAULT 'warn',
  ADD COLUMN "focusAllowedApps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "focusAllowedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "focusBlockedApps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "focusBlockedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
