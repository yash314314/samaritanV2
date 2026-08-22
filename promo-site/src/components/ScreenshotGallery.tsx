import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { Motion3DSection } from './Motion3DSection';
import { Floating3DImageCard } from './Floating3DImageCard';

interface ScreenshotItem {
  id: string;
  title: string;
  category: 'core' | 'analytics' | 'focus' | 'desktop';
  image: string;
  caption: string;
  route: string;
  badge?: string;
}

const GALLERY: ScreenshotItem[] = [
  {
    id: 'overview',
    title: 'Home Command Center',
    category: 'core',
    image: '/images/product/samaritan-dashboard-overview.png',
    caption: 'Live active window state stream, duration-weighted focus curve, and interrupters.',
    route: '/',
    badge: 'Overview Route'
  },
  {
    id: 'analytics-insights',
    title: 'Analytics & Insights',
    category: 'analytics',
    image: '/images/product/samaritan-analytics-insights.png',
    caption: 'Weekly focus trends, application distribution, and context switching entropy.',
    route: '/analytics',
    badge: 'Analytics Route'
  },
  {
    id: 'deep-work',
    title: 'Deep Work Session',
    category: 'focus',
    image: '/images/product/samaritan-deep-work-session.png',
    caption: 'Pomodoro timer, 4 enforcement levels, and procedural rain noise generator.',
    route: '/focus',
    badge: 'Focus Protocol'
  },
  {
    id: 'projects',
    title: 'Projects Workbench',
    category: 'core',
    image: '/images/product/samaritan-projects-workbench.png',
    caption: 'Rule-based application and keyword time attribution and unassigned review inbox.',
    route: '/projects',
    badge: 'Projects Route'
  },
  {
    id: 'productivity-heatmap',
    title: 'Productivity Heatmap',
    category: 'analytics',
    image: '/images/product/samaritan-productivity-heatmap.png',
    caption: '24x7 matrix of focus intensity across every hour of the week.',
    route: '/heatmap',
    badge: 'Heatmap Matrix'
  },
  {
    id: 'calendar-timeblocking',
    title: 'Calendar Overlays',
    category: 'focus',
    image: '/images/product/samaritan-calendar-timeblocking.png',
    caption: 'Compact Notion-style calendar interface with light pastel event badges.',
    route: '/calendar',
    badge: 'Calendar Intelligence'
  },
  {
    id: 'goals-streaks',
    title: 'Goals & Pace Streaks',
    category: 'core',
    image: '/images/product/samaritan-goals-streaks.png',
    caption: 'Weekly focus duration targets, pace forecasts, and daily streak tracking.',
    route: '/goals',
    badge: 'Goals Engine'
  },
  {
    id: 'desktop-hero',
    title: 'Samaritan Win32 Desktop App',
    category: 'desktop',
    image: '/images/product/promo-site-desktop-hero.png',
    caption: 'Native Electron Win32 foreground observer frame running locally.',
    route: 'Desktop App',
    badge: 'Electron Shell'
  },
  {
    id: '3d-hero',
    title: '3D WebGL World View',
    category: 'desktop',
    image: '/images/product/promo-site-3d-hero.png',
    caption: 'Interactive spatial timeline with Three.js particle constellation.',
    route: '3D Engine',
    badge: 'Three.js Canvas'
  },
  {
    id: 'desktop-features',
    title: 'System Capabilities Workbench',
    category: 'desktop',
    image: '/images/product/promo-site-desktop-features.png',
    caption: 'Integrated system status bar and continuous background window sampler.',
    route: 'System View',
    badge: 'Win32 API'
  },
  {
    id: 'desktop-simulator',
    title: 'Interactive Simulator Panel',
    category: 'analytics',
    image: '/images/product/promo-site-desktop-simulator.png',
    caption: 'Live state simulator mutating window ticks and focus weight parameters.',
    route: 'Simulator',
    badge: 'Interactive Demo'
  },
  {
    id: 'mobile-view',
    title: 'Mobile Responsive View',
    category: 'desktop',
    image: '/images/product/promo-site-mobile-view.png',
    caption: 'Touch-optimized responsive dashboard for mobile devices.',
    route: 'Mobile Layout',
    badge: 'Responsive UI'
  }
];

export const ScreenshotGallery: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'core' | 'analytics' | 'focus' | 'desktop'>('all');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const filteredItems = filter === 'all' ? GALLERY : GALLERY.filter((item) => item.category === filter);

  return (
    <section id="screenshots" className="py-24 bg-[#08080A] border-b border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Motion3DSection direction="up">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              <Layers className="w-3.5 h-3.5" />
              Verified Interface Gallery • 3D Interactive Floating Cards
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
              Explore All Samaritan Modules & Interfaces
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg mt-4">
              All images below are captured directly from the running Samaritan system. Hover over any 3D card to tilt and interact.
            </p>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
              {(['all', 'core', 'analytics', 'focus', 'desktop'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold capitalize transition-all ${
                    filter === cat
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25 border border-purple-400/30'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  {cat === 'all' ? `All ${GALLERY.length} Interfaces` : `${cat} Interfaces`}
                </button>
              ))}
            </div>
          </div>
        </Motion3DSection>

        {/* Gallery Grid of Floating 3D Image Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item, idx) => (
            <Motion3DSection key={item.id} delay={idx * 0.05} direction="up">
              <div className="p-4 rounded-2xl bg-[#0B0B0D] border border-white/10 hover:border-purple-500/40 shadow-xl transition-all duration-300 flex flex-col justify-between space-y-3 min-w-0">
                <Floating3DImageCard
                  title={item.title}
                  route={item.route}
                  badge={item.badge}
                  imageSrc={item.image}
                  description={item.caption}
                  onOpenFullscreen={() => setFullscreenImage(item.image)}
                />

                {/* Non-Overflowing Metadata Footer */}
                <div className="px-1 pt-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                    <h4 className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors truncate min-w-0">
                      {item.title}
                    </h4>
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 shrink-0">
                      {item.route}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans line-clamp-2">
                    {item.caption}
                  </p>
                </div>
              </div>
            </Motion3DSection>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-6xl w-full bg-[#0B0B0D] rounded-2xl border border-white/15 overflow-hidden shadow-2xl relative">
            <div className="bg-[#18181B] px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-purple-400 font-bold">
                Verified Samaritan Route Interface
              </span>
              <button
                onClick={() => setFullscreenImage(null)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto bg-black p-4">
              <img
                src={fullscreenImage}
                alt="Fullscreen Samaritan Interface"
                className="w-full h-auto rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
