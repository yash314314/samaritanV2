"use client";

import { useState } from "react";
import { AudioLines } from "lucide-react";
import { focusApi } from "@/lib/api";
import { useLiveDeepWork } from "@/lib/useWs";
import AmbientSoundPlayer from "@/components/focus/AmbientSoundPlayer";
import { playSamaritanDismiss } from "@/lib/samaritanAudio";

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
    playSamaritanDismiss(1.0);
    try {
      await focusApi.end(liveState.sessionId, "completed");
    } catch (e) {
      console.error("Failed to end session:", e);
    }
  };

  // No reading without a live session: never show a made-up score.
  const focusScore = liveState.active && Number.isFinite(liveState.focusScore) ? Math.round(liveState.focusScore) : null;

  return (
    <div className="sam-ui relative flex h-[220px] w-[360px] select-none flex-col justify-between overflow-hidden border border-grid bg-void p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`sam-triangle h-2.5 w-3 ${liveState.active ? "sam-pulse" : "opacity-40"}`} aria-hidden />
          <span className="sam-key">{liveState.active ? "Deep work active" : "Focus HUD"}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="sam-key">Focus</span>
          <span className="sam-value">{focusScore ?? "--"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="sam-numeral text-[40px] leading-none">
            {liveState.active ? formatTime(remainingSeconds) : "00:00"}
          </div>
          <p className="mt-2 max-w-[220px] truncate text-key">
            {liveState.goal || "No session running."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSoundPlayer(!showSoundPlayer)}
          aria-pressed={showSoundPlayer}
          className="sam-button h-9 w-9 px-0"
          title="Ambient focus sound"
          aria-label="Ambient focus sound"
        >
          <AudioLines className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {showSoundPlayer && (
        <div className="absolute inset-0 z-20 flex flex-col justify-between border border-grid bg-void p-3">
          <AmbientSoundPlayer autoPlay={true} sound="binaural_40hz" />
          <button type="button" onClick={() => setShowSoundPlayer(false)} className="sam-button w-full">
            Close
          </button>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-grid pt-3">
        <span className="sam-key">{liveState.enforcement || "observe"} mode</span>
        {liveState.active ? (
          <button type="button" onClick={handleEndSession} className="sam-button" data-variant="danger">
            End session
          </button>
        ) : (
          <a href="/focus" className="sam-button" data-variant="primary">
            Start session
          </a>
        )}
      </div>
    </div>
  );
}
