"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useAppearance } from "../../context/AppearanceContext";
import { DecodeText } from "../../components/sam/Decode";
import SecurityPanel from "../../components/settings/SecurityPanel";
import {
  ACCENTS,
  CATEGORIES,
  FONTS,
  PALETTES,
  THEMES,
  type AccentId,
  type FontId,
  type PaletteId,
  type ThemeId,
} from "../../lib/appearance";
import {
  isSamaritanAudioEnabled,
  setSamaritanAudioEnabled,
  getSamaritanAudioVolume,
  setSamaritanAudioVolume,
  subscribeSamaritanAudioPreferences,
  isSamaritanAmbientEnabled,
  setSamaritanAmbientEnabled,
  isSamaritanInterfaceSoundEnabled,
  setSamaritanInterfaceSoundEnabled,
  playSamaritanAcquire,
  playSamaritanBoot,
  playSamaritanRatchet,
  playSamaritanScanSweep,
  playSamaritanToggle,
  playSamaritanRev,
  playSamaritanLock,
  playSamaritanDialogSequence,
  playSamaritanThreatAlert,
  playSamaritanDismiss,
  playSamaritanTypeTick,
} from "../../lib/samaritanAudio";
import { Volume2, VolumeX, Play, ShieldAlert, Radio, Disc } from "lucide-react";

const PREVIEW_TIMELINE: { category: (typeof CATEGORIES)[number]; share: number }[] = [
  { category: "deep_work", share: 18 },
  { category: "development_tools", share: 14 },
  { category: "research", share: 9 },
  { category: "communication", share: 7 },
  { category: "deep_work", share: 12 },
  { category: "entertainment", share: 6 },
  { category: "productivity", share: 8 },
  { category: "media", share: 5 },
  { category: "system", share: 4 },
  { category: "idle", share: 10 },
  { category: "unknown", share: 7 },
];

function OptionGroup({ legend, help, children }: { legend: string; help: string; children: ReactNode }) {
  return (
    <fieldset className="sam-rule pt-6">
      <legend className="sam-head float-left w-full">{legend}</legend>
      <p className="clear-both mb-5 pt-2 max-w-[60ch] text-[12px] text-key">{help}</p>
      {children}
    </fieldset>
  );
}

