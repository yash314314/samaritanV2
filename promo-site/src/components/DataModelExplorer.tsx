import React, { useState } from 'react';
import { DATA_MODEL_MANIFEST } from '../data/dataModelManifest';
import type { PrismaEntity } from '../data/dataModelManifest';
import { Database, Key, GitCommit, ChevronRight } from 'lucide-react';

export const DataModelExplorer: React.FC = () => {
  const [activeEntity, setActiveEntity] = useState<PrismaEntity>(DATA_MODEL_MANIFEST[0]);

  return (
    <section id="models" className="py-28 bg-[#050507] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-3.5 py-1.5 rounded-full border border-purple-500/20">
            <Database className="w-3.5 h-3.5" />
            Chapter 06 • Database Schema & Entities
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            3D Prisma Data Model Explorer
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Inspect the exact relational database entities stored inside Samaritan's local PostgreSQL 15 instance.
          </p>
        </div>

        {/* Entity Explorer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Entity Selector Buttons */}
          <div className="lg:col-span-4 space-y-2">
            {DATA_MODEL_MANIFEST.map((entity) => (
              <button
                key={entity.name}
                onClick={() => setActiveEntity(entity)}
                className={`w-full p-4 rounded-2xl text-left border transition-all flex items-center justify-between ${
                  activeEntity.name === entity.name
                    ? 'bg-purple-950/30 border-purple-500 text-white shadow-xl'
                    : 'bg-[#0A0A0F] border-white/10 text-zinc-400 hover:bg-zinc-900/60 hover:text-white'
                }`}
              >
                <div>
                  <div className="font-mono text-xs font-bold text-white">model {entity.name}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{entity.description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-purple-400" />
              </button>
            ))}
          </div>

          {/* Active Entity Fields Table */}
          <div className="lg:col-span-8 bg-[#0A0A0F] rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-mono text-purple-400 font-bold uppercase">Table: {activeEntity.tableName}</span>
                <h3 className="text-2xl font-mono font-bold text-white mt-1">model {activeEntity.name}</h3>
              </div>
              <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg border border-white/5">
                {activeEntity.fields.length} Fields Defined
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">{activeEntity.description}</p>

            {/* Fields Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Field Name</th>
                    <th className="py-2.5 px-3">Data Type</th>
                    <th className="py-2.5 px-3">Attribute</th>
                    <th className="py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeEntity.fields.map((f, i) => (
                    <tr key={i} className="hover:bg-zinc-900/40">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-1.5">
                        {f.isId && <Key className="w-3.5 h-3.5 text-amber-400" />}
                        {f.isRelation && <GitCommit className="w-3.5 h-3.5 text-purple-400" />}
                        <span>{f.name}</span>
                      </td>
                      <td className="py-3 px-3 text-purple-300 font-semibold">{f.type}</td>
                      <td className="py-3 px-3">
                        {f.isId ? (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                            @id
                          </span>
                        ) : f.isRelation ? (
                          <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                            @relation
                          </span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-zinc-400 font-sans text-xs">{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Relations */}
            <div className="pt-4 border-t border-white/10 flex items-center gap-2 text-xs font-mono">
              <span className="text-zinc-500">Relational Connections:</span>
              <div className="flex flex-wrap gap-1.5">
                {activeEntity.relations.map((rel, i) => (
                  <span key={i} className="px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {rel}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
