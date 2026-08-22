import React, { useState } from 'react';
import { FEATURE_MANIFEST } from '../data/featureManifest';
import type { SamaritanFeature } from '../data/featureManifest';
import { Layers, ChevronRight, Activity, Shield, BarChart3, Calendar, FolderGit2, Volume2 } from 'lucide-react';
import { DetailsDrawer } from './DetailsDrawer';
import { Floating3DImageCard } from './Floating3DImageCard';

const FEATURE_IMAGES: Record<string, { image: string; route: string; caption: string }> = {
  'active-observer': {
    image: '/images/product/samaritan-dashboard-overview.png',
    route: '/',
    caption: 'Realtime active window sampling every 500ms over local WebSocket stream.'
  },
  'enforcement-matrix': {
    image: '/images/product/samaritan-deep-work-session.png',
    route: '/focus',
    caption: '4-level deep work protocol enforcement matrix and process termination.'
  },
  'focus-entropy': {
    image: '/images/product/samaritan-analytics-insights.png',
    route: '/analytics',
    caption: 'Context switching Shannon entropy H(A) and duration-weighted focus analytics.'
  },
  'calendar-intelligence': {
    image: '/images/product/samaritan-calendar-timeblocking.png',
    route: '/calendar',
    caption: 'Notion-style calendar event overlays and focus auto-protection.'
  },
  'project-workbench': {
    image: '/images/product/samaritan-projects-workbench.png',
    route: '/projects',
    caption: 'Automated regex and keyword project time attribution workbench.'
  },
  'procedural-audio': {
    image: '/images/product/samaritan-focus.png',
    route: '/focus',
    caption: 'Procedural HTML5 Web Audio ambient noise generator with zero network overhead.'
  }
};

const ICON_MAP: Record<string, any> = {
  ingestion: Activity,
  analytics: BarChart3,
  enforcement: Shield,
  calendar: Calendar,
  projects: FolderGit2,
  goals: Volume2
};

export const FeatureUniverseSection: React.FC = () => {
  const [selectedFeature, setSelectedFeature] = useState<SamaritanFeature | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Capabilities' },
    { id: 'ingestion', label: 'Realtime Ingestion' },
    { id: 'enforcement', label: 'Deep Work Enforcement' },
    { id: 'analytics', label: 'Entropy Analytics' },
    { id: 'calendar', label: 'Calendar Overlays' },
    { id: 'projects', label: 'Project Rules' }
  ];

  const filteredFeatures =
    activeCategory === 'all'
      ? FEATURE_MANIFEST
      : FEATURE_MANIFEST.filter((f) => f.category === activeCategory);

  return (
    <section id="features" className="py-28 bg-[#050507] border-b border-white/10 relative overflow-hidden">
      {/* Ambient Radial Background Glow */}
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[350px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <Layers className="w-3.5 h-3.5" />
            Chapter 02 • Core Feature Universe & 3D Cards
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Interactive 3D Capabilities Universe
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Every feature below is derived directly from the verified Samaritan implementation. Hover over floating 3D cards to tilt, or click to inspect architectural data flows.
          </p>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                  activeCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Cards Spatial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredFeatures.map((feat) => {
            const IconComp = ICON_MAP[feat.category] || Activity;
            const visual = FEATURE_IMAGES[feat.id] || FEATURE_IMAGES['active-observer'];

            return (
              <div
                key={feat.id}
                className="p-5 rounded-2xl bg-[#0A0A0F] border border-white/10 hover:border-indigo-500/40 shadow-xl transition-all duration-300 flex flex-col justify-between space-y-4 min-w-0"
              >
                {/* Floating 3D Image Card for this Feature */}
                <Floating3DImageCard
                  title={feat.name}
                  route={visual.route}
                  badge={feat.badge}
                  imageSrc={visual.image}
                  description={visual.caption}
                  onOpenFullscreen={() => setFullscreenImage(visual.image)}
                />

                {/* Text Content */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-white/5 uppercase truncate min-w-0">
                      {feat.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white leading-snug break-words">
                    {feat.name}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans line-clamp-3">
                    {feat.summary}
                  </p>
                </div>

                {/* Inspect Implementation Action Button */}
                <button
                  type="button"
                  onClick={() => setSelectedFeature(feat)}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900/80 hover:bg-indigo-600/20 text-indigo-300 hover:text-white border border-white/10 hover:border-indigo-500/30 text-xs font-mono font-bold flex items-center justify-between transition-colors group"
                >
                  <span>Inspect Data Flow</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-indigo-400" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progressive Disclosure Details Drawer */}
      <DetailsDrawer feature={selectedFeature} onClose={() => setSelectedFeature(null)} />

      {/* Fullscreen Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-7xl w-full bg-[#08080C] rounded-2xl border border-white/15 overflow-hidden shadow-2xl relative">
            <div className="bg-[#101018] px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-indigo-400 font-bold">
                Samaritan Feature Capture
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
