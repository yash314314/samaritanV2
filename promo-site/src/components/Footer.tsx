import React from 'react';
import { SamaritanLogo } from '../brand/SamaritanLogo';
import { ArrowUp } from 'lucide-react';

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="py-20 bg-[#030304] text-zinc-400 text-xs border-t border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top Loop Reassembly Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-8 rounded-2xl bg-[#08080c] border border-white/10 shadow-2xl">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <SamaritanLogo size={24} />
            </div>
            <p className="text-sm font-medium text-white mt-2">
              Local-First Desktop Productivity & Deep Work Engineering System
            </p>
            <p className="text-xs text-zinc-400">
              Zero cloud telemetry • 100% data ownership inside your local PostgreSQL datastore.
            </p>
          </div>

          <button
            onClick={scrollToTop}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/25 border border-indigo-400/30 transition-all flex items-center gap-2 shrink-0"
          >
            <ArrowUp className="w-4 h-4" /> Return To Top
          </button>
        </div>

        {/* Navigation Column Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 font-mono">
          <div>
            <h4 className="text-xs text-white font-bold uppercase mb-3">Core Experience</h4>
            <ul className="space-y-2">
              <li><a href="#hero" className="hover:text-indigo-400 transition-colors">00 Intro Core</a></li>
              <li><a href="#day" className="hover:text-indigo-400 transition-colors">01 Spatial Time Rail</a></li>
              <li><a href="#calendar" className="hover:text-indigo-400 transition-colors">02 Calendar Intelligence</a></li>
              <li><a href="#focus" className="hover:text-indigo-400 transition-colors">03 Deep Work Protocols</a></li>
              <li><a href="#insights" className="hover:text-indigo-400 transition-colors">04 Cognitive Insights</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs text-white font-bold uppercase mb-3">Local Environment</h4>
            <div className="space-y-2 text-zinc-500">
              <div>API Server: <span className="text-indigo-300">http://localhost:4000</span></div>
              <div>Dashboard UI: <span className="text-indigo-300">http://localhost:3000</span></div>
              <div>Static Site: <span className="text-indigo-300">http://localhost:4173</span></div>
              <div>Database: <span className="text-indigo-300">acpe_postgres:5432</span></div>
            </div>
          </div>

          <div>
            <h4 className="text-xs text-white font-bold uppercase mb-3">Privacy & Security</h4>
            <ul className="space-y-2 text-zinc-400 font-sans">
              <li>• 100% Offline Processing</li>
              <li>• Local Process Interception</li>
              <li>• Encrypted SQLite / Postgres</li>
              <li>• Zero Third-Party Analytics</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs text-white font-bold uppercase mb-3">System Runtime</h4>
            <div className="space-y-1.5 text-zinc-500">
              <div>Observer: Win32 API 500ms</div>
              <div>Broadcaster: WebSocket 100ms</div>
              <div>Audio Engine: HTML5 WebAudio</div>
              <div>Build: Vite + React 19 + R3F</div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-zinc-500">
          <div>© 2026 SamaritanV2 • Engineered for Focus & Deep Work</div>
          <div className="flex items-center gap-1">
            <span>Built with local precision for high-performance software engineers.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
