# Samaritan Tracker - Master Implementation Plan

> **Goal:** Recreate Rize-like automatic time-tracking with calendar events, project
> progress tracking, and simplified focus metrics.
>
> **Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, Prisma 6 + PostgreSQL, Electron.

---

## 1. Current State

### Completed
- Phase 0: Intelligence-layer cleanup (removed redundant metrics)
- Phase 1: Prisma schema + migration (Project, ProjectRule, CalendarEvent, ProjectTime, Goal, Rating)
- Phase 2: Backend API routes (projects, calendar, goals, ratings)
- Phase 3: Frontend pages (projects, calendar, goals)
- Phase 4: Desktop integration (auto-tag activities, calendar sync, project time cron)

### Remaining
- Phase 5: Testing, build, polish

---

## 2. Phase 0 - Intelligence-Layer Cleanup

**Goal:** Remove redundant intelligence metrics and consolidate into Focus.

### Dashboard Changes
- Delete dashboard/app/intelligence/page.tsx
- Delete dashboard/components/intelligence/ folder
- Move Deep Work components to dashboard/components/focus/
- Remove IntelligencePanel.tsx, PeakWindow.tsx
- Remove intelligence tab from analytics page
- Remove IntelligenceResponse type and state
- Remove unused imports (Sparkles, RadarChart, PolarGrid, etc.)
- Verify npm run build passes

### API Changes
- Remove /intelligence route from api/src/routes/analytics.ts
- Remove unused intelligenceService imports
- Keep getDashboard, getDailySummary, getBurnoutRisk, getDailyFocusTrend, getAssistantInsights
- Verify npx tsc --noEmit passes

### Result
- Dashboard routes: /, /analytics, /focus, /heatmap (no /intelligence)
- Build passes, no TypeScript errors
- Dead code removed

---

## 3. Phase 1 - Schema & Migration

**Goal:** Add Rize-like data models for projects, calendar events, goals, and ratings.

### New Models

