"use client";

import { useTour } from "../context/TourContext";
import { Sparkles } from "lucide-react";

export default function TourButton() {
  const { startTour, isActive } = useTour();

  return (
    <button
      onClick={startTour}
      disabled={isActive}
      className="flex items-center space-x-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800/80 hover:border-purple-600 px-3 py-1.5 rounded-lg transition shadow-sm shrink-0"
      title="Start SamaritanV2 Guided Tour"
    >
      <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
      <span>Tour</span>
    </button>
  );
}
