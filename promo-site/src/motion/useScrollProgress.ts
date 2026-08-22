import { useState, useEffect } from 'react';

export interface ScrollState {
  progress: number; // 0.0 to 1.0
  direction: 'forward' | 'backward';
  velocity: number;
  activeSection: string;
}

export function useScrollProgress(sectionIds: string[] = []): ScrollState {
  const [scrollState, setScrollState] = useState<ScrollState>({
    progress: 0,
    direction: 'forward',
    velocity: 0,
    activeSection: sectionIds[0] || 'hero'
  });

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let lastTimestamp = performance.now();

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const currentTimestamp = performance.now();

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.max(0, Math.min(1, maxScroll > 0 ? currentScrollY / maxScroll : 0));

      const deltaY = currentScrollY - lastScrollY;
      const deltaTime = currentTimestamp - lastTimestamp;
      const velocity = deltaTime > 0 ? Math.abs(deltaY / deltaTime) : 0;
      const direction: 'forward' | 'backward' = deltaY >= 0 ? 'forward' : 'backward';

      // Determine active chapter section
      let activeSection = sectionIds[0] || 'hero';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.4 && rect.bottom >= window.innerHeight * 0.2) {
            activeSection = id;
            break;
          }
        }
      }

      setScrollState({
        progress,
        direction,
        velocity,
        activeSection
      });

      lastScrollY = currentScrollY;
      lastTimestamp = currentTimestamp;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [sectionIds.join(',')]);

  return scrollState;
}
