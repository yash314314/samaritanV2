import { useState } from 'react';
import { useScrollProgress } from './motion/useScrollProgress';
import { ScrollProgressIndicator } from './motion/ScrollProgressIndicator';
import { SamaritanWorldCanvas } from './experience/SamaritanWorldCanvas';
import { Navbar } from './components/Navbar';
import { HeroExperience } from './components/HeroExperience';
import { DayExperience } from './components/DayExperience';
import { CalendarExperience } from './components/CalendarExperience';
import { FocusExperience } from './components/FocusExperience';
import { InsightExperience } from './components/InsightExperience';
import { TechnicalDrawer } from './components/TechnicalDrawer';
import { Footer } from './components/Footer';
import { CommandPalette } from './components/CommandPalette';

const SECTION_IDS = ['hero', 'day', 'calendar', 'focus', 'insights'];

const CHAPTER_NAMES: Record<string, string> = {
  hero: '00 Intro',
  day: '01 Your Day',
  calendar: '02 Calendar',
  focus: '03 Focus',
  insights: '04 Insights'
};

export function App() {
  const scrollState = useScrollProgress(SECTION_IDS);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTechDrawerOpen, setIsTechDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#030305] text-[#F5F5F7] selection:bg-indigo-500 selection:text-white relative">
      {/* Full-Screen Persistent 3D WebGL World */}
      <SamaritanWorldCanvas
        scrollProgress={scrollState.progress}
        activeSection={scrollState.activeSection}
      />

      {/* Sticky Visual Navbar */}
      <Navbar
        activeSection={scrollState.activeSection}
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleTechDrawer={() => setIsTechDrawerOpen(true)}
      />

      {/* Fixed Scrollytelling Progress Indicator */}
      <ScrollProgressIndicator
        scrollState={scrollState}
        chapterNames={CHAPTER_NAMES}
      />

      {/* Visual Product Narrative Chapters */}
      <main className="relative z-10">
        <HeroExperience />
        <DayExperience />
        <CalendarExperience />
        <FocusExperience />
        <InsightExperience />
      </main>

      {/* Narrative Closure Footer */}
      <Footer />

      {/* Search Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectFeature={() => {}}
      />

      {/* Optional "Under The Hood" Technical Deep Dive Drawer */}
      <TechnicalDrawer
        isOpen={isTechDrawerOpen}
        onClose={() => setIsTechDrawerOpen(false)}
      />
    </div>
  );
}

export default App;
