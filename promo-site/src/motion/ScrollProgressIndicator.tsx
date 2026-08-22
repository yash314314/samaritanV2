import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ScrollState } from './useScrollProgress';

interface ScrollProgressIndicatorProps {
  scrollState: ScrollState;
  chapterNames: Record<string, string>;
}

export const ScrollProgressIndicator: React.FC<ScrollProgressIndicatorProps> = ({
  scrollState,
  chapterNames
}) => {
  const percent = Math.round(scrollState.progress * 100);

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col items-end gap-3 pointer-events-none">
      {/* Chapter Name Badge */}
      <div className="px-3 py-1.5 rounded-xl bg-[#0A0A0F]/90 backdrop-blur-md border border-indigo-500/30 text-indigo-300 font-mono text-[10px] uppercase font-bold tracking-wider shadow-2xl flex items-center gap-2">
        {scrollState.direction === 'forward' ? (
          <ArrowDown className="w-3 h-3 text-indigo-400 animate-bounce" />
        ) : (
          <ArrowUp className="w-3 h-3 text-pink-400 animate-bounce" />
        )}
        <span>{chapterNames[scrollState.activeSection] || scrollState.activeSection}</span>
      </div>

      {/* Vertical Timeline Progress Bar */}
      <div className="w-1.5 h-36 bg-zinc-900/80 rounded-full overflow-hidden border border-white/10 relative">
        <div
          className="w-full bg-gradient-to-b from-indigo-500 via-indigo-400 to-pink-500 transition-all duration-150"
          style={{ height: `${percent}%` }}
        />
      </div>

      {/* Percentage Number */}
      <div className="font-mono text-xs font-bold text-zinc-400">
        {percent}%
      </div>
    </div>
  );
};
