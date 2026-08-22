import React, { useState } from 'react';
import { X, Code2 } from 'lucide-react';
import { ARCHITECTURE_MANIFEST } from '../data/architectureManifest';
import { ENDPOINT_MANIFEST } from '../data/endpointManifest';
import { DATA_MODEL_MANIFEST } from '../data/dataModelManifest';

interface TechnicalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TechnicalDrawer: React.FC<TechnicalDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'arch' | 'endpoints' | 'models'>('arch');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-end p-0 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-3xl h-full sm:h-[92vh] bg-[#08080d] sm:rounded-2xl border border-indigo-500/30 overflow-hidden shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="bg-[#101018] px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400">Under The Hood</span>
              <h3 className="text-xl font-bold text-white">Samaritan Architecture & API Explorer</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10 bg-zinc-950 font-mono text-xs">
          <button
            onClick={() => setActiveTab('arch')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'arch' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            System Architecture (4 Nodes)
          </button>
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'endpoints' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            REST Endpoints ({ENDPOINT_MANIFEST.length})
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'models' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Data Models ({DATA_MODEL_MANIFEST.length})
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-zinc-300 font-mono">
          {activeTab === 'arch' && (
            <div className="space-y-4">
              {ARCHITECTURE_MANIFEST.map((node) => (
                <div key={node.id} className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                      {node.subsystem}
                    </span>
                    <span className="text-[10px] text-zinc-500">{node.runtimeLocation}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{node.name}</h4>
                  <p className="text-zinc-400 font-sans leading-relaxed">{node.responsibility}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'endpoints' && (
            <div className="space-y-3">
              {ENDPOINT_MANIFEST.map((ep) => (
                <div key={ep.id} className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {ep.method}
                    </span>
                    <span className="text-[10px] text-zinc-500">{ep.domain}</span>
                  </div>
                  <div className="font-bold text-white text-xs">{ep.path}</div>
                  <p className="text-zinc-400 font-sans text-xs">{ep.purpose}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-4">
              {DATA_MODEL_MANIFEST.map((model) => (
                <div key={model.name} className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2">
                  <div className="text-sm font-bold text-white">model {model.name}</div>
                  <p className="text-zinc-400 font-sans text-xs">{model.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
