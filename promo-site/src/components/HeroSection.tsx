import React, { useState } from 'react';
import { Hero3DCore } from './Hero3DCore';
import {
  Shield,
  Zap,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Hero3DMockup } from './Hero3DMockup';

interface HeroSectionProps {
  scrollProgress: number;
}

const MODULE_TABS = [
  {
    id: 'overview',
    title: 'Home Dashboard',
    badge: 'Live Ingestion',
    image: '/images/product/samaritan-dashboard-overview.png',
    desc: 'Displays active session stream, live focus curve, hero activity breakdown, and burnout warnings.'
  },
  {
    id: 'analytics',
    title: 'Analytics & Insights',
    badge: 'Focus Analytics',
    image: '/images/product/samaritan-analytics-insights.png',
    desc: 'Weekly focus trend breakdown, app distribution, intent classification, and Shannon entropy.'
  },
  {
    id: 'focus',
    title: 'Deep Work Sessions',
    badge: 'Enforcement Matrix',
    image: '/images/product/samaritan-deep-work-session.png',
    desc: 'Countdown/Pomodoro focus blocks with 4 enforcement levels and Web Audio rain/pink noise player.'
  },
  {
    id: 'projects',
    title: 'Projects Workbench',
    badge: 'Rule Attribution',
    image: '/images/product/samaritan-projects-workbench.png',
    desc: 'Automatic regex and title keyword matching rules with unassigned activity review inbox.'
  },
  {
    id: 'heatmap',
    title: 'Productivity Heatmap',
    badge: '24x7 Matrix',
    image: '/images/product/samaritan-productivity-heatmap.png',
    desc: '24x7 hourly focus intensity matrix revealing cognitive peak slots.'
  },
  {
    id: 'calendar',
    title: 'Calendar Overlays',
    badge: 'Notion Style',
    image: '/images/product/samaritan-calendar-timeblocking.png',
    desc: 'Notion-style compact calendar interface with light pastel event badges and focus auto-protection.'
  },
  {
    id: 'goals',
    title: 'Goals & Streaks',
    badge: 'Pace Forecasting',
    image: '/images/product/samaritan-goals-streaks.png',
    desc: 'Weekly focus duration goals, pace forecasts, and daily streak tracking.'
  }
];

export const HeroSection: React.FC<HeroSectionProps> = ({ scrollProgress }) => {
  const [activeTabId, setActiveTabId] = useState('overview');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const activeModule = MODULE_TABS.find((m) => m.id === activeTabId) || MODULE_TABS[0];

  return (
    <section id="hero" className="relative pt-32 pb-24 border-b border-white/10 bg-[#050507] overflow-hidden">
      {/* 3D WebGL Samaritan Core */}
      <Hero3DCore scrollProgress={scrollProgress} />

      {/* Ambient Radial Lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[550px] bg-indigo-600/15 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-mono font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            100% Local-First Datastore
          </span>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            500ms Active Sampling
          </span>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-mono font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Rize & RescueTime Inspired
          </span>
        </div>

        {/* Headline */}
        <div className="text-center max-w-4xl mx-auto mb-12">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
            Autonomous Desktop Activity Tracking &{' '}
            <span className="indigo-text-gradient">
              Deep Work System
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            Samaritan observes active desktop windows every 500ms, computes duration-weighted focus & entropy metrics, enforces 4-level deep work focus protocols, and categorizes activity—100% locally on your machine.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#workflows"
              className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 border border-indigo-400/30 transition-all hover:scale-105 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Try Live Workflows
            </a>
            <a
              href="#api"
              className="px-6 py-3.5 rounded-xl bg-[#0A0A0F] hover:bg-[#151520] text-zinc-200 font-bold text-sm border border-white/10 transition-all flex items-center gap-2"
            >
              Explore API Endpoints <ArrowRight className="w-4 h-4 text-indigo-400" />
            </a>
          </div>
        </div>

        {/* Interactive 3D Product Showcase Container */}
        <div className="mt-16 bg-[#0A0A0F]/90 rounded-2xl border border-white/10 shadow-2xl p-4 sm:p-6 backdrop-blur-xl">
          {/* Module Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none border-b border-white/10 mb-6">
            {MODULE_TABS.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setActiveTabId(mod.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  activeTabId === mod.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-400/30 font-bold'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-white/5'
                }`}
              >
                {mod.title}
              </button>
            ))}
          </div>

          {/* Active Screen Info Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 px-2">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-white">{activeModule.title}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {activeModule.badge}
                </span>
              </div>
              <p className="text-sm text-zinc-400 mt-1">{activeModule.desc}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Verified Samaritan UI Capture
            </div>
          </div>

          {/* 3D Interactive Mockup Component */}
          <Hero3DMockup
            activeScreenId={activeModule.id}
            activeScreenTitle={activeModule.title}
            imageSrc={activeModule.image}
            onOpenModal={() => setFullscreenImage(activeModule.image)}
          />
        </div>
      </div>

      {/* Fullscreen View Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-7xl w-full bg-[#0A0A0F] rounded-2xl border border-white/15 overflow-hidden shadow-2xl relative">
            <div className="bg-[#101018] px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-indigo-400 font-bold">
                Fullscreen Interface Capture
              </span>
              <button
                onClick={() => setFullscreenImage(null)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto bg-black p-4">
              <img src={fullscreenImage} alt="Fullscreen UI view" className="w-full h-auto rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
