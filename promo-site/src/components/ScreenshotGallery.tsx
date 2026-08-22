import React, { useState } from 'react';
import { Layers, Maximize2 } from 'lucide-react';
import { Motion3DSection } from './Motion3DSection';

interface ScreenshotItem {
  id: string;
  title: string;
  category: 'core' | 'analytics' | 'focus';
  image: string;
  caption: string;
  route: string;
}

const GALLERY: ScreenshotItem[] = [
  {
    id: 'overview',
    title: 'Home Command Center',
    category: 'core',
    image: '/images/product/samaritan-dashboard-overview.png',
    caption: 'Live active window state stream, duration-weighted focus curve, and interrupters.',
    route: '/'
  },
  {
    id: 'analytics',
    title: 'Analytics & Insights',
    category: 'analytics',
    image: '/images/product/samaritan-analytics-insights.png',
    caption: 'Weekly focus trends, application distribution, and context switching entropy.',
    route: '/analytics'
  },
  {
    id: 'focus',
    title: 'Deep Work Session',
    category: 'focus',
    image: '/images/product/samaritan-deep-work-session.png',
    caption: 'Pomodoro timer, 4 enforcement levels, and procedural rain noise generator.',
    route: '/focus'
  },
  {
    id: 'projects',
    title: 'Projects Workbench',
    category: 'core',
    image: '/images/product/samaritan-projects-workbench.png',
    caption: 'Rule-based application and keyword time attribution and unassigned review inbox.',
    route: '/projects'
  },
  {
    id: 'heatmap',
    title: 'Productivity Heatmap',
    category: 'analytics',
    image: '/images/product/samaritan-productivity-heatmap.png',
    caption: '24x7 matrix of focus intensity across every hour of the week.',
    route: '/heatmap'
  },
  {
    id: 'calendar',
    title: 'Calendar Overlays',
    category: 'focus',
    image: '/images/product/samaritan-calendar-timeblocking.png',
    caption: 'Compact Notion-style calendar interface with light pastel event badges.',
    route: '/calendar'
  },
  {
    id: 'goals',
    title: 'Goals & Streaks',
    category: 'core',
    image: '/images/product/samaritan-goals-streaks.png',
    caption: 'Weekly focus duration targets, pace forecasts, and daily streak tracking.',
    route: '/goals'
  }
];

export const ScreenshotGallery: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'core' | 'analytics' | 'focus'>('all');
  const [activeModalImage, setActiveModalImage] = useState<ScreenshotItem | null>(null);

  const filteredItems = filter === 'all' ? GALLERY : GALLERY.filter((item) => item.category === filter);

  return (
    <section id="screenshots" className="py-24 bg-[#08080A] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Motion3DSection direction="up">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              <Layers className="w-3.5 h-3.5" />
              Verified Interface Gallery
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
              Explore All 7 Samaritan Modules
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg mt-4">
              All images below are captured directly from the running local Samaritan system.
            </p>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
              {(['all', 'core', 'analytics', 'focus'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                    filter === cat
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25 border border-purple-400/30'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  {cat === 'all' ? 'All 7 Modules' : `${cat} Modules`}
                </button>
              ))}
            </div>
          </div>
        </Motion3DSection>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item, idx) => (
            <Motion3DSection key={item.id} delay={idx * 0.08} direction="up">
              <div
                onClick={() => setActiveModalImage(item)}
                className="group p-3 rounded-2xl bg-[#0B0B0D] border border-white/10 overflow-hidden shadow-xl cursor-pointer hover:border-purple-500/40 transition-all duration-300 transform-gpu hover:-translate-y-2"
              >
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-black mb-3">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-purple-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <span className="p-3 rounded-full bg-purple-600 text-white shadow-xl flex items-center gap-2 text-xs font-semibold">
                      <Maximize2 className="w-4 h-4" /> Full View
                    </span>
                  </div>
                </div>

                <div className="px-2 pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">
                      {item.title}
                    </h4>
                    <span className="text-[10px] font-mono text-zinc-500">{item.route}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.caption}</p>
                </div>
              </div>
            </Motion3DSection>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {activeModalImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-6xl w-full bg-[#0B0B0D] rounded-2xl border border-white/15 overflow-hidden shadow-2xl relative">
            <div className="bg-[#18181B] px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase text-purple-400 font-bold">
                  {activeModalImage.route}
                </span>
                <h3 className="text-lg font-bold text-white">{activeModalImage.title}</h3>
              </div>
              <button
                onClick={() => setActiveModalImage(null)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto bg-black p-4">
              <img
                src={activeModalImage.image}
                alt={activeModalImage.title}
                className="w-full h-auto rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
