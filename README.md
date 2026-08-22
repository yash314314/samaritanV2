# Samaritan Activity Tracker

Samaritan is a local-first desktop activity tracker and focus dashboard inspired by Rize. It observes the foreground Windows application, groups observations into sessions, classifies work by category and intent, calculates focus and productivity metrics, and streams changes to the dashboard in real time.

The project is intended for local development. It currently uses one fixed development user and has no authentication or production deployment configuration.

## What It Includes

- Automatic foreground application and window-title tracking
- Live current-app streaming over WebSocket
- Timeline, productivity heatmap, focus trends, category allocation, and interrupter analysis
- Weighted focus, productivity, entropy, burnout, and daily balance metrics
- Reviewable low-confidence classifications that can teach future app/title rules
- Projects with automatic app, domain, and title matching rules
- Calendar events, tracked-time overlays, goals, and progress updates
- Deep-work sessions with four enforcement levels
- Idle, lock-screen, suspend, and resume detection
- Per-minute deep-work logs and automatic session expiry

## System Architecture

Samaritan runs as four local pieces:

```text
Windows foreground application
          |
          v
Electron tracker (desktop/) ---- activity:current ----> WebSocket server
          |                                                |
          | activity:stream                                v
          +----------------------------------------> Express API (api/)
                                                           |
                                                           v
                                                     PostgreSQL
                                                           |
                      realtime events + HTTP analytics     |
          +------------------------------------------------+
          v
Next.js dashboard (dashboard/)
```

| Component | Purpose | Default address |
| --- | --- | --- |
| PostgreSQL 15 | Persistent users, sessions, activities, patterns, deep work, projects, calendar, and goals | `localhost:5432` |
| Express API | REST endpoints, analytics, classification, metrics, and background jobs | `http://localhost:4000` |
| WebSocket server | Desktop ingestion and live dashboard events | `ws://localhost:4000/ws` |
| Next.js dashboard | Main interface | `http://localhost:3000` |
| Electron tracker | Windows foreground observer and deep-work enforcement | Local desktop process |

## Prerequisites

- Windows 10 or Windows 11
- Node.js 20 or newer
- npm
- Docker Desktop with Docker Compose
- Permission to inspect foreground windows
- Permission to terminate applications if using deep-work `block` enforcement

The dashboard and API can run on other operating systems, but the tracker is Windows-oriented. It uses `active-win`, Electron power events, Windows process paths, and `taskkill` behavior.

## First-Time Setup

Run all commands from the repository root unless a step says otherwise.

### 1. Install Dependencies

Each application has its own package manifest:

```powershell
npm --prefix api install
npm --prefix dashboard install
npm --prefix desktop install
```

From the repository root, the PowerShell launcher starts PostgreSQL when needed, applies migrations, bootstraps the fixed local user, and starts the API, dashboard, and Electron tracker:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-samaritan.ps1
```

Use `-InstallDependencies` on the first run if any `node_modules` directory is missing. Add `-OpenDashboard` to open the browser automatically, `-SkipDatabase` when PostgreSQL is managed separately, `-SkipSetup` to bypass migration and bootstrap checks, or `-SkipTracker` when only the web stack is needed.

### 2. Start PostgreSQL

```powershell
docker compose up -d postgres
docker compose ps
```

The included Compose file creates:

- Database: `acpe`
- User: `postgres`
- Password: `password`
- Port: `5432`
- Persistent volume: `postgres_data`

These credentials are for local development only.

### 3. Configure Environment Variables

Create `api/.env`:

```dotenv
DATABASE_URL="postgresql://postgres:password@localhost:5432/acpe?schema=public"
```

Create `dashboard/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
```

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` have localhost fallbacks, but declaring both makes the runtime configuration explicit.

Do not commit environment files.

### 4. Create the Database Schema

```powershell
cd api
npx prisma generate
npx prisma migrate deploy
```

For migration development, use `npx prisma migrate dev` instead of `migrate deploy`.

### 5. Bootstrap the Local User and Classifier

The dashboard and Electron tracker currently share this fixed user ID:

```text
7007b337-6f7b-4d6a-86f9-dc4da4ed48c4
```

Create that user and seed the classification patterns:

```powershell
npm run bootstrap:user
npm run seed:patterns
```

