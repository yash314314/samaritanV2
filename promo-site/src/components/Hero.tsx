import React, { useState } from 'react';
import {
  Activity,
  Shield,
  Zap,
  CheckCircle2,
  Clock,
  Layers,
  Flame,
  Calendar,
  Target,
  Sparkles
} from 'lucide-react';
import { Hero3DCanvas } from './Hero3DCanvas';
import { Hero3DMockup } from './Hero3DMockup';

interface ProductScreen {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  image: string;
  description: string;
  badge: string;
}

const SCREENS: ProductScreen[] = [
  {
    id: 'overview',
    title: 'Home Dashboard',
    subtitle: 'Realtime Focus & Activity Command Center',
    icon: <Activity className="w-4 h-4" />,
    image: '/images/product/samaritan-dashboard-overview.png',
    description: 'Displays active session stream, live focus curve, hero activity breakdown, daily balance metrics, and interrupter warnings.',
    badge: 'Live WebSocket Ingestion'
  },
  {
    id: 'analytics',
    title: 'Analytics & Insights',
    subtitle: 'Deep Cognitive Metrics & Interrupters',
    icon: <Zap className="w-4 h-4" />,
    image: '/images/product/samaritan-analytics-insights.png',
    description: 'Weekly focus trend breakdown, application distribution, intent classification, context switching entropy, and burnout risk metrics.',
    badge: 'Weighted Focus Analytics'
  },
  {
    id: 'focus',
    title: 'Deep Work Sessions',
    subtitle: 'Enforced Focus & Ambient Web Audio',
    icon: <Flame className="w-4 h-4" />,
    image: '/images/product/samaritan-deep-work-session.png',
    description: 'Single countdown or Pomodoro cycles with 4 enforcement levels (Observe, Warn, Require Reason, Process Block) and rain/pink noise generator.',
    badge: '4 Enforcement Levels'
  },
  {
    id: 'projects',
    title: 'Projects Workbench',
    subtitle: 'Automated Rule-Based Time Attribution',
    icon: <Layers className="w-4 h-4" />,
    image: '/images/product/samaritan-projects-workbench.png',
    description: 'Automatic application, domain, and title keyword matching rules, weekly hour target tracking, and unassigned activity review inbox.',
    badge: 'Regex & Keyword Rules'
  },
  {
    id: 'heatmap',
    title: 'Productivity Heatmap',
    subtitle: 'Hourly & Daily Focus Distribution Grid',
    icon: <Clock className="w-4 h-4" />,
    image: '/images/product/samaritan-productivity-heatmap.png',
    description: 'Visual 24x7 matrix revealing peak cognitive hours, high-intensity focus slots, and historical category allocation per hour.',
    badge: 'Hourly Granularity'
  },
  {
    id: 'calendar',
    title: 'Calendar Overlays',
    subtitle: 'Scheduled Events vs Tracked Activity',
    icon: <Calendar className="w-4 h-4" />,
    image: '/images/product/samaritan-calendar-timeblocking.png',
    description: 'Import ICS calendars, overlay scheduled meetings against actual tracked focus blocks, and set focus protocols per calendar event.',
    badge: 'Timeblocking Intelligence'
  },
  {
    id: 'goals',
    title: 'Goals & Streaks',
    subtitle: 'Pace Forecasting & Milestone Streaks',
    icon: <Target className="w-4 h-4" />,
    image: '/images/product/samaritan-goals-streaks.png',
    description: 'Track weekly focus duration goals, project time allocations, session counts, and maintain daily streaks with automatic forecasts.',
    badge: 'Streak & Pace Engine'
  }
];

export const Hero: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const activeScreen = SCREENS.find((s) => s.id === activeTab) || SCREENS[0];

  return (
    <section className="relative pt-32 pb-24 overflow-hidden border-b border-white/5 bg-[#050506]">
      {/* 3D WebGL Background Canvas */}
      <Hero3DCanvas />

      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none animate-glow" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-semibold tracking-wide uppercase">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            Local-First Architecture
          </span>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold tracking-wide uppercase">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            500ms Active Sampling
          </span>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Rize & RescueTime Inspired
          </span>
        </div>

        {/* Headline */}
        <div className="text-center max-w-4xl mx-auto mb-12">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
            Autonomous Desktop Activity Tracking &{' '}
            <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
              Deep Work Engineering
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Samaritan observes active desktop windows, computes duration-weighted focus & burnout scores, enforces deep-work focus protocols, and categorizes activity—100% on your device.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#simulator"
              className="px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-base shadow-xl shadow-purple-600/25 border border-purple-400/30 transition-all hover:scale-105 flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-purple-200" />
              Try Live Engine Simulator
            </a>
            <a
              href="#screenshots"
              className="px-6 py-3.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 font-semibold text-base border border-white/10 transition-all hover:border-zinc-700 flex items-center gap-2"
            >
              View All 7 Modules
            </a>
          </div>
        </div>

        {/* Interactive 3D Screenshot Showcase Container */}
        <div className="mt-16 bg-[#0B0B0D]/90 rounded-2xl border border-white/10 shadow-2xl p-4 sm:p-6 backdrop-blur-xl">
          {/* Module Selection Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none border-b border-white/10 mb-6">
            {SCREENS.map((screen) => (
              <button
                key={screen.id}
                onClick={() => setActiveTab(screen.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${
                  activeTab === screen.id
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 border border-purple-400/30 font-bold'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-white/5'
                }`}
              >
                {screen.icon}
                {screen.title}
              </button>
            ))}
          </div>

          {/* Active Screen Info Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 px-2">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-white">{activeScreen.title}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {activeScreen.badge}
                </span>
              </div>
              <p className="text-sm text-zinc-400 mt-1">{activeScreen.description}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Verified Product Screenshot
            </div>
          </div>

          {/* 3D Interactive Mockup Component with Hotspots */}
          <Hero3DMockup
            activeScreenId={activeScreen.id}
            activeScreenTitle={activeScreen.title}
            imageSrc={activeScreen.image}
            onOpenModal={() => setFullscreenImage(activeScreen.image)}
          />
        </div>
      </div>

      {/* Fullscreen Image View Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-7xl w-full bg-[#0B0B0D] rounded-2xl border border-white/15 overflow-hidden shadow-2xl relative">
            <div className="bg-[#18181B] px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-purple-400 font-bold">
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
