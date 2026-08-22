import React, { useState } from 'react';
import { ENDPOINT_MANIFEST } from '../data/endpointManifest';
import type { ApiEndpoint } from '../data/endpointManifest';
import { Code, Search, Lock, Database } from 'lucide-react';

export const ApiExplorerSection: React.FC = () => {
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeEndpoint, setActiveEndpoint] = useState<ApiEndpoint>(ENDPOINT_MANIFEST[0]);

  const domains = [
    'all',
    'Activity & Ingestion',
    'Analytics & Metrics',
    'Deep Work & Focus',
    'Calendar Intelligence',
    'Projects & Rules',
    'Goals & Streaks',
    'Webhooks & System'
  ];

  const filteredEndpoints = ENDPOINT_MANIFEST.filter((ep) => {
    const matchesDomain = selectedDomain === 'all' || ep.domain === selectedDomain;
    const matchesMethod = selectedMethod === 'ALL' || ep.method === selectedMethod;
    const matchesSearch =
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesMethod && matchesSearch;
  });

  return (
    <section id="api" className="py-28 bg-[#07070A] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <Code className="w-3.5 h-3.5" />
            Chapter 05 • Interactive API Documentation
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Samaritan REST API Explorer
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Derived directly from Samaritan’s Express controllers in <code className="text-indigo-300">api/src/routes/</code>. Search, filter, and inspect real request/response payloads.
          </p>

          {/* Search & Method Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search paths or purpose..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs font-mono outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/10">
              {(['ALL', 'GET', 'POST', 'PATCH', 'DELETE'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMethod(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    selectedMethod === m
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Domain Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {domains.map((dom) => (
              <button
                key={dom}
                onClick={() => setSelectedDomain(dom)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  selectedDomain === dom
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {dom === 'all' ? 'All Domains' : dom}
              </button>
            ))}
          </div>
        </div>

        {/* Master API Explorer Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Endpoint List Sidebar */}
          <div className="lg:col-span-5 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredEndpoints.map((ep) => (
              <button
                key={ep.id}
                onClick={() => setActiveEndpoint(ep)}
                className={`w-full p-4 rounded-2xl text-left border transition-all ${
                  activeEndpoint.id === ep.id
                    ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-xl'
                    : 'bg-[#0A0A0F] border-white/10 text-zinc-400 hover:bg-zinc-900/60 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    ep.method === 'GET'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : ep.method === 'POST'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : ep.method === 'PATCH'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                    {ep.method}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">{ep.domain}</span>
                </div>
                <div className="font-mono text-xs font-bold text-white truncate">{ep.path}</div>
                <div className="text-xs text-zinc-400 mt-1 line-clamp-1">{ep.purpose}</div>
              </button>
            ))}

            {filteredEndpoints.length === 0 && (
              <div className="p-8 text-center text-zinc-500 font-mono text-xs">
                No API endpoints match the selected filters.
              </div>
            )}
          </div>

          {/* Endpoint Inspector Detail Card */}
          <div className="lg:col-span-7 bg-[#0A0A0F] rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-mono text-indigo-400 font-bold uppercase">{activeEndpoint.domain}</span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {activeEndpoint.method}
                  </span>
                  <h3 className="text-lg font-mono font-bold text-white">{activeEndpoint.path}</h3>
                </div>
              </div>

              {activeEndpoint.auth && (
                <span className="flex items-center gap-1 text-xs font-mono text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                  <Lock className="w-3.5 h-3.5" /> Required Auth
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase">Purpose & Description:</h4>
              <p className="text-sm text-zinc-200 leading-relaxed">{activeEndpoint.purpose}</p>
            </div>

            {/* Request Shape */}
            {activeEndpoint.requestShape && (
              <div className="space-y-1">
                <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase">Request Body JSON Shape:</h4>
                <pre className="p-4 rounded-xl bg-black border border-white/10 font-mono text-xs text-indigo-200 overflow-x-auto">
                  <code>{activeEndpoint.requestShape}</code>
                </pre>
              </div>
            )}

            {/* Response Shape */}
            <div className="space-y-1">
              <h4 className="text-xs font-mono font-bold text-emerald-400 uppercase">Response JSON Shape:</h4>
              <pre className="p-4 rounded-xl bg-black border border-white/10 font-mono text-xs text-emerald-200 overflow-x-auto">
                <code>{activeEndpoint.responseShape}</code>
              </pre>
            </div>

            {/* Controller & Services */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-4 border-t border-white/10">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                <span className="text-zinc-500 block mb-1">Controller:</span>
                <span className="text-indigo-300 font-bold">{activeEndpoint.controller}</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                <span className="text-zinc-500 block mb-1">Service Logic:</span>
                <span className="text-indigo-300 font-bold">{activeEndpoint.service}</span>
              </div>
            </div>

            {/* Persists To */}
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs font-mono flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span className="text-zinc-400">Persists Data To:</span>
              <span className="text-purple-300 font-bold">{activeEndpoint.persistsTo.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
