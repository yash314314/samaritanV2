"use client";

import { useEffect, useState, useLayoutEffect } from "react";
import { useTour } from "../context/TourContext";
import { X } from "lucide-react";
import { DecodeText } from "./sam/Decode";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function GuidedTour() {
  const { isActive, currentStep, steps, nextStep, prevStep, endTour } = useTour();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  const step = steps[currentStep];

  // Scroll the target into view once per step, then follow it: the layer is
  // position: fixed, so it tracks viewport coordinates through any scroll.
  useLayoutEffect(() => {
    if (!isActive || !step) return;
    const el = document.querySelector(step.target);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el?.getBoundingClientRect();
        setTargetRect(
          rect
            ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
            : { top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 180, width: 360, height: 180 }
        );
      });
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isActive, step]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isActive) endTour();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isActive, endTour]);

  if (!isActive || !targetRect) return null;

  const isLast = currentStep === steps.length - 1;
  const padding = 6;

  // Below the target when it fits, else above, else beside it (tall targets
  // such as the sidebar leave no room on either side vertically).
  const popoverWidth = Math.min(340, window.innerWidth - 32);
  const popoverHeight = 230;
  const gap = padding + 10;
  const below = targetRect.top + targetRect.height + gap;
  const above = targetRect.top - gap - popoverHeight;
  const clampLeft = (left: number) => Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, left));
  const clampTop = (top: number) => Math.max(16, Math.min(window.innerHeight - popoverHeight - 16, top));
  const popoverPosition =
    below + popoverHeight <= window.innerHeight
      ? { top: below, left: clampLeft(targetRect.left) }
      : above >= 16
        ? { top: above, left: clampLeft(targetRect.left) }
        : { top: clampTop(targetRect.top + 24), left: clampLeft(targetRect.left + targetRect.width + gap) };

  return (
    <div className="sam-ui fixed inset-0 z-[100] select-none" role="dialog" aria-modal="true" aria-labelledby="tour-step-title">
      {/* The spotlight's outer shadow dims everything except the target. */}
      <div
        className="pointer-events-none absolute border border-accent transition-all duration-300 ease-out motion-reduce:transition-none"
        style={{
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          boxShadow: "0 0 0 9999px color-mix(in srgb, var(--sam-void) 82%, transparent)",
        }}
      >
        <span className="absolute -left-px -top-px h-2.5 w-2.5 border-l-2 border-t-2 border-accent" />
        <span className="absolute -right-px -top-px h-2.5 w-2.5 border-r-2 border-t-2 border-accent" />
        <span className="absolute -bottom-px -left-px h-2.5 w-2.5 border-b-2 border-l-2 border-accent" />
        <span className="absolute -bottom-px -right-px h-2.5 w-2.5 border-b-2 border-r-2 border-accent" />
      </div>

      <div
        className="sam-lock absolute z-[110] border border-grid bg-void p-5 transition-all duration-300 ease-out motion-reduce:transition-none"
        style={{ width: popoverWidth, ...popoverPosition }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="sam-triangle h-2 w-2.5" aria-hidden />
            <span className="sam-key">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <button
            type="button"
            onClick={endTour}
            className="text-key transition-colors hover:text-signal"
            title="End tour (Esc)"
            aria-label="End tour"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <h3 id="tour-step-title" className="mt-4 font-display text-[15px] uppercase tracking-[0.06em] text-signal">
          {/* Remounted per step so each title resolves as the spotlight lands. */}
          <DecodeText key={currentStep} text={step.title} trigger="mount" underline={false} />
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-trace">{step.description}</p>

        <div className="mt-5 flex items-center justify-between border-t border-grid pt-4">
          <button type="button" onClick={endTour} className="text-[12px] text-key transition-colors hover:text-signal">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button type="button" onClick={prevStep} className="sam-button">
                Back
              </button>
            )}
            <button type="button" onClick={nextStep} className="sam-button" data-variant="primary">
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
