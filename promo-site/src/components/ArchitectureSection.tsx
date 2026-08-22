import React, { useState } from 'react';
import { Server, ShieldCheck, ChevronRight, X } from 'lucide-react';

interface ArchNode {
  id: string;
  step: string;
  name: string;
  badge: string;
  address: string;
  description: string;
  details: string[];
  jsonPayload: string;
}

const ARCH_NODES: ArchNode[] = [
  {
    id: 'observer',
    step: '1. OBSERVER',
    name: 'Electron Desktop Observer',
    badge: 'Desktop Process',
    address: 'Windows Active Window',
    description: 'Samples foreground window title, application name, process ID, process path, and inferred web URL every 500ms.',
    details: [
      'Uses active-win native Windows bindings',
      'Detects system idle state after 120s baseline',
      'Preemptively terminates disallowed Windows executables in Block mode',
      'Transmits lightweight activity:current tick before icon resolution'
    ],
    jsonPayload: `{
  "timestamp": "2026-08-22T18:30:00.000Z",
  "sourceSessionId": "desktop-041a-8f",
  "sequence": 1402,
  "app": "Cursor",
  "title": "samaritanV2/api/src/server.ts",
  "processId": 14208,
  "processPath": "C:\\\\Users\\\\Alex\\\\AppData\\\\Local\\\\Programs\\\\cursor\\\\Cursor.exe",
  "url": "https://github.com/samaritan/v2"
}`
  },
  {
    id: 'stream',
    step: '2. STREAM LAYER',
    name: 'WebSocket Event Engine',
    badge: 'Realtime Protocol',
    address: 'ws://localhost:4000/ws',
    description: 'Ingests active window streams, enforces monotonic sequence ordering, and broadcasts realtime focus updates to the UI.',
    details: [
      'Dual client rooms for desktop ingesters and dashboard observers',
      'Out-of-order sequence tick rejection',
      'Broadcasts session:metrics, deepwork:minute, and intervention:triggered',
      'Automatic reconnect handler with backoff'
    ],
    jsonPayload: `{
  "event": "activity:current",
  "userId": "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4",
  "payload": {
    "app": "Cursor",
    "category": "productive",
    "intent": "coding",
    "focusImpact": 0.95,
    "confidence": 1.0
  }
}`
  },
  {
    id: 'api',
    step: '3. CORE ENGINE',
    name: 'Express REST & Classifier',
    badge: 'Analytics Engine',
    address: 'http://localhost:4000',
    description: 'Executes multi-layer classification rules, computes duration-weighted metrics, and manages project/calendar goals.',
    details: [
      '120+ pre-seeded classifier regex pattern rules',
      'Low-confidence classification review inbox',
      'Nightly project-time aggregation job (2:00 AM IST)',
      'Smart break recovery recommendation engine'
    ],
    jsonPayload: `{
  "status": "OK",
  "ws": true,
  "metrics": {
    "focusScore": 0.94,
    "productivityScore": 0.96,
    "entropyScore": 0.12,
    "burnoutRisk": 0.22
  }
}`
  },
  {
    id: 'db',
    step: '4. PERSISTENCE & UI',
    name: 'PostgreSQL 15 & Next.js 14',
    badge: 'Local Database',
    address: 'localhost:5432 & :3000',
    description: 'Persistent database storage using Prisma ORM. Next.js 14 dark glass dashboard for real-time visualization.',
    details: [
      '37 applied database migrations for full relational tracking',
      '100% local database storage—zero cloud telemetry',
      'Prisma Studio database inspection',
      'Responsive dark glassmorphic Next.js interface'
    ],
    jsonPayload: `model Session {
  id                String    @id @default(uuid())
  userId            String
  startTime         DateTime  @default(now())
  endTime           DateTime?
  focusScore        Float     @default(0)
  productivityScore Float     @default(0)
  burnoutScore      Float     @default(0)
  entropyScore      Float     @default(0)
}`
  }
];

export const ArchitectureSection: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);

  return (
    <section id="architecture" className="py-24 bg-[#050506] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
            <Server className="w-3.5 h-3.5" />
            System Architecture
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Zero-Cloud Local Development Stack
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4">
            Click any process block below to inspect raw JSON payloads, runtime schemas, and execution specs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {ARCH_NODES.map((node) => (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className="p-6 rounded-2xl bg-[#0B0B0D] border border-white/10 relative group hover:border-purple-500/40 transition-all shadow-xl cursor-pointer hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono text-purple-400 uppercase font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {node.step}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">Click to inspect</span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                {node.name}
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed line-clamp-3">
                {node.description}
              </p>
              <div className="mt-4 pt-4 border-t border-white/5 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                <span>{node.address}</span>
                <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-purple-950/20 border border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Absolute Privacy & Data Safety</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Window titles, app usage, and focus metrics are stored strictly inside your local PostgreSQL database. No user telemetry is ever collected or transmitted.
              </p>
            </div>
          </div>
          <a
            href="#faq"
            className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Review Security FAQ
          </a>
        </div>
      </div>

      {selectedNode && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-3xl w-full bg-[#0B0B0D] rounded-2xl border border-white/15 overflow-hidden shadow-2xl relative">
            <div className="bg-[#18181B] px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase text-purple-400 font-bold">
                  {selectedNode.step} Payload Inspection
                </span>
                <h4 className="text-lg font-bold text-white">{selectedNode.name}</h4>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div>
                <h5 className="text-xs font-mono uppercase font-bold text-zinc-400 mb-2">Process Details & Constraints:</h5>
                <ul className="space-y-1.5 text-xs text-zinc-300">
                  {selectedNode.details.map((d, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h5 className="text-xs font-mono uppercase font-bold text-purple-400 mb-2">Live JSON Payload / Schema Spec:</h5>
                <pre className="p-4 rounded-xl bg-black border border-white/10 font-mono text-xs text-purple-300 overflow-x-auto">
                  <code>{selectedNode.jsonPayload}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
