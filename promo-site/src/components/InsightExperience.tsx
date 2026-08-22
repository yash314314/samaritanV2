import React from 'react';
import { BarChart3, TrendingUp, ShieldAlert, Layers } from 'lucide-react';

export const InsightExperience: React.FC = () => {
  return (
    <section id="insights" className="py-28 bg-[#08080c] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <BarChart3 className="w-3.5 h-3.5" />
            Chapter 05 • Cognitive Insights
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            EVERY TRACE BECOMES A PATTERN.
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Samaritan groups daily work activity into spatial clusters, quantifying context-switching Shannon entropy and burnout risk.
          </p>
        </div>

        {/* Insight Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="p-6 rounded-2xl bg-[#030304] border border-white/10 space-y-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 w-fit">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Duration-Weighted Focus Score</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Weights focus duration over raw binary time tracking to accurately compute deep productive work.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#030304] border border-white/10 space-y-4">
            <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 w-fit">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Context Switch Entropy H(A)</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Calculates Shannon entropy across active window switches to quantify attentional fragmentation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#030304] border border-white/10 space-y-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 w-fit">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Sustained Burnout Risk Index</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Monitors continuous focus sessions without 10m recovery breaks, alerting before fatigue sets in.
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
            <span className="text-xs font-mono text-zinc-400">samaritan-v2-analytics</span>
          </div>
          <div className="relative aspect-[16/10] bg-black">
            <img
              src="/images/product/samaritan-analytics-insights.png"
              alt="Samaritan Analytics & Cognitive Insights"
              className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