`bootstrap:user` is idempotent. `seed:patterns` replaces all existing `AppPattern` rows with the repository defaults, so do not rerun it after teaching the classifier custom rules unless replacing those rules is intentional.

The legacy `gaandfaad_daroga` script uses `src/seed.ts`, creates a random user, and clears classifier patterns. It is not the correct first-run command for the current fixed-user application.

### 6. Start the Applications

Keep each command running in its own terminal.

Terminal 1, API and WebSocket server:

```powershell
cd api
npm run dev
```

Expected message:

```text
API + WS running on http://localhost:4000
```

Terminal 2, dashboard:

```powershell
cd dashboard
npm run dev
```

Open `http://localhost:3000`.

Terminal 3, Electron tracker:

```powershell
cd desktop
npm start
```

Start the tracker last. It expects both the dashboard and API to be available at their default localhost addresses.

## Verify the Installation

Check the API:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

Expected response:

```json
{"status":"OK","ws":true}
```

Then verify the complete flow:

1. Open the dashboard and confirm the Samaritan card reports `Online`.
2. Switch between two applications.
3. Confirm `Current State` changes within roughly one second.
4. Stay in one app for at least two seconds, then switch away.
5. Confirm the completed activity appears in the timeline and hero card.
6. Open a productivity heatmap tile and verify its apps, categories, and metrics.

The current foreground state is intentionally separate from persisted sessions. `Current State` is a live WebSocket observation; the hero and timeline show completed or persisted activity.

## Repository Layout

```text
tracker/
|-- api/
|   |-- prisma/
|   |   |-- migrations/       PostgreSQL migrations
|   |   `-- schema.prisma     Data model
|   `-- src/
|       |-- jobs/             Scheduled aggregation
|       |-- routes/           Express REST routes
|       |-- scripts/          Bootstrap, seed, simulation, reclassification
|       |-- services/         Domain and analytics logic
|       `-- websocket/        Rooms, handlers, and broadcasters
|-- dashboard/
|   |-- app/                  Next.js routes
|   |-- components/           Dashboard and visualization components
|   |-- context/              Shared UI context
|   `-- lib/                  API and WebSocket clients
|-- desktop/
|   |-- main.js               Electron lifecycle and deep-work events
|   |-- tracker.js            Foreground sampling and idle detection
|   |-- sessionEngine.js      Session grouping and transmission
|   |-- wsClient.js           Realtime desktop connection
|   `-- taskkill.js           Windows block enforcement
|-- docker-compose.yml        Local PostgreSQL
`-- plan.md                   Product and implementation planning notes
```

For a detailed desktop code walkthrough, see `desktop/PROJECT_GUIDE.md`.

## Activity Processing

### Foreground Sampling

The Electron tracker samples the foreground window every 500 ms. It sends a lightweight `activity:current` event immediately for the live UI. Icon extraction and persisted-session processing happen afterward so slow icon lookup does not delay the current-state display.

Each current-state payload carries:

- Observation timestamp
- Desktop source session ID
- Monotonic source sequence
- Application and window title
- Process ID and process path
- Inferred URL and domain when available

The API and dashboard reject stale or out-of-order observations.

### Session Persistence

`sessionEngine.js` holds the active observation in memory. When application, title, process, or activity type changes, it closes the previous observation and streams it to the API. Sessions shorter than two seconds are currently discarded.

WebSocket ingestion is primary. HTTP `POST /activity/session` is the fallback when the desktop WebSocket is unavailable.

### Idle Tracking

The desktop tracker considers the system idle after 120 seconds. Lock, suspend, unlock, and resume events also close or create idle observations. Idle activities remain visible in analytics but do not count as deep-work violations.

## Classification and Review

Classification runs in layers:

1. Match an `AppPattern` by normalized application name and title regular expression.
2. Apply known domain intelligence for browser contexts.
3. Fall back to `unknown` with low confidence.

Classifications include:

- Category
- Intent
- Focus impact from `0` to `1`
- Energy impact
- Confidence from `0` to `1`

Low-confidence activities appear under Pending Time Entries. A review can change category, intent, and focus weight. With `Remember this context` enabled, approval creates an exact app/title pattern for future observations. Approval also updates historical activities and recalculates affected session metrics.

