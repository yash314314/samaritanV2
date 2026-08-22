import React, { useState } from 'react';
import { Sparkles, ArrowRight, Maximize2, ShieldCheck, Zap } from 'lucide-react';
import { Hero3DMockup } from './Hero3DMockup';

const SCREENSHOT_MODULES = [
  {
    id: 'overview',
    title: 'Home Command Center',
    badge: 'Live Ingestion',
    image: '/images/product/samaritan-dashboard-overview.png',
    caption: 'Active desktop window stream, duration-weighted focus curve, and interrupter notifications.'
  },
  {
    id: 'analytics',
    title: 'Analytics & Insights',
    badge: 'Focus Metrics',
    image: '/images/product/samaritan-analytics-insights.png',
    caption: 'Weekly focus trend breakdown, app distribution, and context switching Shannon entropy.'
  },
  {
    id: 'focus',
    title: 'Deep Work Sessions',
    badge: 'Enforcement Matrix',
    image: '/images/product/samaritan-deep-work-session.png',
    caption: 'Countdown/Pomodoro focus blocks with 4 enforcement levels and Web Audio ambient noise synthesis.'
  },
  {
    id: 'calendar',
    title: 'Notion-Style Calendar',
    badge: 'Timeblocking',
    image: '/images/product/samaritan-calendar-timeblocking.png',
    caption: 'Compact month/week/day calendar grid with light pastel event badges and focus auto-protection.'
  },
  {
    id: 'projects',
    title: 'Projects Workbench',
    badge: 'Rule Attribution',
    image: '/images/product/samaritan-projects-workbench.png',
    caption: 'Automated regex and title keyword project matching rules with unassigned review inbox.'
  }
];

export const HeroExperience: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState('overview');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const activeModule = SCREENSHOT_MODULES.find((m) => m.id === activeTabId) || SCREENSHOT_MODULES[0];

  return (
    <section id="hero" className="relative min-h-screen pt-36 pb-28 border-b border-white/10 overflow-hidden flex flex-col justify-center">
      {/* Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        {/* Editorial Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-mono font-bold uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            100% Local-First System
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono font-bold uppercase tracking-widest">
            <Zap className="w-4 h-4 text-emerald-400" />
            500ms Active Win32 Observer
          </span>
        </div>

        {/* Cinematic Kinetic Headline */}
        <div className="text-center max-w-4xl mx-auto mb-14">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
            YOUR TIME, <br />
            <span className="indigo-gradient-text">MADE VISIBLE.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            Samaritan observes active desktop windows every 500ms, computes duration-weighted focus metrics, enforces deep work protocols, and organizes your day—100% locally.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#day"
              className="px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 border border-indigo-400/30 transition-all hover:scale-105 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Explore Your Day
            </a>
            <a
              href="#focus"
              className="px-7 py-3.5 rounded-xl bg-[#08080c] hover:bg-[#12121c] text-zinc-200 font-bold text-sm border border-white/10 transition-all flex items-center gap-2"
            >
              Test Focus Protocol <ArrowRight className="w-4 h-4 text-indigo-400" />
            </a>
          </div>
        </div>

        {/* 3D Interactive Screen Frame Container */}
        <div className="mt-12 bg-[#08080c]/80 rounded-2xl border border-white/10 shadow-2xl p-4 sm:p-6 backdrop-blur-2xl">
          {/* Module Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b border-white/10 mb-6 scrollbar-none">
            {SCREENSHOT_MODULES.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setActiveTabId(mod.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  activeTabId === mod.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30 font-bold'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-white/5'
                }`}
              >
                {mod.title}
              </button>
            ))}
          </div>

          {/* Active Screen Info Header */}
          <div className="flex items-center justify-between gap-4 mb-4 px-2">
            <div>
              <span className="text-xs font-mono font-bold text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                {activeModule.badge}
              </span>
              <h3 className="text-lg font-bold text-white mt-1">{activeModule.title}</h3>
              <p className="text-xs text-zinc-400">{activeModule.caption}</p>
            </div>
            <button
              onClick={() => setFullscreenImage(activeModule.image)}
              className="p-2.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-white/10 flex items-center gap-1.5 text-xs font-mono"
            >
              <Maximize2 className="w-4 h-4" /> Full View
            </button>
          </div>

          {/* 3D Interactive Screen Mockup Frame */}
          <Hero3DMockup
            activeScreenId={activeModule.id}
            activeScreenTitle={activeModule.title}
            imageSrc={activeModule.image}
            onOpenModal={() => setFullscreenImage(activeModule.image)}
          />
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-7xl w-full bg-[#08080c] rounded-2xl border border-white/15 overflow-hidden shadow-2xl relative">
            <div className="bg-[#101018] px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-indigo-400 font-bold">
                Verified Samaritan Interface Capture
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
