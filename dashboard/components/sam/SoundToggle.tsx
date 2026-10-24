"use client";

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  isSamaritanAudioEnabled,
  playSamaritanBoot,
  setSamaritanAudioEnabled,
  subscribeSamaritanAudioPreferences,
} from "../../lib/samaritanAudio";

/**
 * Sidebar switch for all of Samaritan's audio. Muting silences everything at
 * once (the master bus drops to zero and the audio engine suspends);
 * unmuting answers with the core-online sequence.
 */
export default function SoundToggle() {
  const enabled = useSyncExternalStore(subscribeSamaritanAudioPreferences, isSamaritanAudioEnabled, () => true);

  const toggle = () => {
    const next = !enabled;
    setSamaritanAudioEnabled(next);
    // The engine resumes asynchronously; give it a moment before speaking.
    if (next) window.setTimeout(() => playSamaritanBoot(0.8), 90);
  };

  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Mute Samaritan audio" : "Unmute Samaritan audio"}
      title={enabled ? "Mute Samaritan audio" : "Unmute Samaritan audio"}
      data-sam-sound="off"
      className={`flex w-full items-center justify-center gap-3 px-4 py-2.5 text-[11px] uppercase tracking-[0.1em] transition-colors lg:justify-start ${
        enabled ? "text-key hover:text-trace" : "text-alert hover:text-signal"
      }`}
    >
      {/* Same reserved slot as the nav links, so the label lines up with them. */}
      <span className="hidden w-1.5 shrink-0 lg:inline-flex" aria-hidden />
      <Icon size={16} strokeWidth={1.5} className="shrink-0 lg:hidden" aria-hidden />
      <span className="hidden truncate lg:inline">{enabled ? "Sound" : "Muted"}</span>
      <Icon size={14} strokeWidth={1.5} className="ml-auto hidden shrink-0 lg:block" aria-hidden />
    </button>
  );
}
