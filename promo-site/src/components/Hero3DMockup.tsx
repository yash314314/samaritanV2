import { useState, useRef } from 'react';
import { Maximize2, Sparkles } from 'lucide-react';

interface Hotspot {
  id: string;
  x: number;
  y: number;
  title: string;
  tag: string;
  description: string;
  formula?: string;
  metric?: string;
}

const HOTSPOTS: Record<string, Hotspot[]> = {
  overview: [
    {
      id: 'hs-stream',
      x: 12,
      y: 18,
      title: 'Live WebSocket Stream Indicator',
      tag: '500ms Sampling',
      description: 'Connected to ws://localhost:4000/ws. Displays live active window state in real-time with sub-second latency.',
      metric: 'Status: ONLINE (ws: true)'
    },
    {
      id: 'hs-hero-card',
      x: 35,
      y: 42,
      title: 'Active Session Hero Card',
      tag: 'Current State',
      description: 'Shows active window title, duration, category badge, and instant focus weight.',
      metric: 'Cursor IDE • 96% Focus Weight'
    },
    {
      id: 'hs-curve',
      x: 75,
      y: 32,
      title: 'Duration-Weighted Focus Curve',
      tag: 'Smoothing Engine',
      description: 'Smoothed time-series representation of attentional momentum and distraction decay over the session.',
      formula: 'F(t) = \\alpha F(t-1) + (1-\\alpha) W_{current}'
    },
    {
      id: 'hs-timeline',
      x: 50,
      y: 82,
      title: 'Timeline Ribbon',
      tag: 'Session Groups',
      description: 'Chronological timeline of completed sessions color-coded by category (productive green, distracting red, neutral blue).',
      metric: '7.8 Hours Tracked Today'
    }
  ],
  analytics: [
    {
      id: 'hs-trend',
      x: 30,
      y: 35,
      title: 'Weekly Focus Trend Chart',
      tag: 'Multi-Day Aggregation',
      description: 'Compares total tracked duration against productive deep work time across the past 7 days.',
      metric: 'Weekly Avg: 84% Productivity'
    },
    {
      id: 'hs-entropy',
      x: 82,
      y: 45,
      title: 'Context Switching Entropy',
      tag: 'Cognitive Fragmentation',
      description: 'Quantifies attentional fragmentation based on switch frequency and app distribution entropy.',
      formula: 'H(X) = -\\sum p(x_i) \\log_2 p(x_i)'
    }
  ],
  focus: [
    {
      id: 'hs-timer',
      x: 35,
      y: 40,
      title: 'Deep Work Session Timer Engine',
      tag: 'Pomodoro & Countdown',
      description: 'Authoritative backend timer state supporting custom focus, short break, and long break rounds.',
      metric: '25m Focus / 5m Break'
    },
    {
      id: 'hs-enforcement',
      x: 75,
      y: 50,
      title: 'Preemptive Process Blocker',
      tag: 'Enforcement Matrix',
      description: 'Electron local process control automatically terminates disallowed executables (e.g. taskkill /F).',
      metric: 'Level 4: BLOCK Active'
    }
  ]
};

interface Hero3DMockupProps {
  activeScreenId: string;
  activeScreenTitle: string;
  imageSrc: string;
  onOpenModal?: () => void;
}

export const Hero3DMockup: React.FC<Hero3DMockupProps> = ({
  activeScreenId,
  activeScreenTitle,
  imageSrc,
  onOpenModal
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glareX, setGlareX] = useState(50);
  const [glareY, setGlareY] = useState(50);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  const currentHotspots = HOTSPOTS[activeScreenId] || [];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotY = ((x - centerX) / centerX) * 8;
    const rotX = -((y - centerY) / centerY) * 8;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlareX((x / rect.width) * 100);
    setGlareY((y / rect.height) * 100);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlareX(50);
    setGlareY(50);
  };

  return (
    <div className="relative perspective-1000 my-4">
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transition: rotateX === 0 ? 'transform 0.5s ease-out' : 'none'
        }}
        className="relative rounded-2xl overflow-hidden border border-white/15 bg-[#0B0B0D] shadow-[0_20px_60px_rgba(139,92,246,0.25)] group cursor-crosshair transform-gpu"
      >
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.12) 0%, transparent 60%)`
          }}
        />

        <div className="bg-[#18181B] px-4 py-3 border-b border-white/10 flex items-center justify-between relative z-20">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-400 cursor-pointer" />
          </div>
          <div className="text-xs font-mono text-zinc-400 bg-black/50 px-6 py-1 rounded-md border border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            http://localhost:3000/{activeScreenId === 'overview' ? '' : activeScreenId}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-purple-300 font-mono hidden sm:inline-block bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              Interactive 3D View (Hover to Tilt)
            </span>
            {onOpenModal && (
              <button
                onClick={onOpenModal}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-mono hover:bg-white/5 px-2 py-1 rounded"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
              </button>
            )}
          </div>
        </div>

        <div className="relative aspect-[16/10] overflow-hidden bg-black">
          <img
            src={imageSrc}
            alt={`Samaritan UI - ${activeScreenTitle}`}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.01]"
          />

          {currentHotspots.map((hs) => (
            <div
              key={hs.id}
              style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
              className="absolute z-40 transform -translate-x-1/2 -translate-y-1/2 group/hs"
            >
              <button
                onClick={() => setActiveHotspot(activeHotspot?.id === hs.id ? null : hs)}
                onMouseEnter={() => setActiveHotspot(hs)}
                className="relative flex items-center justify-center w-7 h-7 rounded-full bg-purple-600/90 text-white border border-purple-300 shadow-xl hover:scale-125 transition-transform"
                aria-label={`Inspect ${hs.title}`}
              >
                <span className="absolute inset-0 rounded-full bg-purple-500 animate-ping opacity-75" />
                <Sparkles className="w-3.5 h-3.5 relative z-10" />
              </button>

              {activeHotspot?.id === hs.id && (
                <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 w-64 p-4 rounded-xl bg-[#0F0F12]/95 border border-purple-500/40 text-left shadow-2xl backdrop-blur-xl z-50 animate-fadeIn font-sans text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      {hs.tag}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveHotspot(null);
                      }}
                      className="text-zinc-500 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                  <h5 className="font-bold text-white text-xs mt-1">{hs.title}</h5>
                  <p className="text-zinc-400 text-[11px] mt-1 leading-relaxed">{hs.description}</p>
                  {hs.metric && (
                    <div className="mt-2 pt-2 border-t border-white/10 font-mono text-[10px] text-emerald-400 font-semibold">
                      {hs.metric}
                    </div>
                  )}
                  {hs.formula && (
                    <div className="mt-2 pt-2 border-t border-white/10 font-mono text-[10px] text-purple-300">
                      Formula: <code className="bg-black/60 px-1 py-0.5 rounded">{hs.formula}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
