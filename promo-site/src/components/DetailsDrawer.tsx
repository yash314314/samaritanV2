import React from 'react';
import { X, AlertTriangle, Code, Database, Server, Layers } from 'lucide-react';
import type { SamaritanFeature } from '../data/featureManifest';

interface DetailsDrawerProps {
  feature: SamaritanFeature | null;
  onClose: () => void;
}

export const DetailsDrawer: React.FC<DetailsDrawerProps> = ({ feature, onClose }) => {
  if (!feature) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-end p-0 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-2xl h-full sm:h-[90vh] bg-[#0A0A0F] sm:rounded-2xl border border-indigo-500/30 overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-[#101018] px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              {feature.badge}
            </span>
            <h3 className="text-xl font-bold text-white mt-1">{feature.name}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-zinc-300">
          {/* Summary & What */}
          <div className="space-y-2">
            <h4 className="font-mono text-xs uppercase font-bold text-indigo-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> Feature Overview & Purpose
            </h4>
            <p className="text-sm font-medium text-white leading-relaxed">{feature.summary}</p>
            <p className="text-zinc-400 leading-relaxed">{feature.what}</p>
          </div>

          {/* Why */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-1">
            <h5 className="font-mono text-xs uppercase font-bold text-indigo-400">Why It Was Built:</h5>
            <p className="text-zinc-300 leading-relaxed">{feature.why}</p>
          </div>

          {/* User Experience & Interaction */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1">
              <h5 className="font-mono text-xs uppercase font-bold text-emerald-400">User Experience:</h5>
              <p className="text-zinc-300 leading-relaxed">{feature.userExperience}</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1">
              <h5 className="font-mono text-xs uppercase font-bold text-cyan-400">UI Interaction:</h5>
              <p className="text-zinc-300 leading-relaxed">{feature.uiInteraction}</p>
            </div>
          </div>

          {/* Frontend Code Snippet */}
          <div className="space-y-1.5">
            <h4 className="font-mono text-xs uppercase font-bold text-indigo-300 flex items-center gap-1.5">
              <Code className="w-4 h-4" /> Frontend Implementation
            </h4>
            <pre className="p-4 rounded-xl bg-black border border-white/10 font-mono text-xs text-indigo-200 overflow-x-auto">
              <code>{feature.frontendCode}</code>
            </pre>
          </div>

          {/* API & Backend Logic */}
          <div className="space-y-1.5">
            <h4 className="font-mono text-xs uppercase font-bold text-indigo-300 flex items-center gap-1.5">
              <Server className="w-4 h-4" /> Backend Endpoint & Logic
            </h4>
            <div className="p-4 rounded-xl bg-black border border-white/10 space-y-2 font-mono text-xs">
              <div className="text-indigo-400 font-bold">{feature.apiEndpoint}</div>
              <p className="text-zinc-400 font-sans leading-relaxed">{feature.backendLogic}</p>
            </div>
          </div>

          {/* Database Entity */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1">
            <h4 className="font-mono text-xs uppercase font-bold text-purple-400 flex items-center gap-1.5">
              <Database className="w-4 h-4" /> Prisma Data Model Persistence
            </h4>
            <div className="font-mono text-purple-300 font-semibold">{feature.databaseModel}</div>
          </div>

          {/* Failure Cases */}
          {feature.failureCases.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-mono text-xs uppercase font-bold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Fallback & Failure Grace Modes
              </h4>
              <ul className="space-y-1.5">
                {feature.failureCases.map((fc, i) => (
                  <li key={i} className="flex items-start gap-2 text-zinc-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span>{fc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
