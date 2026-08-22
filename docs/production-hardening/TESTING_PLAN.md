# SamaritanV2 Production Hardening Testing Plan

## 1. Scope & System Architecture
- **API Backend**: Express (v5) + Prisma ORM + PostgreSQL + WebSocket Server (`ws`)
- **Dashboard Frontend**: Next.js (v16) + React (v19) + Tailwind CSS + Recharts
- **Desktop Application**: Electron Windows foreground observer + Deep-work enforcement
- **Database**: PostgreSQL 15 (`acpe` database)

## 2. Testing Strategy & Execution Stages
1. **Baseline Assessment & Setup**: Establish baseline build, lint, typecheck, DB migrations, and initial scripts execution.
2. **Static Analysis & Type Security**: Audit `api`, `dashboard`, `desktop` for TypeScript errors, lint issues, memory leaks, floating promises, unsafe types.
3. **Database Constraints & Schema Hardening**: Ensure foreign keys, unique indexes, transactions, cascade rules, and query optimizations.
4. **Backend REST & WebSocket API Testing**: Unit tests, endpoint validation, authentication/authorization audit, edge case fuzzing, schema validation.
5. **Frontend & UI Reliability**: Error boundaries, loading/empty states, multi-tab sync, keyboard nav, responsive design, network error graceful handling.
6. **Concurrency, Idempotency & Race Conditions**: Concurrent requests, timer starts/stops, double-click mutations, transaction locks.
7. **Performance & Stress Baseline**: Load testing (k6/autocannon/custom scripts), connection pool limits, hot-resource hammering, memory leaks.
8. **Security & Data Safety**: XSS, SQLi/Prisma safety, CORS, auth/authz enforcement, rate limiting, header hardening.
9. **Reliability & Chaos Testing**: DB disconnect recovery, WebSocket reconnection, graceful shutdown, environment variable validation.
