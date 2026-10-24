"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DecodeText } from "./sam/Decode";

type SamaritanPromptProps = {
  // Short system statements, e.g. ["OBSERVING [kitty]", "FOCUS 06"].
  statements: string[];
  // Line under the triangle: what is being observed right now.
  caption?: string;
};

const PAUSE_FRAMES = [".", "..", "...", ""];

// Samaritan shows one statement at a time, then waits on a dot sequence
// before repeating: the lock screen's AWAITING CREDENTIALS cadence. Whole
// statements, not single words, so a value never appears without its label.
function buildFrames(statements: string[]) {
  return [...statements.filter(Boolean), ...PAUSE_FRAMES];
}

function frameDelay(frame: string) {
  if (PAUSE_FRAMES.includes(frame)) return 500;
  return 900 + Math.min(frame.length, 30) * 45;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export default function SamaritanPrompt({ statements, caption }: SamaritanPromptProps) {
  const frames = useMemo(() => buildFrames(statements), [statements]);
  const [index, setIndex] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );

  useEffect(() => {
    if (reducedMotion || frames.length === 0) return;
    const current = frames[index % frames.length];
    const timer = window.setTimeout(
      () => setIndex((value) => (value + 1) % frames.length),
      frameDelay(current)
    );
    return () => window.clearTimeout(timer);
  }, [frames, index, reducedMotion]);

  const word = reducedMotion ? statements[0] ?? "" : frames[index % frames.length] ?? "";

  return (
    <div className="flex flex-col items-center text-center">
      <p className="sr-only">{statements.join(". ")}</p>

      <div
        aria-hidden
        className="flex h-9 max-w-full items-end justify-center truncate font-display text-[22px] uppercase tracking-[0.06em] text-signal"
      >
        {/* Each statement types out behind the cursor, as on Samaritan's screens. */}
        <DecodeText key={index} text={word} trigger="mount" underline={false} />
      </div>

      <div aria-hidden className="mt-3 h-px w-56 bg-signal text-void" />
      <span aria-hidden className="sam-triangle sam-pulse mt-2" />

      {caption && (
        <div className="mt-5 max-w-[46ch] truncate text-[13px] text-trace" title={caption}>
          {caption}
        </div>
      )}
    </div>
  );
}
