import React, { useState } from 'react';
import { ARCHITECTURE_MANIFEST } from '../data/architectureManifest';
import type { ArchComponent } from '../data/architectureManifest';
import { Cpu, Terminal } from 'lucide-react';

export const ArchitectureExplorer: React.FC = () => {
  const [selectedComponent, setSelectedComponent] = useState<ArchComponent>(ARCHITECTURE_MANIFEST[0]);

  return (
    <section id="architecture" className="py-28 bg-[#07070A] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <Cpu className="w-3.5 h-3.5" />
            Chapter 08 • Exploded System Architecture
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Inside Samaritan's Local Runtime
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Samaritan operates as 4 decoupled runtime processes communicating locally over high-throughput WebSockets and HTTP REST interfaces.
          </p>
        </div>

        {/* 3D Exploded Layer Stack */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Layer Selector Stack */}
          <div className="lg:col-span-5 space-y-4">
            {ARCHITECTURE_MANIFEST.map((comp, idx) => (
              <div
                key={comp.id}
                onClick={() => setSelectedComponent(comp)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer transform-gpu hover:-translate-y-1 ${
                  selectedComponent.id === comp.id
                    ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-2xl ring-1 ring-indigo-500/50'
                    : 'bg-[#0A0A0F] border-white/10 text-zinc-400 hover:bg-zinc-900/60 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                    {comp.subsystem}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">Layer {idx + 1}</span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">{comp.name}</h3>
                <div className="text-xs text-zinc-400 font-mono mt-1">{comp.technology}</div>
              </div>
            ))}
          </div>

          {/* Component Deep-Dive Inspection Card */}
          <div className="lg:col-span-7 bg-[#0A0A0F] rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-mono uppercase text-indigo-400 font-bold">
                  {selectedComponent.subsystem}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{selectedComponent.name}</h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 font-bold">
                Local Runtime Node
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase">Process Responsibility:</h4>
              <p className="text-sm text-zinc-200 leading-relaxed">{selectedComponent.responsibility}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1">
                <span className="text-indigo-400 font-bold block uppercase">Input Protocols:</span>
                <ul className="space-y-1 text-zinc-300">
                  {selectedComponent.inputProtocols.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1">
                <span className="text-emerald-400 font-bold block uppercase">Output Protocols:</span>
                <ul className="space-y-1 text-zinc-300">
                  {selectedComponent.outputProtocols.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Key Implementation Files */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase flex items-center gap-1.5">
                <Terminal className="w-4 h-4" /> Authoritative Source Code Files:
              </h4>
              <div className="space-y-1">
                {selectedComponent.keyFiles.map((kf, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-black border border-white/10 font-mono text-xs text-indigo-200">
                    <code>{kf}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Failure & Graceful Behavior */}
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-1 text-xs">
              <span className="font-mono text-amber-400 font-bold uppercase block">Disconnect & Failure Grace Mode:</span>
              <p className="text-zinc-300 leading-relaxed">{selectedComponent.failureBehavior}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