model Project {
  id            String    @id @default(uuid())
  userId        String
  name          String
  icon          String?
  color         String    @default(#8b5cf6)
  weeklyHourGoal Float    @default(10)
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  rules         ProjectRule[]
  time          ProjectTime[]
  goals         Goal[]
  events        CalendarEvent[]
}

model ProjectRule {
  id           String  @id @default(uuid())
  projectId    String
  appName      String?
  domain       String?
  titleKeyword String?
  matchType    String  @default(exact)
  @@unique([projectId, appName, domain, titleKeyword])
}

model CalendarEvent {
  id         String   @id @default(uuid())
  userId     String
  title      String
  startAt    DateTime
  endAt      DateTime
  allDay     Boolean  @default(false)
  color      String?
  source     String   @default(manual)
  projectId  String?
  deepWorkId String?
  notes      String?
}

model ProjectTime {
  id        String  @id @default(uuid())
  userId    String
  projectId String
  date      String
  minutes   Float   @default(0)
  @@unique([userId, projectId, date])
}

model Goal {
  id        String  @id @default(uuid())
  userId    String
  title     String
  type      String  @default(focus_minutes)
  target    Float
  period    String  @default(daily)
  projectId String?
  active    Boolean @default(true)
}

model Rating {
  id         String   @id @default(uuid())
  userId     String
  timestamp  DateTime @default(now())
  rating     Int
  deepWorkId String?
}

### Migration
- Run npx prisma migrate dev --name add_projects_calendar_goals
- Regenerate client: npx prisma generate
- Verify tables in PostgreSQL

---

## 4. Phase 2 - Backend API Routes

**Goal:** Expose REST endpoints for Projects, Calendar Events, Goals, Ratings, and Rules.

### 4.1 Projects Router (api/src/routes/projects.ts)

GET    /api/projects?userId=...          - List user projects
POST   /api/projects                      - Create project
PATCH  /api/projects/:id                  - Update project
DELETE /api/projects/:id                   - Delete project

Fields: userId, name, icon, color, weeklyHourGoal

### 4.2 Project Rules Router (api/src/routes/projectRules.ts)

GET    /api/projects/:id/rules           - List rules for project
POST   /api/projects/:id/rules           - Add rule
DELETE /api/projects/:id/rules/:ruleId    - Delete rule

Rule fields: appName, domain, titleKeyword, matchType

### 4.3 Calendar Router (api/src/routes/calendar.ts)

GET    /api/calendar?userId=...&from=...&to=... - List events
POST   /api/calendar                              - Create event
PATCH  /api/calendar/:id                          - Update event
DELETE /api/calendar/:id                           - Delete event

Event fields: userId, title, startAt, endAt, allDay, color, source, projectId, deepWorkId, notes

### 4.4 Goals Router (api/src/routes/goals.ts)

GET    /api/goals?userId=...&period=...   - List goals
POST   /api/goals                          - Create goal
PATCH  /api/goals/:id                      - Update goal
DELETE /api/goals/:id                       - Delete goal

Goal fields: userId, title, type, target, period, projectId

### 4.5 Ratings Router (api/src/routes/ratings.ts)

POST   /api/ratings                         - Save rating
GET    /api/ratings?userId=...&from=...&to=... - List ratings

### 4.6 Activity Auto-Tagging Service

File: api/src/services/projectTagger.ts (new)

- Fetch all active project rules for user
- Match activity (appName, domain, titleKeyword) against rules
- Return best matching projectId + confidence score
- Called from activityService.ts when activities are created

### 4.7 Project Time Aggregation Service

File: api/src/services/projectTimeService.ts (new)

- Fetch all productive/neutral activities for a date
- Group by projectId
- Upsert into ProjectTime table

### 4.8 Route Registration

File: api/src/app.ts

app.use(/api/projects, projectsRouter)
app.use(/api/projects, projectRulesRouter)
app.use(/api/calendar, calendarRouter)
app.use(/api/goals, goalsRouter)
app.use(/api/ratings, ratingsRouter)

---

## 5. Phase 3 - Frontend Pages & Components

**Goal:** Build new dashboard pages for Projects, Calendar, and Goals.

### 5.1 Projects Page

File: dashboard/app/projects/page.tsx (new)

Features:
- Grid of project cards
- Create/edit/delete projects via modal
- Show weekly hour goal, event count, time entries
- Navigate to project detail (rules)

UI:
- Header: title + New Project button
- Grid: 1/2/3 columns responsive
- Card: icon, name, goals count, stats, edit/delete actions
- Modal: form with name, icon (emoji), color picker, weekly goal

### 5.2 Calendar Page

File: dashboard/app/calendar/page.tsx (new)

Features:
- Month grid view
- Show events as colored pills
- Create/delete events
- Link events to projects and deep work sessions
- Navigate months

UI:
- Header: month/year, prev/next buttons, New Event button
- Grid: 7 columns (days of week)
- Day cell: date number, event pills (max 3 shown + more indicator)
- Modal: form with title, start/end datetime, all-day toggle, project selector, color, notes

### 5.3 Goals Page

File: dashboard/app/goals/page.tsx (new)

Features:
- List active goals
- Show target, period, linked project
- Create/delete goals

UI:
- Header: title + New Goal button
- Grid: goal cards with icon, title, target value, period, project link
- Modal: form with title, type (focus_minutes, hours, sessions), target, period (daily/weekly), project selector

### 5.4 Navigation Update

File: dashboard/components/Sidebar.tsx

Add nav items:
- Projects -> /projects
- Calendar -> /calendar
- Goals -> /goals

---

## 6. Phase 4 - Desktop Session Engine Integration

**Goal:** Wire the Electron desktop session engine to automatically tag activities to projects.

### 6.1 Activity Tagging on Log

File: api/src/services/sessionService.ts + api/src/services/activityService.ts

✅ Implemented server-side (centralized; covers both WS + HTTP ingress):
- Added `projectId` (optional FK → Project) to Activity model + migration `add_activity_project`
- In `createActivityFromTracker()`: calls `tagActivityToProject()` and persists `projectId`
- In `handleActivity()` (legacy /activity endpoint): same auto-tagging applied
- `projectTagger.ts` matches rules (appName=50, domain=30, titleKeyword=20) with confidence score

### 6.2 Calendar Sync

- [x] Add ICS import endpoint: POST /api/calendar/import (node-ical; supports ics string or url; skips past events; handles all-day + recurring)
- [x] Show calendar events in timeline view (GET /api/calendar/overlay + Timeline component overlay layer)
- [x] Calendar page: project selector, all-day toggle, delete events
- [x] Goals page: project selector in modal
- [ ] Support Google Calendar OAuth (optional, Phase 5)

### 6.3 Project Time Aggregation Cron

File: api/src/jobs/aggregateProjectTime.ts (new)

✅ Implemented with node-cron:
- Runs nightly at 2:00 AM IST (Asia/Kolkata timezone, noOverlap)
- Aggregates previous day's activities into ProjectTime for all users
- Registered in api/src/index.ts via `startProjectTimeAggregation()`
- `aggregateAllUsersProjectTime()` in projectTimeService.ts handles per-user aggregation
- Added `projectId` to Activity model — removed the `(act as any)` cast in projectTimeService.ts

---

## 7. Phase 5 - Testing, Build & Polish

### 7.1 Verification Checklist

- [x] api: npx tsc --noEmit -> 0 errors
- [x] dashboard: npm run build -> compiles, routes generated
- [x] All new API routes return 200 with test data
- [x] Projects CRUD works (create, read, update, archive, restore)
- [x] Calendar events display correctly in month, week, day, and agenda views
- [x] Goals dashboard renders live progress, pace, and history
- [x] Desktop session engine tags activities to projects
- [x] ProjectTime aggregation runs without errors
- [x] WebSocket updates propagate to dashboard

### 7.2 Build Commands

# API
cd d:\projects\tracker\api
npx prisma generate
npx prisma migrate dev
npx tsc --noEmit
npm run dev

# Dashboard
cd d:\projects\tracker\dashboard
npm run build
npm run start

### 7.3 Polish

- [x] Add loading skeletons for dashboard routes
- [x] Add recoverable route error boundary
- [x] Add empty states for projects/calendar/goals
- [ ] Responsive design check
- [ ] Color theme consistency
- [x] Accessibility for Projects and Goals navigation, filters, and selections

---

## 8. Open Questions / Decisions

| Question | Options | Status |
|----------|---------|--------|
| Calendar sync | Manual only, Google OAuth, both | TBD |
| Project time aggregation | Real-time, nightly batch, both | Batch (Phase 4) |
| Goal types | focus_minutes, hours, sessions, custom | Expandable via enum |
| Rating scale | 1-5 stars, 1-10 numeric, thumbs | 1-5 (simple) |
| Desktop->API auth | Token, session cookie, API key | TBD |

---

## Appendix: Key Files Reference

### API

api/
├── src/
│   ├── routes/
│   │   ├── projects.ts         # NEW
│   │   ├── projectRules.ts     # NEW
│   │   ├── calendar.ts         # NEW
│   │   ├── goals.ts            # NEW
│   │   └── ratings.ts          # NEW
│   ├── services/
│   │   ├── projectTagger.ts    # NEW
│   │   └── projectTimeService.ts # NEW
│   └── prisma/schema.prisma
└── .env

### Dashboard

dashboard/
├── app/
│   ├── page.tsx                 # Home
│   ├── analytics/page.tsx
│   ├── focus/page.tsx
│   ├── heatmap/page.tsx
│   ├── projects/page.tsx        # NEW
│   ├── calendar/page.tsx        # NEW
│   └── goals/page.tsx           # NEW
├── components/
│   ├── Sidebar.tsx
│   ├── MetricsPanel.tsx
│   ├── focus/                   # Deep Work components
│   └── ...
└── lib/
    ├── api.ts
    └── ws.ts

---

**Last updated:** 2026-08-14
**Status:** Phases 0-4 complete. Phase 5 verification and route-state polish complete; responsive visual QA remains.
