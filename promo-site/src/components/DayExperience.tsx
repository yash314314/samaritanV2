import React, { useState } from 'react';
import { Activity, Clock } from 'lucide-react';

interface ActivityItem {
  id: string;
  name: string;
  category: string;
  duration: string;
  focusScore: number;
  intent: 'productive' | 'distracting' | 'neutral';
  windowTitle: string;
  color: string;
}

const DAY_ACTIVITIES: ActivityItem[] = [
  {
    id: 'cursor',
    name: 'Cursor IDE',
    category: 'coding',
    duration: '4h 15m',
    focusScore: 96,
    intent: 'productive',
    windowTitle: 'samaritanV2/api/src/services/metricEngine.ts',
    color: 'from-indigo-500/30 to-indigo-600/10 border-indigo-500/40 text-indigo-300'
  },
  {
    id: 'figma',
    name: 'Figma',
    category: 'design',
    duration: '2h 10m',
    focusScore: 88,
    intent: 'productive',
    windowTitle: 'Samaritan V2 UI System & Component Tokens',
    color: 'from-pink-500/30 to-pink-600/10 border-pink-500/40 text-pink-300'
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    category: 'social_media',
    duration: '25m',
    focusScore: 15,
    intent: 'distracting',
    windowTitle: 'Twitter / X — Live Tech Feed',
    color: 'from-amber-500/30 to-amber-600/10 border-amber-500/40 text-amber-300'
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    duration: '50m',
    focusScore: 45,
    intent: 'neutral',
    windowTitle: '#engineering — Architecture RFC Discussion',
    color: 'from-cyan-500/30 to-cyan-600/10 border-cyan-500/40 text-cyan-300'
  }
];

export const DayExperience: React.FC = () => {
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem>(DAY_ACTIVITIES[0]);

  return (
    <section id="day" className="py-28 bg-[#030304] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <Activity className="w-3.5 h-3.5" />
            Chapter 02 • Spatial Time Rail
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            YOUR DAY IS NOT A LIST. <br />
            <span className="indigo-gradient-text">IT'S A SHAPE.</span>
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Samaritan samples active desktop windows every 500ms, mapping continuous focus quality into floating 3D temporal blocks.
          </p>
        </div>

        {/* Spatial Activity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {DAY_ACTIVITIES.map((act) => (
            <div
              key={act.id}
              onClick={() => setSelectedActivity(act)}
              className={`p-6 rounded-2xl border bg-gradient-to-b ${act.color} transition-all duration-300 transform-gpu hover:-translate-y-2 cursor-pointer shadow-xl flex flex-col justify-between ${
                selectedActivity.id === act.id ? 'ring-2 ring-indigo-500 shadow-indigo-500/20' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    {act.category}
                  </span>
                  <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {act.duration}
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-white">{act.name}</h3>
                <p className="text-xs text-zinc-400 mt-2 font-mono truncate">{act.windowTitle}</p>
              </div>

              <div className="pt-4 mt-6 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400">Focus Weight:</span>
                <span className="text-sm font-bold font-mono text-white">{act.focusScore}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Active Window Observation Detail Card */}
        <div className="mt-10 p-6 rounded-2xl bg-[#08080c] border border-white/10 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase text-indigo-400">
                Selected Active Window Observation:
              </span>
              <span className="text-xs font-mono text-white font-bold">{selectedActivity.name}</span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">{selectedActivity.windowTitle}</p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-xs font-mono text-zinc-500">Duration Tracked</div>
              <div className="text-lg font-bold font-mono text-indigo-300">{selectedActivity.duration}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-zinc-500">Intent Score</div>
              <div className="text-lg font-bold font-mono text-emerald-400">{selectedActivity.focusScore}%</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
