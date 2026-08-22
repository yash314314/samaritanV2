import React from 'react';
import { SamaritanLogo } from '../brand/SamaritanLogo';
import { Search, Code2 } from 'lucide-react';

interface NavbarProps {
  activeSection: string;
  onOpenSearch: () => void;
  onToggleTechDrawer: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeSection, onOpenSearch, onToggleTechDrawer }) => {
  const navLinks = [
    { id: 'hero', label: 'Intro' },
    { id: 'day', label: 'Your Day' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'focus', label: 'Focus' },
    { id: 'insights', label: 'Insights' }
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#030304]/80 backdrop-blur-xl border-b border-white/10 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#hero" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <SamaritanLogo size={28} />
        </a>

        {/* Visual Chapter Links */}
        <nav className="hidden md:flex items-center gap-1 bg-[#08080c]/90 p-1.5 rounded-full border border-white/10">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeSection === link.id
                  ? 'bg-[#4f46e5] text-white shadow-lg shadow-indigo-500/30 font-bold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Under the Hood Technical Drawer Trigger */}
          <button
            onClick={onToggleTechDrawer}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold transition-all"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline-block">Under The Hood</span>
          </button>

          {/* Search Trigger */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#08080c] hover:bg-[#12121c] border border-white/10 text-zinc-400 hover:text-white text-xs transition-all"
          >
            <Search className="w-3.5 h-3.5 text-indigo-400" />
            <kbd className="hidden sm:inline-block font-mono text-[10px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
};
