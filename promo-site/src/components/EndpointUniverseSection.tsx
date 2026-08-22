import React, { useState } from 'react';
import { ENDPOINT_MANIFEST } from '../data/endpointManifest';
import type { ApiEndpoint } from '../data/endpointManifest';
import { Code2, Search, Lock, Database } from 'lucide-react';
import { Floating3DImageCard } from './Floating3DImageCard';

// Map endpoint domains to verified image captures
const DOMAIN_IMAGES: Record<string, { image: string; route: string; caption: string }> = {
  'Activity & Ingestion': {
    image: '/images/product/samaritan-dashboard-overview.png',
    route: '/api/activity/*',
    caption: '500ms Active Window Observer Stream and Real-time WebSocket Ingestion.'
  },
  'Analytics & Metrics': {
    image: '/images/product/samaritan-analytics-insights.png',
    route: '/api/analytics/*',
    caption: 'Context Switching Shannon Entropy H(X) and Duration-Weighted Focus Metrics.'
  },
  'Deep Work & Focus': {
    image: '/images/product/samaritan-deep-work-session.png',
    route: '/api/focus/*',
    caption: '4-Level Deep Work Protocol Enforcement Matrix and Process Interventions.'
  },
  'Calendar Intelligence': {
    image: '/images/product/samaritan-calendar-timeblocking.png',
    route: '/api/calendar/*',
    caption: 'Notion-Style Calendar Overlays, Timeblocking & Schedule vs Actual Drift.'
  },
  'Projects & Rules': {
    image: '/images/product/samaritan-projects-workbench.png',
    route: '/api/projects/*',
    caption: 'Automated Regex and Keyword Rule Time Attribution Workbench.'
  },
  'Goals & Streaks': {
    image: '/images/product/samaritan-goals-streaks.png',
    route: '/api/goals/*',
    caption: 'Weekly Focus Duration Target Pace Forecasts and Streak Tracking.'
  },
  'Webhooks & System': {
    image: '/images/product/promo-site-desktop-simulator.png',
    route: '/api/webhooks/*',
    caption: 'Local System Event Dispatcher and Realtime Inter-Process Webhook Stream.'
  }
};

