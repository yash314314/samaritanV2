import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

const STACK_ITEMS = [
  {
    tech: 'React 19 & Next.js 14 App Router',
    role: 'User Interface Composition',
    desc: 'Provides dark glass Next.js 14 dashboard UI with server-side rendering and client-side WebSocket hooks.'
  },
  {
    tech: 'Node.js Express & TypeScript',
    role: 'REST API & Classifier Service',
    desc: 'Executes pattern classification rules, focus curve calculation, Shannon entropy H(A), and calendar timeblocking.'
  },
  {
    tech: 'Prisma ORM & PostgreSQL 15',
    role: 'Local Relational Datastore',
    desc: 'Stores 37 database migrations for activity sessions, projects, focus blocks, and calendar events locally in Docker.'
  },
  {
    tech: 'Electron & active-win Native Bindings',
    role: 'Sub-second Desktop Ingestion',
    desc: 'Samples foreground window title, executable process ID, system idle baseline, and executes taskkill process enforcement.'
  },
  {
    tech: 'HTML5 Web Audio API',
    role: 'Procedural Focus Sound Synthesizer',
    desc: 'Synthesizes rain, pink, white, and brown ambient noise directly in the browser with zero audio MP3 asset overhead.'
  },
  {
    tech: 'WebSockets (ws Library)',
    role: 'Realtime Sub-Second Stream',
    desc: 'Monotonic tick sequence stream between Electron desktop observer and React dashboard.'
  }
];

export const TechStackSection: React.FC = () => {
  return (
    <section id="stack" className="py-28 bg-[#050507] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Chapter 09 • Verified Tech Stack
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Contextual Engineering Stack
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Every technology choice in Samaritan serves a specific architectural role in delivering local-first desktop productivity tracking.
          </p>
        </div>

        {/* Tech Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {STACK_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-[#0A0A0F] border border-white/10 shadow-xl flex flex-col justify-between space-y-4"
            >
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {item.role}
                </span>
                <h3 className="text-lg font-bold text-white mt-2 font-mono">{item.tech}</h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{item.desc}</p>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-mono text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Verified In Codebase
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