// A radio option rendered as a square tile; the native input keeps arrow-key
// navigation and screen-reader semantics.
function OptionTile({
  name,
  value,
  checked,
  onSelect,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`relative block cursor-pointer border p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal ${
        checked ? "border-signal" : "border-grid hover:border-control"
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      {checked && <span className="sam-triangle absolute right-2 top-2 h-2 w-2.5" aria-hidden />}
      {children}
    </label>
  );
}

export default function SettingsPage() {
  const { appearance, setAppearance, resetAppearance, saveState, saveError } = useAppearance();
  // The prerendered page has no localStorage, so it renders the defaults
  // and the stored preference takes over after hydration.
  const audioEnabled = useSyncExternalStore(subscribeSamaritanAudioPreferences, isSamaritanAudioEnabled, () => true);
  const audioVolume = useSyncExternalStore(subscribeSamaritanAudioPreferences, getSamaritanAudioVolume, () => 0.28);
  const ambientEnabled = useSyncExternalStore(subscribeSamaritanAudioPreferences, isSamaritanAmbientEnabled, () => true);
  const interfaceEnabled = useSyncExternalStore(subscribeSamaritanAudioPreferences, isSamaritanInterfaceSoundEnabled, () => true);

  const handleToggleAudio = (enabled: boolean) => {
    setSamaritanAudioEnabled(enabled);
    if (enabled) playSamaritanLock(0.9);
  };

  const handleVolumeChange = (vol: number) => {
    setSamaritanAudioVolume(vol);
  };

  const mode = THEMES[appearance.theme].mode;
  const isDefault =
    appearance.theme === "samaritan-dark" &&
    appearance.accent === "red" &&
    appearance.palette === "spectrum" &&
    appearance.font === "samaritan";

  const status =
    saveState === "saving"
      ? "Saving"
      : saveState === "error"
        ? saveError
        : saveState === "saved"
          ? "Saved to your profile. The desktop app and other open windows follow these settings."
          : "Changes are saved to your profile automatically, so the desktop app follows them.";

  return (
    <div className="sam-ui dashboard-surface">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="sam-title">
            <DecodeText text="Settings" />
          </h1>
          <p className="mt-2 text-[12px] text-key">Appearance changes apply immediately.</p>
        </div>
        <button type="button" className="sam-button" onClick={resetAppearance} disabled={isDefault}>
          Reset to defaults
        </button>
      </div>

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <OptionGroup legend="Theme" help="Sets the ground, the ink and the status colours for every page.">
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                const theme = THEMES[id];
                const t = theme.tokens;
                return (
                  <OptionTile key={id} name="theme" value={id} checked={appearance.theme === id} onSelect={() => setAppearance({ theme: id })}>
                    {/* Miniature drawn in the theme's own colours, not the current ones. */}
                    <div className="mb-3 flex h-20 flex-col items-center justify-center border" style={{ background: t.void, borderColor: t.grid }} aria-hidden>
                      <div className="h-px w-16" style={{ background: t.signal }} />
                      <div className="mt-1.5 h-2 w-2.5" style={{ background: ACCENTS[appearance.accent][theme.mode], clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
                      <div className="mt-2 flex gap-1">
                        <span className="h-1 w-6" style={{ background: t.trace }} />
                        <span className="h-1 w-4" style={{ background: t.key }} />
                        <span className="h-1 w-3" style={{ background: t.alert }} />
                      </div>
                    </div>
                    <div className="text-signal">{theme.label}</div>
                    <div className="mt-1 text-[11px] text-key">{theme.description}</div>
                  </OptionTile>
                );
              })}
            </div>
          </OptionGroup>

          <OptionGroup
            legend="Accent"
            help="Marks Samaritan's presence: the triangle, the current page and your selections. Warnings and danger readings keep their own colours."
          >
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {(Object.keys(ACCENTS) as AccentId[]).map((id) => (
                <OptionTile key={id} name="accent" value={id} checked={appearance.accent === id} onSelect={() => setAppearance({ accent: id })}>
                  <div className="mb-3 h-8 border border-grid" style={{ background: ACCENTS[id][mode] }} aria-hidden />
                  <div className="truncate text-[11px] text-signal">{ACCENTS[id].label}</div>
                </OptionTile>
              ))}
            </div>
          </OptionGroup>

          <OptionGroup legend="Category colours" help="Used on the timeline, charts and legends to tell activity categories apart.">
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(PALETTES) as PaletteId[]).map((id) => {
                const palette = PALETTES[id];
                return (
                  <OptionTile key={id} name="palette" value={id} checked={appearance.palette === id} onSelect={() => setAppearance({ palette: id })}>
                    <div className="mb-3 flex h-6 gap-px" aria-hidden>
                      {CATEGORIES.map((category) => (
                        <span key={category} className="flex-1" style={{ background: palette[mode][category] }} />
                      ))}
                    </div>
                    <div className="text-signal">{palette.label}</div>
                    <div className="mt-1 text-[11px] text-key">{palette.description}</div>
                  </OptionTile>
                );
              })}
            </div>
          </OptionGroup>

          <OptionGroup legend="Typeface" help="Applies to every page. Samaritan uses the faces of the show's interface.">
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(FONTS) as FontId[]).map((id) => {
                const font = FONTS[id];
                return (
                  <OptionTile key={id} name="font" value={id} checked={appearance.font === id} onSelect={() => setAppearance({ font: id })}>
                    <div className="mb-2 text-[20px] uppercase leading-none tracking-[0.06em] text-signal" style={{ fontFamily: font.display, fontWeight: Number(font.displayWeight) }}>
                      {font.label}
                    </div>
                    <div className="mb-2 text-[13px] text-trace" style={{ fontFamily: font.text }}>
                      Observing [kitty] 01:02:18
                    </div>
                    <div className="text-[11px] text-key">{font.description}</div>
                  </OptionTile>
                );
              })}
            </div>
          </OptionGroup>

          <OptionGroup
            legend="Audio Telemetry"
            help="Clinical surveillance audio and mechanical reticle telemetry synthesized in real time via Web Audio."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border border-grid bg-void p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleAudio(!audioEnabled)}
                    className={`flex h-9 w-9 items-center justify-center border transition-colors ${
                      audioEnabled ? "border-alert bg-alert/15 text-alert" : "border-grid text-key hover:text-trace"
                    }`}
                    aria-label={audioEnabled ? "Mute audio" : "Enable audio"}
                  >
                    {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                  <div>
                    <div className="font-mono text-xs font-bold uppercase text-signal">
                      {audioEnabled ? "Telemetry Online" : "Telemetry Muted"}
                    </div>
                    <div className="text-[11px] text-key">
                      {audioEnabled ? "Real-time mechanical synthesis active" : "Audio synthesis disabled"}
                    </div>
                  </div>
                </div>

                <div className="flex min-w-[200px] items-center gap-3">
                  <span className="font-mono text-[10px] uppercase text-key">Master Gain</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audioVolume}
                    disabled={!audioEnabled}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="min-w-0 flex-1 accent-alert"
                    aria-label="Master audio volume"
                  />
                  <span className="w-10 text-right font-mono text-xs text-signal">
                    {Math.round(audioVolume * 100)}%
                  </span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    label: "Ambient presence",
                    detail: "Mainframe hum, idle scan sweeps and the servo that follows your cursor",
                    on: ambientEnabled,
                    set: setSamaritanAmbientEnabled,
                  },
                  {
                    label: "Interface sounds",
                    detail: "Hover acquisition, presses, typing, scrolling and toggles",
                    on: interfaceEnabled,
                    set: setSamaritanInterfaceSoundEnabled,
                  },
                ].map((layer) => (
                  <button
                    key={layer.label}
                    type="button"
                    role="switch"
                    aria-checked={layer.on}
                    disabled={!audioEnabled}
                    onClick={() => layer.set(!layer.on)}
                    className={`flex items-start gap-3 border p-3 text-left transition-colors disabled:opacity-40 ${
                      layer.on ? "border-signal" : "border-grid hover:border-control"
                    }`}
                  >
                    <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 border ${layer.on ? "border-alert bg-alert" : "border-key"}`} aria-hidden />
                    <span>
                      <span className="block font-mono text-[11px] uppercase text-signal">{layer.label}</span>
                      <span className="block text-[11px] text-key">{layer.detail}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div>
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-key">
                  Sound Signature Audition
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => playSamaritanRev(1.1)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Turbine Rev</span>
                    <Play size={11} className="shrink-0 text-alert" />
                  </button>

                  <button
                    type="button"
                    onClick={() => playSamaritanLock(1.1)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Reticle Lock</span>
                    <Disc size={11} className="shrink-0 text-signal" />
                  </button>

                  <button
                    type="button"
                    onClick={() => playSamaritanDialogSequence(1.0)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                    data-variant="primary"
                  >
                    <span className="truncate font-mono text-[11px]">Aperture Unfold</span>
                    <Play size={11} className="shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => playSamaritanThreatAlert(1.0)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Threat Directive</span>
                    <ShieldAlert size={11} className="shrink-0 text-alert" />
                  </button>

                  <button
                    type="button"
                    onClick={() => playSamaritanDismiss(1.0)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Hydraulic Dismiss</span>
                    <Radio size={11} className="shrink-0 text-key" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      for (let i = 0; i < 8; i++) {
                        setTimeout(() => playSamaritanTypeTick(0.6), i * 35);
                      }
                    }}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Data Packet Decode</span>
                    <Play size={11} className="shrink-0 text-signal" />
                  </button>
                  <button
                    type="button"
                    onClick={() => playSamaritanAcquire(0.6)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Target Acquire</span>
                    <Play size={11} className="shrink-0 text-signal" />
                  </button>
                  <button
                    type="button"
                    onClick={() => playSamaritanToggle(true, 0.8)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Toggle Actuator</span>
                    <Play size={11} className="shrink-0 text-signal" />
                  </button>
                  <button
                    type="button"
                    onClick={() => playSamaritanRatchet(1, 0.7)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Scroll Ratchet</span>
                    <Play size={11} className="shrink-0 text-signal" />
                  </button>
                  <button
                    type="button"
                    onClick={() => playSamaritanScanSweep(0.6)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Scan Sweep</span>
                    <Play size={11} className="shrink-0 text-signal" />
                  </button>
                  <button
                    type="button"
                    onClick={() => playSamaritanBoot(0.9)}
                    disabled={!audioEnabled}
                    className="sam-button flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[11px]">Core Online</span>
                    <Play size={11} className="shrink-0 text-signal" />
                  </button>
                </div>
              </div>
            </div>
          </OptionGroup>

          <p className={`sam-rule pt-4 text-[12px] ${saveState === "error" ? "text-alert" : "text-key"}`} role="status" aria-live="polite">
            {status}
          </p>

          <OptionGroup legend="Security" help="Change your password, see where your account is signed in, and end sessions you do not recognise.">
            <SecurityPanel />
          </OptionGroup>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start" aria-label="Preview">
          <h2 className="sam-head">Preview</h2>
          <div className="samaritan-card mt-4 p-5">
            <div className="flex items-baseline justify-between">
              <span className="sam-key">System time</span>
              <span className="sam-key">Today</span>
            </div>
            <div className="sam-numeral mt-2 text-[32px] leading-none">01:02:18</div>

            <div className="mt-6 flex flex-col items-center">
              <div className="font-display text-[16px] uppercase tracking-[0.06em] text-signal">Observing [kitty]</div>
              <div className="mt-2 h-px w-40 bg-signal" />
              <span className="sam-triangle mt-1.5" aria-hidden />
            </div>

            <dl className="mt-6 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1">
              <dt className="sam-key">Tracked</dt>
              <dd className="sam-value">4h 12m</dd>
              <dt className="sam-key">Focus</dt>
              <dd className="sam-value">72</dd>
              <dt className="sam-key">Entropy</dt>
              <dd className="sam-value text-alert">81</dd>
            </dl>

            <div className="mt-6">
              <div className="sam-key mb-2">Timeline</div>
              <div className="flex h-6 border border-grid">
                {PREVIEW_TIMELINE.map((block, index) => (
                  <span
                    key={`${block.category}-${index}`}
                    style={{ width: `${block.share}%`, background: `var(--cat-${block.category})`, boxShadow: "inset -1px 0 0 var(--sam-void)" }}
                  />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                {CATEGORIES.map((category) => (
                  <li key={category} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0" style={{ background: `var(--cat-${category})` }} />
                    <span className="sam-key truncate">{category.replaceAll("_", " ")}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex gap-2">
              <span className="sam-button" data-variant="primary">Approve</span>
              <span className="sam-button">Cancel</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
