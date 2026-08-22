import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

export const CalendarExperience: React.FC = () => {
  return (
    <section id="calendar" className="py-28 bg-[#08080c] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <CalendarIcon className="w-3.5 h-3.5" />
            Chapter 03 • Calendar Intelligence
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            TIME BECOMES CALENDAR.
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Floating activity blocks align into a compact Notion-style calendar grid, comparing scheduled calendar commitments against actual detected work.
          </p>
        </div>

        {/* Calendar Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="p-6 rounded-2xl bg-[#030304] border border-white/10 space-y-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <h3 className="text-base font-bold text-white">Notion-Style Pastel Pills</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Compact day cells with soft lavender focus blocks, teal meeting pills, and emerald project badges.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#030304] border border-white/10 space-y-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs">
              02
            </div>
            <h3 className="text-base font-bold text-white">Schedule vs Actual Drift</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Overlays calendar events with real-time active window signals to reveal meeting overruns and drift.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#030304] border border-white/10 space-y-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
              03
            </div>
            <h3 className="text-base font-bold text-white">Focus Auto-Protection</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Auto-configures process blocker protocols during scheduled focus blocks to guarantee deep work.
            </p>
          </div>
        </div>

        {/* Real Product Interface Screenshot Frame */}
        <div className="rounded-2xl border border-white/10 bg-[#0A0A0F] overflow-hidden shadow-2xl group">
          <div className="bg-[#101018] px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs font-mono text-zinc-400">samaritan-v2-calendar</span>
          </div>
          <div className="relative aspect-[16/10] bg-black">
            <img
              src="/images/product/samaritan-calendar-timeblocking.png"
              alt="Samaritan Notion-Style Calendar Interface"
              className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
