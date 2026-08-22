import React, { useState } from 'react';
import { Calculator } from 'lucide-react';

interface FormulaCard {
  id: string;
  name: string;
  badge: string;
  summary: string;
  latexFormula: string;
  variables: { name: string; desc: string }[];
  deepExplanation: string;
  codeSnippet: string;
}

const FORMULAS: FormulaCard[] = [
  {
    id: 'focus-score',
    name: 'Duration-Weighted Focus Score Engine',
    badge: 'Realtime Metrics',
    summary: 'Calculates the overall attentional quality of a session by weighting activity duration against classified focus impact and confidence.',
    latexFormula: 'F_{session} = \\frac{\\sum_{i=1}^{N} \\Delta t_i \\cdot \\text{focusImpact}_i \\cdot \\text{confidence}_i}{\\sum_{i=1}^{N} \\Delta t_i}',
    variables: [
      { name: '\\Delta t_i', desc: 'Duration of activity interval i in seconds' },
      { name: '\\text{focusImpact}_i', desc: 'Classification focus weight from 0.0 (distracting) to 1.0 (deep focus)' },
      { name: '\\text{confidence}_i', desc: 'Classification engine certainty factor (0.0 to 1.0)' }
    ],
    deepExplanation:
      'Unlike simple percentage models that treat a 5-second Slack notification the same as 2 hours of VS Code coding, Samaritan weights every foreground observation interval by its duration and classifier confidence. Stale or short (<2s) observations are filtered automatically.',
    codeSnippet: `// api/src/services/metricsEngine.ts
const totalDuration = activities.reduce((acc, a) => acc + a.duration, 0);
const weightedFocusSum = activities.reduce((acc, a) => {
  return acc + (a.duration * (a.focusImpact ?? 0.5) * (a.confidence ?? 1.0));
}, 0);
const focusScore = totalDuration > 0 ? (weightedFocusSum / totalDuration) : 0;`
  },
  {
    id: 'entropy',
    name: 'Attentional Entropy & Fragmentation Index',
    badge: 'Context Switching',
    summary: 'Measures cognitive strain caused by rapid context switching across applications and window titles.',
    latexFormula: 'H(A) = -\\sum_{j=1}^{M} P(a_j) \\log_2 P(a_j) + \\lambda \\left( \\frac{S_{count}}{T_{hours}} \\right)',
    variables: [
      { name: 'P(a_j)', desc: 'Proportion of time spent in application j' },
      { name: 'S_{count}', desc: 'Total number of app/window switches in the session' },
      { name: '\\lambda', desc: 'Normalization scaling constant (default 0.15)' }
    ],
    deepExplanation:
      'High entropy indicates severe context fragmentation (e.g. switching between Slack, Twitter, Chrome, and VS Code every 40 seconds). Low entropy (<0.20) represents sustained, unbroken deep work state.',
    codeSnippet: `// Shannon Entropy + Switch Rate
const p = appDuration / totalDuration;
const shannonEntropy = -appDurations.reduce((sum, p) => sum + (p * Math.log2(p)), 0);
const switchRate = switchCount / (totalDuration / 3600);
const entropyScore = Math.min(1.0, (shannonEntropy / 3.0) + (0.15 * switchRate));`
  },
  {
    id: 'burnout',
    name: 'Burnout Risk & Sustained Load Predictor',
    badge: 'Cognitive Health',
    summary: 'Monitors sustained high-load work without adequate recovery gaps over 8-hour rolling windows.',
    latexFormula: 'B_{risk} = \\alpha \\cdot T_{continuous} + \\beta \\cdot \\text{Switch}_{pressure} - \\gamma \\cdot \\text{Break}_{recovery}',
    variables: [
      { name: 'T_{continuous}', desc: 'Continuous work duration without a minimum 10-minute idle/break recovery' },
      { name: '\\text{Switch}_{pressure}', desc: 'High entropy context-switching penalty' },
      { name: '\\text{Break}_{recovery}', desc: 'Cumulative recovery break duration credit' }
    ],
    deepExplanation:
      'Triggers smart recovery break warnings when continuous work exceeds 90 minutes or when distraction pressure remains high without cognitive downtime.',
    codeSnippet: `// Burnout Risk calculation
const continuousWorkMins = getContinuousWorkMinutes(userId);
const breakCredit = getRecoveryMinutesLast4Hours(userId);
const burnoutRisk = Math.min(1.0, (continuousWorkMins / 120) * 0.7 - (breakCredit / 30) * 0.3);`
  }
];

export const MathFormulasSection: React.FC = () => {
  const [activeFormulaId, setActiveFormulaId] = useState('focus-score');
  const activeItem = FORMULAS.find((f) => f.id === activeFormulaId) || FORMULAS[0];

  return (
    <section id="math" className="py-24 bg-[#08080A] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
            <Calculator className="w-3.5 h-3.5" />
            Mathematical Foundations
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Algorithmic Metric Formulations
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4">
            Samaritan replaces subjective self-reporting with precise mathematical algorithms for focus, entropy, and burnout risk.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {FORMULAS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveFormulaId(item.id)}
              className={`p-5 rounded-2xl text-left border transition-all ${
                activeFormulaId === item.id
                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-xl'
                  : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:bg-zinc-800/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {item.badge}
                </span>
              </div>
              <h4 className="font-bold text-sm text-white">{item.name}</h4>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{item.summary}</p>
            </button>
          ))}
        </div>

        <div className="bg-[#0B0B0D] rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-400 uppercase font-bold">
                  {activeItem.badge} Formula
                </span>
                <h3 className="text-2xl font-bold text-white mt-1">{activeItem.name}</h3>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{activeItem.deepExplanation}</p>
              </div>

              <div className="p-6 rounded-xl bg-black/80 border border-purple-500/30 text-purple-300 font-mono text-sm sm:text-base text-center shadow-inner overflow-x-auto">
                <div className="text-xs text-zinc-400 uppercase font-sans mb-2 font-bold tracking-wider">
                  Mathematical Representation
                </div>
                <code>{activeItem.latexFormula}</code>
              </div>

              <div className="space-y-2">
                <h5 className="text-xs font-mono text-zinc-300 uppercase font-bold">Variables & Factors:</h5>
                <div className="space-y-1.5">
                  {activeItem.variables.map((v, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs text-zinc-300 bg-zinc-900/60 p-2.5 rounded-lg border border-white/5">
                      <code className="font-mono text-purple-400 font-bold bg-black/40 px-1.5 py-0.5 rounded shrink-0">
                        {v.name}
                      </code>
                      <span className="mt-0.5">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/90 shadow-2xl h-full flex flex-col">
                <div className="bg-[#18181B] px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-xs font-mono text-zinc-400">
                    Source Code Implementation
                  </span>
                </div>
                <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto flex-1 bg-black/80">
                  <code>{activeItem.codeSnippet}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
