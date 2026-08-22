import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Motion3DSection } from './Motion3DSection';

interface Capability {
  id: string;
  title: string;
  badge: string;
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
    description: 'Samples your active desktop window every 500ms using native Windows APIs. Calculates duration-weighted focus scores rather than unweighted percentages.',
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
    description: 'Protect your focus sessions with customizable enforcement modes. Preemptively terminates distracting applications when strict mode is active.',
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
    description: 'Quantifies attentional fragmentation based on switch frequency and app distribution entropy across daily work sessions.',
    bullets: [
      'Calculates Shannon entropy across active application windows',
      'Burnout risk predictor tracks continuous work without 10m recovery breaks',
      'Low-confidence classification review inbox for manual override'
    ],
    image: '/images/product/samaritan-analytics-insights.png'
  },
  {
    id: 'calendar',
    title: 'Notion-Style Calendar Overlays & Timeblocking Intelligence',
    badge: 'Calendar Intelligence',
    description: 'Compact Notion-style calendar interface featuring pastel event badges, schedule-vs-actual work comparison, and auto-protection focus blocks.',
    bullets: [
      'Compact grid layout with pastel purple, cyan, and emerald badges',
      'Compares scheduled calendar events against actual detected activity',
      'Auto-protects open calendar focus blocks with enforced focus protocols'
    ],
    image: '/images/product/samaritan-calendar-timeblocking.png',
    reverse: true
  }
];

export const FeaturesShowcase: React.FC = () => {
  return (
    <section id="capabilities" className="py-24 bg-[#050506] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Motion3DSection direction="up">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <span className="text-xs font-mono uppercase tracking-widest text-purple-400 font-bold bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              Core Technical Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-4 tracking-tight">
              Designed for Deep Engineering Workflows
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg mt-4">
              Every feature in Samaritan is grounded in verifiable codebase implementation.
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
              <div className="flex-1 space-y-6">
                <Motion3DSection direction={cap.reverse ? 'right' : 'left'}>
                  <div>
                    <span className="text-xs font-mono font-bold text-purple-400 uppercase bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20">
                      {cap.badge}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">
                      {cap.title}
                    </h3>
                    <p className="text-zinc-400 text-sm sm:text-base mt-3 leading-relaxed">
                      {cap.description}
                    </p>
                  </div>

                  <ul className="space-y-3 pt-2">
                    {cap.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </Motion3DSection>
              </div>

              {/* 3D Browser Mockup Frame */}
              <div className="flex-1 w-full">
                <Motion3DSection direction={cap.reverse ? 'left' : 'right'} delay={0.15}>
                  <div className="rounded-2xl border border-white/10 bg-[#0B0B0D] overflow-hidden shadow-2xl group hover:border-purple-500/30 transition-all duration-500 transform-gpu hover:scale-[1.02]">
                    <div className="bg-[#18181B] px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <span className="text-xs font-mono text-zinc-400">samaritan-v2-module</span>
                    </div>
                    <div className="relative aspect-[16/10] bg-black">
                      <img
                        src={cap.image}
                        alt={cap.title}
                        className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                  </div>
                </Motion3DSection>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
