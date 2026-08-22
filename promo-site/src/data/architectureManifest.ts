export interface ArchComponent {
  id: string;
  name: string;
  subsystem: string;
  technology: string;
  runtimeLocation: string;
  responsibility: string;
  inputProtocols: string[];
  outputProtocols: string[];
  keyFiles: string[];
  failureBehavior: string;
}

export const ARCHITECTURE_MANIFEST: ArchComponent[] = [
  {
    id: 'observer-process',
    name: '1. Electron Desktop Observer Process',
    subsystem: 'Native Windows Ingestion',
    technology: 'Electron + active-win + Node.js C++ Bindings',
    runtimeLocation: 'Local Desktop Client (Windows Executable)',
    responsibility: 'Polls Windows active foreground window handle every 500ms, resolves process ID and executable path, checks system idle state, and kills blocked apps in strict mode.',
    inputProtocols: ['Windows Win32 GetForegroundWindow API'],
    outputProtocols: ['WebSocket Client Stream (ws://localhost:4000/ws)'],
    keyFiles: ['desktop/src/main.ts', 'desktop/src/observer.ts', 'api/src/services/iconResolver.ts'],
    failureBehavior: 'If backend disconnects, buffers up to 100 ticks locally and reconnects with exponential backoff.'
  },
  {
    id: 'websocket-engine',
    name: '2. Realtime WebSocket Event Engine',
    subsystem: 'Sub-second Event Pipeline',
    technology: 'Node.js ws library + Monotonic Queue Manager',
    runtimeLocation: 'Express Server Process (Port 4000 /ws)',
    responsibility: 'Ingests active window tick stream, enforces sequence order, broadcasts session:metrics and deepwork:minute events to dashboard observers.',
    inputProtocols: ['WebSocket Tick Streams from Desktop Client'],
    outputProtocols: ['WebSocket Broadcast to Dashboard UI Client'],
    keyFiles: ['api/src/websocket/manager.ts', 'api/src/websocket/broadcaster.ts', 'dashboard/lib/ws.ts'],
    failureBehavior: 'Rejects out-of-order sequence ticks and logs gap warnings.'
  },
  {
    id: 'express-core',
    name: '3. Express REST API & Analytics Classifier',
    subsystem: 'Analytics & Business Logic Engine',
    technology: 'Node.js Express + TypeScript + Prisma ORM',
    runtimeLocation: 'Local REST API Server (Port 4000)',
    responsibility: 'Executes multi-layer classification rules, computes duration-weighted focus curves, Shannon entropy H(A), burnout risk, project time attributions, and calendar overlays.',
    inputProtocols: ['HTTP REST Endpoints (GET, POST, PATCH, DELETE)'],
    outputProtocols: ['SQL Queries via Prisma ORM to PostgreSQL'],
    keyFiles: ['api/src/routes/*.ts', 'api/src/services/metricEngine.ts', 'api/src/services/contextClassifier.ts'],
    failureBehavior: 'Low confidence observations are flagged and pushed to the Activity Review Inbox.'
  },
  {
    id: 'datastore-ui',
    name: '4. PostgreSQL 15 & Next.js 14 Dashboard UI',
    subsystem: 'Persistence & User Interface',
    technology: 'PostgreSQL 15 Datastore + Next.js 14 App Router',
    runtimeLocation: 'Docker Container (acpe_postgres:5432) & Next.js Server (Port 3000)',
    responsibility: 'Stores 37 database migrations for relational activity history. Renders dark glass Next.js dashboard with zero cloud telemetry.',
    inputProtocols: ['Prisma Client SQL Connection', 'Browser React Render Loop'],
    outputProtocols: ['Local HTML/CSS/JS DOM Rendering'],
    keyFiles: ['api/prisma/schema.prisma', 'dashboard/app/**/page.tsx'],
    failureBehavior: 'Zero data transmission outside localhost—100% local-first data isolation.'
  }
];