export const EndpointUniverseSection: React.FC = () => {
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeEndpoint, setActiveEndpoint] = useState<ApiEndpoint>(ENDPOINT_MANIFEST[0]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

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
      ep.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.controller.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesMethod && matchesSearch;
  });

  const domainVisual = DOMAIN_IMAGES[activeEndpoint.domain] || DOMAIN_IMAGES['Activity & Ingestion'];

  return (
    <section id="api" className="py-28 bg-[#060609] border-b border-white/10 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <Code2 className="w-3.5 h-3.5" />
            Full Endpoints Coverage • All {ENDPOINT_MANIFEST.length} REST Routes
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            3D Interactive API & Endpoint Explorer
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Every Samaritan API endpoint is mapped to its live controller, JSON schema, Prisma database tables, and interactive 3D interface capture.
          </p>

          {/* Search & Method Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter path, purpose, controller..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/90 border border-white/10 text-white text-xs font-mono outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-white/10">
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

          {/* Domain Selection Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {domains.map((dom) => (
              <button
                key={dom}
                onClick={() => setSelectedDomain(dom)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  selectedDomain === dom
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {dom === 'all' ? 'All 7 Domains' : dom}
              </button>
            ))}
          </div>
        </div>

        {/* Master API Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Endpoint Selector List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
            {filteredEndpoints.map((ep) => (
              <button
                key={ep.id}
                onClick={() => setActiveEndpoint(ep)}
                className={`w-full p-4 rounded-2xl text-left border transition-all duration-300 transform-gpu hover:-translate-y-0.5 ${
                  activeEndpoint.id === ep.id
                    ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-xl shadow-indigo-600/10'
                    : 'bg-[#0A0A0F] border-white/10 text-zinc-400 hover:bg-zinc-900/80 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                      ep.method === 'GET'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : ep.method === 'POST'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : ep.method === 'PATCH'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 truncate min-w-0">{ep.domain}</span>
                </div>
                <div className="font-mono text-xs font-bold text-white truncate">{ep.path}</div>
                <div className="text-xs text-zinc-400 mt-1 line-clamp-1">{ep.purpose}</div>
              </button>
            ))}

            {filteredEndpoints.length === 0 && (
              <div className="p-8 text-center text-zinc-500 font-mono text-xs bg-[#0A0A0F] rounded-2xl border border-white/5">
                No REST endpoints match "{searchQuery}".
              </div>
            )}
          </div>

          {/* Endpoint Inspector & 3D Interactive Visual */}
          <div className="lg:col-span-7 space-y-6">
            {/* 3D Interactive Floating Image Card for Active Domain */}
            <Floating3DImageCard
              title={`${activeEndpoint.method} ${activeEndpoint.path}`}
              route={domainVisual.route}
              badge={activeEndpoint.domain}
              imageSrc={domainVisual.image}
              description={domainVisual.caption}
              onOpenFullscreen={() => setFullscreenImage(domainVisual.image)}
              hotspots={[
                {
                  id: 'hs-ep-controller',
                  x: 30,
                  y: 35,
                  title: 'Express Route Controller',
                  tag: 'Backend Layer',
                  description: `Controller file: ${activeEndpoint.controller}`,
                  metric: `Service: ${activeEndpoint.service}`
                },
                {
                  id: 'hs-ep-prisma',
                  x: 70,
                  y: 65,
                  title: 'Prisma Datastore Persistence',
                  tag: 'PostgreSQL Models',
                  description: `Persists data to Prisma models: ${activeEndpoint.persistsTo.join(', ')}`
                }
              ]}
            />

            {/* Endpoint Technical Inspector Panel */}
            <div className="bg-[#0A0A0F] rounded-2xl border border-white/10 p-6 shadow-2xl space-y-5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
                    {activeEndpoint.domain}
                  </span>
                  <div className="flex items-center gap-2.5 mt-1 min-w-0">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                      {activeEndpoint.method}
                    </span>
                    <h3 className="text-base font-bold text-white truncate min-w-0">
                      {activeEndpoint.path}
                    </h3>
                  </div>
                </div>

                {activeEndpoint.auth && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 shrink-0 font-bold">
                    <Lock className="w-3 h-3" /> Auth Token Required
                  </span>
                )}
              </div>

              <div>
                <span className="text-zinc-500 uppercase text-[10px] font-bold block mb-1">
                  Purpose & Behavior:
                </span>
                <p className="text-zinc-200 font-sans text-xs leading-relaxed">
                  {activeEndpoint.purpose}
                </p>
              </div>

              {activeEndpoint.requestShape && (
                <div>
                  <span className="text-indigo-400 uppercase text-[10px] font-bold block mb-1">
                    Request Payload Shape:
                  </span>
                  <pre className="p-3.5 rounded-xl bg-black border border-white/10 text-[11px] text-indigo-200 overflow-x-auto whitespace-pre-wrap break-all">
                    <code>{activeEndpoint.requestShape}</code>
                  </pre>
                </div>
              )}

              <div>
                <span className="text-emerald-400 uppercase text-[10px] font-bold block mb-1">
                  Response Payload JSON Shape:
                </span>
                <pre className="p-3.5 rounded-xl bg-black border border-white/10 text-[11px] text-emerald-200 overflow-x-auto whitespace-pre-wrap break-all">
                  <code>{activeEndpoint.responseShape}</code>
                </pre>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10">
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 min-w-0">
                  <span className="text-zinc-500 text-[10px] block mb-0.5">Route Controller File:</span>
                  <span className="text-indigo-300 font-bold truncate block">{activeEndpoint.controller}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 min-w-0">
                  <span className="text-zinc-500 text-[10px] block mb-0.5">Backend Service Logic:</span>
                  <span className="text-indigo-300 font-bold truncate block">{activeEndpoint.service}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-zinc-400">Prisma Models:</span>
                <span className="text-purple-300 font-bold truncate">{activeEndpoint.persistsTo.join(', ')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-7xl w-full bg-[#08080C] rounded-2xl border border-white/15 overflow-hidden shadow-2xl relative">
            <div className="bg-[#101018] px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-indigo-400 font-bold">
                Verified Samaritan Route Capture
              </span>
              <button
                onClick={() => setFullscreenImage(null)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto bg-black p-4">
              <img src={fullscreenImage} alt="Fullscreen Samaritan Interface" className="w-full h-auto rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