## Metrics

Metrics are duration-weighted and start from zero. They evolve from classified activity rather than receiving a neutral starting value.

- Focus uses activity focus impact and smooth rise/decay behavior.
- Productivity combines category, intent, focus impact, and confidence.
- Deep-work score rises during productive protected work and decays during distraction or idle time.
- Burnout estimates sustained load and distraction pressure.
- Entropy represents fragmentation and context switching.
- Daily Balance combines strain reserve, stability, focus, recovery gaps, and switch control after a minimum tracked baseline.

Changing a classification can change historical analytics because the affected session is recalculated.

## Deep-Work Enforcement

Deep work supports four levels:

| Level | Behavior |
| --- | --- |
| `observe` | Records the violation without interrupting the user |
| `warn` | Records the violation and shows a warning |
| `require_reason` | Requires a reason before allowing the override |
| `block` | Attempts to terminate a disallowed Windows process |

Protocol decisions consider explicit blocked apps/domains, optional allow lists, and distracting categories or intents. The Electron tracker performs preemptive block enforcement locally to avoid waiting for a backend round trip. The API still records interventions and broadcasts session state.

Sessions support either a single countdown or Pomodoro cycles with configurable focus, short-break, long-break, and round durations. Timer state is authoritative in the API: pause, resume, phase changes, break skipping, and completion are broadcast immediately to the dashboard and desktop tracker. Enforcement is suspended while paused or on a break. White, pink, brown, and rain-style ambient sounds are generated locally in the browser through Web Audio, so no media service or downloaded audio files are required.

End reports separate focused time from recovery breaks, preserve every phase, include intervention resolutions, and reconcile desktop process-termination successes and failures. Run `npm run verify:deep-work` from `api/` to exercise the full lifecycle and all four enforcement mappings against the local test database.

Use `block` carefully. Broad process names can terminate every matching process, and elevated or protected applications may resist termination.

## Projects, Calendar, and Goals

- Project rules can match application name, domain, or title keyword.
- Matching activities receive a `projectId` automatically.
- The Projects workbench shows daily trends, source allocation, top apps/categories, focus quality, linked goals, and recent activity.
- Unassigned activities can be corrected in bulk; remembered corrections create future app/domain rules.
- Projects are archived instead of hard-deleted so historical attribution remains intact.
- Calendar events can be created manually or imported from ICS content or a URL.
- Calendar overlays compare scheduled events with tracked activity.
- Goals track focus minutes, productive minutes, project time, hours, or completed focus sessions.
- Goal periods use the configured calendar timezone and retain progress snapshots for pace, forecasts, history, and streaks.
- Deep-work sessions can be linked to projects, allowing project-specific focus and session goals.
- Goal progress is recalculated and broadcast after new activity or focus completion.
- Project time is aggregated nightly at 2:00 AM in `Asia/Kolkata`.

## REST API Overview

All endpoints are served from `http://localhost:4000`.

| Area | Main endpoints |
| --- | --- |
| Health | `GET /health` |
| Activity | `POST /activity`, `POST /activity/session`, `POST /activity/reviews` |
| Analytics | `GET /analytics/daily`, `/timeline`, `/heatmap`, `/daily-focus-trend`, `/readiness` |
| Deep work | `GET /focus/active`, `GET /focus/active/status`, `GET /focus/history`, `GET /focus/:id/result`, `POST /focus/start`, `POST /focus/:id/pause`, `POST /focus/:id/resume`, `POST /focus/:id/skip-break`, `POST /focus/:id/end` |
| Interventions | `POST /focus/interventions/:id/resolve` |
| Projects | CRUD, `/unassigned`, `/activities/assign`, `/:id/dashboard`, and rules under `/:projectId/rules` |
| Calendar | CRUD, import, and overlay under `/api/calendar` |
| Goals | CRUD, `/dashboard`, and `/:id/history` under `/api/goals` |
| Ratings | Create and list under `/api/ratings` |

Most endpoints require `userId` in the query string or request body. There is currently no authentication layer.

## Realtime Events

The API hosts its WebSocket server on the same HTTP server at `/ws`. Connections identify a `userId` and a `clientType` of `desktop` or `dashboard`.

Important event families include:

