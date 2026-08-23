"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Square, Shield, Sparkles, Zap } from "lucide-react";
import { focusApi } from "@/lib/api";
import { useLiveDeepWork } from "@/lib/useWs";
import AmbientSoundPlayer from "@/components/focus/AmbientSoundPlayer";

export default function WidgetPage() {
  const liveState = useLiveDeepWork();
  const [showSoundPlayer, setShowSoundPlayer] = useState(false);

  const plannedSeconds = (liveState.plannedMinutes || 25) * 60;
  const remainingSeconds = liveState.active
    ? Math.max(0, plannedSeconds - liveState.elapsedSeconds)
    : 0;

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndSession = async () => {
    if (!liveState.sessionId) return;
    try {
      await focusApi.end(liveState.sessionId, "completed");
    } catch (e) {
      console.error("Failed to end session:", e);
    }
  };

  const focusScore = liveState.focusScore || 85;

  return (
    <div className="w-[360px] h-[220px] bg-slate-950/90 text-slate-100 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex flex-col justify-between select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${liveState.active ? "bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" : "bg-slate-600"}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {liveState.active ? "Deep Work Active" : "Samaritan Focus HUD"}
          </span>
        </div>

        {/* Focus Score Gauge Badge */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-full text-xs font-semibold">
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span className="text-cyan-300">{Math.round(focusScore)}% Focus</span>
        </div>
      </div>

      {/* Main Timer & Goal View */}
      <div className="my-1 flex items-center justify-between">
        <div>
          <div className="text-4xl font-extrabold font-mono tracking-tight text-white drop-shadow-md">
            {liveState.active ? formatTime(remainingSeconds) : "00:00"}
          </div>
          <p className="text-xs text-slate-400 truncate max-w-[210px] mt-0.5">
            {liveState.goal || "Ready for deep focus work session"}
          </p>
        </div>

        {/* Ambient Audio Toggle */}
        <button
          onClick={() => setShowSoundPlayer(!showSoundPlayer)}
          className={`p-2.5 rounded-xl border transition-all ${
            showSoundPlayer
              ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
          title="Toggle Ambient Focus Sound"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      {/* Ambient Sound Expandable Drawer */}
      {showSoundPlayer && (
        <div className="absolute inset-0 bg-slate-950/95 p-3 rounded-2xl z-20 flex flex-col justify-between border border-cyan-500/30">
          <AmbientSoundPlayer autoPlay={true} sound="binaural_40hz" />
          <button
            onClick={() => setShowSoundPlayer(false)}
            className="w-full py-1 text-center text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Close Ambient Sound
          </button>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-900">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          <span className="capitalize">{liveState.enforcement || "observe"} mode</span>
        </div>

        <div className="flex items-center gap-2">
          {liveState.active ? (
            <button
              onClick={handleEndSession}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold transition-all"
            >
              <Square className="w-3 h-3 fill-current" /> End Session
            </button>
          ) : (
            <a
              href="/focus"
              className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-md shadow-cyan-500/20"
            >
              <Play className="w-3 h-3 fill-current" /> Start Session
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
