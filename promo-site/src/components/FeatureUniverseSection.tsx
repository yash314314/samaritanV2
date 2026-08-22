import React, { useState } from 'react';
import { FEATURE_MANIFEST } from '../data/featureManifest';
import type { SamaritanFeature } from '../data/featureManifest';
import { Layers, ChevronRight, Activity, Shield, BarChart3, Calendar, FolderGit2, Volume2 } from 'lucide-react';
import { DetailsDrawer } from './DetailsDrawer';

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
    <section id="features" className="py-28 bg-[#050507] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <Layers className="w-3.5 h-3.5" />
            Chapter 02 • Core Feature Universe
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Interactive Capabilities Explorer
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Every feature below is derived directly from the verified Samaritan implementation. Click any capability node to inspect its architectural data flow.
          </p>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
            return (
              <div
                key={feat.id}
                onClick={() => setSelectedFeature(feat)}
                className="group p-6 rounded-2xl bg-[#0A0A0F] border border-white/10 hover:border-indigo-500/50 shadow-xl transition-all duration-300 transform-gpu hover:-translate-y-1.5 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-900 px-2 py-1 rounded border border-white/5 uppercase">
                      {feat.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {feat.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{feat.summary}</p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between text-xs font-mono text-indigo-400 font-semibold group-hover:text-indigo-300">
                  <span>Inspect Implementation</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progressive Disclosure Details Drawer */}
      <DetailsDrawer feature={selectedFeature} onClose={() => setSelectedFeature(null)} />
    </section>
  );
};