- `activity:current`, `activity:new`, `activity:reviewed`
- `session:metrics`
- `analytics:daily`, `analytics:burnout`
- `deepwork:started`, `deepwork:state`, `deepwork:minute`, `deepwork:ended`, `deepwork:expired`
- `intervention:triggered`, `intervention:resolved`, `intervention:cleared`
- `calendar:changed`
- `goal:changed`, `goal:progress`

The dashboard debounces data-heavy refreshes while applying the current foreground application immediately.

## API Background Work

Starting the API also starts:

- Deep-work expiry checks
- One-minute deep-work logging and state pushes
- Nightly project-time aggregation at 2:00 AM IST

Outbound webhooks are disabled. The API does not mount `/api/webhooks`, queue event deliveries, or run the webhook dispatcher.

Run only one API instance locally unless duplicate timers and scheduled jobs are explicitly desired.

## Useful Development Commands

API:

```powershell
cd api
npm run dev
npm run bootstrap:user
npm run seed:patterns
npm run reclassify:activities
npm run simulate:deepwork
npm run verify:project-goals
npx tsc --noEmit
npx prisma studio
```

Dashboard:

```powershell
cd dashboard
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

Desktop:

```powershell
cd desktop
npm start
node --check tracker.js
node --check wsClient.js
```

## Troubleshooting

### Database connection fails

Run `docker compose ps` and confirm PostgreSQL is healthy and listening on port `5432`. Check that `api/.env` uses the same credentials as `docker-compose.yml`.

### Prisma reports missing tables or columns

From `api/`, run:

```powershell
npx prisma generate
npx prisma migrate deploy
```

Restart the API afterward.

### API works but the dashboard is empty

Confirm the fixed user exists:

```powershell
cd api
npm run bootstrap:user
```

Also confirm the API is on port `4000` and the dashboard environment points to it.

### Current State is stale or one application behind

Confirm the Electron log says `Desktop connected`, the API logs a desktop WebSocket connection, and `NEXT_PUBLIC_WS_URL` is `ws://localhost:4000/ws`. Restart the desktop tracker after changing WebSocket configuration.

### Timeline updates but Current State does not

Timeline entries are persisted activity; Current State uses `activity:current`. This usually means HTTP ingestion works but the desktop WebSocket is disconnected.

### Everything is classified as unknown or system

Run `npm run seed:patterns` from `api/`, then optionally run `npm run reclassify:activities` to update existing activities. Be aware that reseeding replaces learned review patterns.

### Block enforcement does not close an app

- Run Electron with sufficient Windows permissions.
- Check that the configured app name matches the foreground process.
- Verify the session enforcement is exactly `block`.
- Check desktop logs for the `taskkill` result.
- Some protected or elevated processes cannot be terminated by a non-elevated tracker.

### Port 3000 or 4000 is already in use

Find the owning process:

```powershell
netstat -ano | Select-String ':3000\s|:4000\s'
```

Stop the duplicate development process or configure a different port consistently across API, dashboard, Electron, and CORS.

### Next.js reports a `.next/dev/lock`

Another dashboard development server is already running. Reuse it or stop that specific process before starting a replacement.

### Dashboard build warns about multiple lockfiles

The root and dashboard both contain `package-lock.json`. The warning is non-fatal. Set `turbopack.root` in `dashboard/next.config.ts` or consolidate package ownership when reorganizing the repository.

## Reset Local Data

The following command removes the PostgreSQL container and its persistent volume. It permanently deletes local Samaritan data:

```powershell
docker compose down -v
```

Afterward, repeat the database, migration, local-user, and pattern-seed steps.

## Current Development Constraints

- One hardcoded local user ID is shared across the dashboard and desktop tracker.
- API CORS currently allows only `http://localhost:3000`.
- API and desktop URLs are primarily hardcoded for localhost development.
- Authentication and authorization are not implemented.
- The Docker credentials are not suitable for production.
- Electron packaging is not wired to the dashboard export path as a complete release workflow.
- Automated test coverage is not yet established; use type checks, builds, health checks, and manual end-to-end verification.
- Time-oriented analytics and scheduled aggregation are designed around IST (`Asia/Kolkata`).

These constraints should be addressed before exposing the application beyond a trusted local machine.
