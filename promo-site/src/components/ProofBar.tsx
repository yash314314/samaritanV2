import React from 'react';
import { Activity, ShieldCheck, Zap, Database, Music, Radio } from 'lucide-react';
import { Motion3DSection } from './Motion3DSection';

interface MetricCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  detail: string;
  accent: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, value, label, detail, accent }) => (
  <div className="p-6 rounded-2xl bg-[#0B0B0D] border border-white/10 relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300 shadow-xl hover:-translate-y-1">
    <div className={`absolute top-0 right-0 w-24 h-24 ${accent} opacity-10 rounded-full blur-2xl group-hover:opacity-25 transition-opacity`} />
    <div className="flex items-center justify-between mb-4">
      <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-purple-300 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">Verified</span>
    </div>
    <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-mono">
      {value}
    </div>
    <div className="text-sm font-bold text-zinc-200 mt-1">{label}</div>
    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{detail}</p>
  </div>
);

export const ProofBar: React.FC = () => {
  const metrics = [
    {
      icon: <Activity className="w-5 h-5 text-purple-400" />,
      value: '500ms',
      label: 'Active Window Sampling',
      detail: 'Windows active-win observer captures window title, executable path, and domain url with sub-second resolution.',
      accent: 'bg-purple-500'
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-pink-400" />,
      value: '4 Modes',
      label: 'Deep Work Enforcement',
      detail: 'Observe, Warn, Require Reason, or Preemptively Block disallowed application window execution.',
      accent: 'bg-pink-500'
    },
    {
      icon: <Zap className="w-5 h-5 text-emerald-400" />,
      value: '120+',
      label: 'Pre-seeded Classifier Rules',
      detail: 'Multi-layer regex, application string, and title keyword pattern matchers with review inbox fallback.',
      accent: 'bg-emerald-500'
    },
    {
      icon: <Database className="w-5 h-5 text-blue-400" />,
      value: '100%',
      label: 'Local Database Storage',
      detail: 'Prisma ORM connected to PostgreSQL 15. Zero external server telemetry or cloud tracking data transmission.',
      accent: 'bg-blue-500'
    },
    {
      icon: <Music className="w-5 h-5 text-amber-400" />,
      value: 'Zero Assets',
      label: 'Procedural Web Audio Engine',
      detail: 'Generates ambient Rain, Pink, White, and Brown noise in real time directly using HTML5 Web Audio API nodes.',
      accent: 'bg-amber-500'
    },
    {
      icon: <Radio className="w-5 h-5 text-indigo-400" />,
      value: 'Sub-1ms',
      label: 'WebSocket Data Stream',
      detail: 'Monotonic sequence-checked WebSocket connection broadcasting live session score curves to the UI.',
      accent: 'bg-indigo-500'
    }
  ];

  return (
    <section className="py-20 bg-[#08080A] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Motion3DSection direction="up">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-purple-400 font-bold bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              Verified Technical Benchmarks
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3">
              Engineered for Speed, Privacy, and Control
            </h2>
          </div>
        </Motion3DSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics.map((m, idx) => (
            <Motion3DSection key={m.label} delay={idx * 0.1} direction={idx % 2 === 0 ? 'left' : 'right'}>
              <MetricCard {...m} />
            </Motion3DSection>
          ))}
        </div>
      </div>
    </section>
  );
};
