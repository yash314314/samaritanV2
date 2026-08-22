import { useState } from 'react';
import { useScrollProgress } from './motion/useScrollProgress';
import { ScrollProgressIndicator } from './motion/ScrollProgressIndicator';
import { SamaritanWorldCanvas } from './experience/SamaritanWorldCanvas';
import { Navbar } from './components/Navbar';
import { HeroExperience } from './components/HeroExperience';
import { DayExperience } from './components/DayExperience';
import { FeatureUniverseSection } from './components/FeatureUniverseSection';
import { FeaturesShowcase } from './components/FeaturesShowcase';
import { CalendarExperience } from './components/CalendarExperience';
import { FocusExperience } from './components/FocusExperience';
import { InsightExperience } from './components/InsightExperience';
import { EndpointUniverseSection } from './components/EndpointUniverseSection';
import { WorkflowDemonstrator } from './components/WorkflowDemonstrator';
import { ScreenshotGallery } from './components/ScreenshotGallery';
import { TechStackSection } from './components/TechStackSection';
import { FAQSection } from './components/FAQSection';
import { TechnicalDrawer } from './components/TechnicalDrawer';
import { Footer } from './components/Footer';
import { CommandPalette } from './components/CommandPalette';

const SECTION_IDS = [
  'hero',
  'day',
  'features',
  'capabilities',
  'calendar',
  'focus',
  'insights',
  'api',
  'workflows',
  'screenshots',
  'tech',
  'faq'
];

const CHAPTER_NAMES: Record<string, string> = {
  hero: '00 Intro',
  day: '01 Your Day',
  features: '02 Features',
  capabilities: '03 Capabilities',
  calendar: '04 Calendar',
  focus: '05 Focus',
  insights: '06 Insights',
  api: '07 REST API',
  workflows: '08 Workflows',
  screenshots: '09 Gallery',
  tech: '10 Architecture',
  faq: '11 FAQ'
};

export function App() {
  const scrollState = useScrollProgress(SECTION_IDS);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTechDrawerOpen, setIsTechDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#030305] text-[#F5F5F7] selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
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
        <FeatureUniverseSection />
        <FeaturesShowcase />
        <CalendarExperience />
        <FocusExperience />
        <InsightExperience />
        <EndpointUniverseSection />
        <WorkflowDemonstrator />
        <ScreenshotGallery />
        <TechStackSection />
        <FAQSection />
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
