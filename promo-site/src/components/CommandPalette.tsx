import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Code, Database, Layers, ArrowRight } from 'lucide-react';
import { FEATURE_MANIFEST } from '../data/featureManifest';
import { ENDPOINT_MANIFEST } from '../data/endpointManifest';
import { DATA_MODEL_MANIFEST } from '../data/dataModelManifest';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFeature: (feature: any) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onSelectFeature }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredFeatures = FEATURE_MANIFEST.filter(
    (f) => f.name.toLowerCase().includes(query.toLowerCase()) || f.summary.toLowerCase().includes(query.toLowerCase())
  );

  const filteredEndpoints = ENDPOINT_MANIFEST.filter(
    (e) => e.path.toLowerCase().includes(query.toLowerCase()) || e.purpose.toLowerCase().includes(query.toLowerCase())
  );

  const filteredModels = DATA_MODEL_MANIFEST.filter(
    (m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-start justify-center pt-20 p-4 animate-fadeIn">
      <div className="max-w-2xl w-full bg-[#0A0A0F] rounded-2xl border border-indigo-500/30 overflow-hidden shadow-2xl">
        {/* Search Header */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Samaritan features, API endpoints, data models..."
            className="w-full bg-transparent text-white placeholder-zinc-500 text-sm outline-none font-mono"
          />
          <button onClick={onClose} className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
          {/* Features */}
          {filteredFeatures.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase text-indigo-400 font-bold mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Features & Capabilities ({filteredFeatures.length})
              </div>
              <div className="space-y-1.5">
                {filteredFeatures.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      onSelectFeature(f);
                      onClose();
                    }}
                    className="w-full p-3 rounded-xl bg-zinc-900/60 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/40 text-left transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-indigo-300">{f.name}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{f.summary}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* API Endpoints */}
          {filteredEndpoints.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase text-indigo-400 font-bold mb-2 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5" /> API Endpoints ({filteredEndpoints.length})
              </div>
              <div className="space-y-1.5">
                {filteredEndpoints.map((ep) => (
                  <a
                    key={ep.id}
                    href="#api"
                    onClick={onClose}
                    className="p-3 rounded-xl bg-zinc-900/60 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/40 text-left transition-all flex items-center justify-between group block"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-mono text-xs font-bold">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {ep.method}
                        </span>
                        <span className="text-white group-hover:text-indigo-300">{ep.path}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">{ep.purpose}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Data Models */}
          {filteredModels.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase text-indigo-400 font-bold mb-2 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Prisma Data Models ({filteredModels.length})
              </div>
              <div className="space-y-1.5">
                {filteredModels.map((m) => (
                  <a
                    key={m.name}
                    href="#models"
                    onClick={onClose}
                    className="p-3 rounded-xl bg-zinc-900/60 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/40 text-left transition-all flex items-center justify-between group block"
                  >
                    <div>
                      <div className="text-xs font-bold text-white font-mono group-hover:text-indigo-300">
                        model {m.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{m.description}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {filteredFeatures.length === 0 && filteredEndpoints.length === 0 && filteredModels.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-xs font-mono">
              No matching Samaritan components found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
