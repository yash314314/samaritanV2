import React, { useState } from 'react';
import { CheckCircle2, Layers } from 'lucide-react';
import { Motion3DSection } from './Motion3DSection';
import { Floating3DImageCard } from './Floating3DImageCard';

interface Capability {
  id: string;
  title: string;
  badge: string;
  route: string;
  description: string;
  bullets: string[];
  image: string;
  reverse?: boolean;
}

const CAPABILITIES: Capability[] = [
  {
    id: 'stream',
    title: 'Realtime Ingestion & Duration-Weighted Focus Curve',
    badge: 'Foreground Observer',
    route: '/',
    description: 'Samples your active desktop window every 500ms using native Windows APIs. Calculates duration-weighted focus scores rather than unweighted binary percentages.',
    bullets: [
      'Active window title, app name, URL & process ID sampling',
      'System idle detection after 120-second inactivity baseline',
      'Instant distraction notifications when off-task app focus drops'
    ],
    image: '/images/product/samaritan-dashboard-overview.png'
  },
  {
    id: 'enforcement',
    title: '4-Level Deep Work Protocol Enforcement Matrix',
    badge: 'Process Blocker',
    route: '/focus',
    description: 'Protect your focus sessions with customizable enforcement modes. Preemptively terminates distracting applications when strict block mode is active.',
    bullets: [
      'Level 1 (Observe): Logs background activity without interruption',
      'Level 2 (Warn): Displays overlay toast when launching disallowed app',
      'Level 3 (Require Reason): Forces written explanation before access',
      'Level 4 (Block): Electron process control terminates process ID immediately'
    ],
    image: '/images/product/samaritan-deep-work-session.png',
    reverse: true
  },
  {
    id: 'entropy',
    title: 'Context Switching Entropy & Cognitive Load Analytics',
    badge: 'Cognitive Analytics',
    route: '/analytics',
    description: 'Quantifies attentional fragmentation based on switch frequency and app distribution entropy across daily work sessions.',
    bullets: [
      'Calculates Shannon entropy H(A) across active application windows',
      'Burnout risk predictor tracks continuous work without 10m recovery breaks',
      'Low-confidence classification review inbox for manual override'
    ],
    image: '/images/product/samaritan-analytics-insights.png'
  },
  {
    id: 'calendar',
    title: 'Notion-Style Calendar Overlays & Timeblocking Intelligence',
    badge: 'Calendar Intelligence',
    route: '/calendar',
    description: 'Compact Notion-style calendar interface featuring pastel event badges, schedule-vs-actual work comparison, and auto-protection focus blocks.',
    bullets: [
      'Compact grid layout with pastel lavender, cyan, and emerald badges',
      'Compares scheduled calendar events against actual detected activity',
      'Auto-protects open calendar focus blocks with enforced focus protocols'
    ],
    image: '/images/product/samaritan-calendar-timeblocking.png',
    reverse: true
  },
  {
    id: 'projects',
    title: 'Automated Rule-Based Project Time Attribution',
    badge: 'Project Workbench',
    route: '/projects',
    description: 'Automatic application, domain, and title keyword matching rules with weekly hour goal tracking and unassigned activity review inbox.',
    bullets: [
      'Regex & title keyword pattern matcher auto-assigns window ticks',
      'Weekly project hour targets with real-time percentage completion',
      'Unassigned review inbox for quick one-click attribution rules'
    ],
    image: '/images/product/samaritan-projects-workbench.png'
  },
  {
    id: 'heatmap',
    title: '24x7 Hourly Productivity & Focus Intensity Heatmap',
    badge: 'Cognitive Peak Slots',
    route: '/heatmap',
    description: 'Visual 24x7 matrix revealing hourly focus intensity, cognitive peak performance slots, and multi-day category allocation.',
    bullets: [
      '24 hours x 7 days intensity color grid with peak slot detection',
      'Hover inspection over any hour cell to view top app distribution',
      'Histograms mapping deep work duration against meeting fatigue'
    ],
    image: '/images/product/samaritan-productivity-heatmap.png',
    reverse: true
  },
  {
    id: 'goals',
    title: 'Weekly Focus Pace Forecasting & Daily Streaks',
    badge: 'Pace Forecast Engine',
    route: '/goals',
    description: 'Track weekly focus duration targets, session count benchmarks, project time allocations, and maintain daily deep work streaks.',
    bullets: [
      'Automatic pace forecasting estimating weekend completion target',
      'Streak counter rewarding consecutive days with >=4h deep focus',
      'Milestone achievement snapshots persisted in local database'
    ],
    image: '/images/product/samaritan-goals-streaks.png'
  }
];

export const FeaturesShowcase: React.FC = () => {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  return (
    <section id="capabilities" className="py-24 bg-[#050506] border-b border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Motion3DSection direction="up">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-purple-400 font-bold bg-purple-500/10 px-3.5 py-1 rounded-full border border-purple-500/20">
              <Layers className="w-3.5 h-3.5" />
              Core Technical Capabilities • All 7 Samaritan Modules
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-4 tracking-tight">
              Designed for Deep Engineering Workflows
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg mt-4">
              Every capability in Samaritan is grounded in verifiable local codebase implementation with floating 3D interactive previews.
            </p>
          </div>
        </Motion3DSection>

        <div className="space-y-24">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.id}
              className={`flex flex-col lg:flex-row items-center gap-12 ${
                cap.reverse ? 'lg:flex-row-reverse' : ''
              }`}
            >
              {/* Text Description */}
              <div className="flex-1 space-y-6 min-w-0">
                <Motion3DSection direction={cap.reverse ? 'right' : 'left'}>
                  <div className="min-w-0">
                    <span className="text-xs font-mono font-bold text-purple-400 uppercase bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20">
                      {cap.badge}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-3 leading-snug break-words">
                      {cap.title}
                    </h3>
                    <p className="text-zinc-400 text-sm sm:text-base mt-3 leading-relaxed font-sans">
                      {cap.description}
                    </p>
                  </div>

                  <ul className="space-y-3 pt-2">
                    {cap.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="min-w-0">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </Motion3DSection>
              </div>

              {/* 3D Interactive Floating Mockup Frame */}
              <div className="flex-1 w-full min-w-0">
                <Motion3DSection direction={cap.reverse ? 'left' : 'right'} delay={0.15}>
                  <Floating3DImageCard
                    title={cap.title}
                    route={cap.route}
                    badge={cap.badge}
                    imageSrc={cap.image}
                    onOpenFullscreen={() => setFullscreenImage(cap.image)}
                  />
                </Motion3DSection>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-7xl w-full bg-[#08080C] rounded-2xl border border-white/15 overflow-hidden shadow-2xl relative">
            <div className="bg-[#101018] px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-indigo-400 font-bold">
                Samaritan Technical Capability Interface Capture
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
