"use client";

import { useEffect, useState, useLayoutEffect } from "react";
import { useTour } from "../context/TourContext";
import { Sparkles, ArrowRight, ArrowLeft, X, CheckCircle2 } from "lucide-react";

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

  const updateRect = () => {
    if (!isActive || !step) return;
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTargetRect({
        top: window.scrollY + window.innerHeight / 2 - 100,
        left: window.scrollX + window.innerWidth / 2 - 180,
        width: 360,
        height: 180,
      });
    }
  };

  useLayoutEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [isActive, currentStep]);

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

  const popoverTop = targetRect.top + targetRect.height + 16;
  const popoverLeft = Math.max(16, Math.min(window.innerWidth - 360, targetRect.left));

  return (
    <div className="fixed inset-0 z-[100] pointer-events-auto select-none">
      {/* Overlay: Blurs & Darkens everything else */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300" />

      {/* Projected Spotlight Cutout with Thin Purple Border Rectangle */}
      <div
        className="absolute transition-all duration-300 ease-out border-2 border-purple-500 rounded-xl pointer-events-none shadow-[0_0_30px_rgba(168,85,247,0.8)] bg-transparent"
        style={{
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 25px rgba(168, 85, 247, 0.7)",
        }}
      >
        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-purple-400 rounded-tl animate-pulse" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-purple-400 rounded-tr animate-pulse" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-purple-400 rounded-bl animate-pulse" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-purple-400 rounded-br animate-pulse" />
      </div>

      {/* Floating Description Popover Card */}
      <div
        className="absolute w-[320px] sm:w-[350px] bg-[#18181B] border border-purple-500/50 rounded-2xl p-5 shadow-2xl shadow-purple-950/60 space-y-4 transition-all duration-300 ease-out z-[110]"
        style={{
          top: Math.min(window.scrollY + window.innerHeight - 240, popoverTop),
          left: popoverLeft,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-purple-950 text-purple-400 rounded-lg border border-purple-800">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider font-mono">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <button
            onClick={endTour}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition text-xs"
            title="Skip Tour (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title & Body */}
        <div className="space-y-1">
          <h3 className="font-bold text-white text-base tracking-tight">{step.title}</h3>
          <p className="text-xs text-zinc-300 leading-relaxed">{step.description}</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            onClick={endTour}
            className="text-xs text-zinc-400 hover:text-zinc-200 hover:underline font-semibold"
          >
            Skip Tour
          </button>

          <div className="flex items-center space-x-2">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="px-3 py-1.5 rounded-xl bg-[#202024] hover:bg-[#27272A] text-zinc-300 text-xs font-semibold flex items-center space-x-1 border border-white/10 transition"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={nextStep}
              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-purple-600/30 transition"
            >
              <span>{isLast ? "Finish Tour" : "Next"}</span>
              {isLast ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
