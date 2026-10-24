/**
 * Samaritan Audio Telemetry & Sound Design System
 *
 * Recreates the threatening, industrial, and clinical soundscape of Samaritan
 * from Person of Interest using the Web Audio API:
 *
 * 1. Sub-Bass Mainframe Turbine Rev: Heavy saturated low-frequency motor spool-up.
 * 2. Hydraulic & Piezo Reticle Double-Lock: Bone-rattling sub punch with metallic latch.
 * 3. Stepped Vertex Snaps: Micro-clicks aligned with 3-step reticle framing.
 * 4. Panopticon Threat Directive: Dissonant minor-second tritone beating drone.
 * 5. Hydraulic De-spool / Dismiss: Downward servo deceleration and depressurization release.
 * 6. High-Speed Terminal Decode: Crisp mechanical character packet clocking.
 * 7. Interface servos: target acquisition, latch press, toggles, scroll ratchet,
 *    data packets, confirmation, boot and shutdown.
 * 8. Ambient presence: a low mainframe hum and a servo whine that follows the cursor.
 *
 * Every voice plays into one master bus (gain -> limiter -> speakers), so mute
 * and volume act on everything at once, stacked voices cannot clip, and a
 * muted context is suspended rather than left computing silence.
 *
 * Fully offline, zero external audio assets, sub-millisecond execution.
 */

let sharedAudioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;
let cachedDistortionCurve: Float32Array<ArrayBuffer> | null = null;

const STORAGE_KEY_ENABLED = "samaritan_audio_enabled";
const STORAGE_KEY_VOLUME = "samaritan_audio_volume";
const STORAGE_KEY_AMBIENT = "samaritan_audio_ambient";
const STORAGE_KEY_INTERFACE = "samaritan_audio_interface";
const STORAGE_KEY_TRACE = "samaritan_audio_trace";
const DEFAULT_VOLUME = 0.28;

// Interface voices are dropped (never queued) past this many sounding at once.
const MAX_VOICES = 28;
let activeVoices = 0;

// ─── Preferences ───────────────────────────────────────────────────────

function readFlag(key: string): boolean | null {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? null : stored === "true";
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/**
 * Checks if Samaritan audio telemetry is enabled by user preference. Until a
 * choice is stored, sound starts muted for anyone who asked the system for
 * reduced motion; the sidebar toggle overrides that either way.
 */
export function isSamaritanAudioEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = readFlag(STORAGE_KEY_ENABLED);
  if (stored !== null) return stored;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Enables or disables Samaritan audio telemetry.
 */
export function setSamaritanAudioEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  writeFlag(STORAGE_KEY_ENABLED, enabled);
  applyMasterState();
  notifyAudioPreferenceListeners();
}

/** The ambient layer: mainframe hum, idle scan pulses and the cursor servo. */
export function isSamaritanAmbientEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return readFlag(STORAGE_KEY_AMBIENT) ?? true;
}

export function setSamaritanAmbientEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  writeFlag(STORAGE_KEY_AMBIENT, enabled);
  if (enabled) startAmbient();
  else stopAmbient();
  notifyAudioPreferenceListeners();
}

/** Hover, press, typing, scroll and cursor-travel sounds. */
export function isSamaritanInterfaceSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return readFlag(STORAGE_KEY_INTERFACE) ?? true;
}

export function setSamaritanInterfaceSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  writeFlag(STORAGE_KEY_INTERFACE, enabled);
  notifyAudioPreferenceListeners();
}

const audioPreferenceListeners = new Set<() => void>();

function notifyAudioPreferenceListeners() {
  audioPreferenceListeners.forEach((listener) => listener());
}

/**
 * Subscribes to audio preference changes made in this tab or another one,
 * in the shape `useSyncExternalStore` expects.
 */
export function subscribeSamaritanAudioPreferences(listener: () => void): () => void {
  audioPreferenceListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    audioPreferenceListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Gets master telemetry volume (0.0 to 1.0).
 */
export function getSamaritanAudioVolume(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY_VOLUME);
  } catch {
    stored = null;
  }
  if (stored !== null) {
    const val = parseFloat(stored);
    if (!Number.isNaN(val) && val >= 0 && val <= 1) return val;
  }
  return DEFAULT_VOLUME;
}

/**
 * Sets master telemetry volume (0.0 to 1.0).
 */
export function setSamaritanAudioVolume(volume: number): void {
  if (typeof window === "undefined") return;
  const clamped = Math.max(0, Math.min(1, volume));
  try {
    localStorage.setItem(STORAGE_KEY_VOLUME, clamped.toString());
  } catch {
    // Storage blocked: the volume lasts for this page only.
  }
  applyMasterState();
  notifyAudioPreferenceListeners();
}

// ─── Test instrumentation ──────────────────────────────────────────────

let traceEnabled: boolean | null = null;

/** With localStorage samaritan_audio_trace = "1", voice names are recorded on window.__samaritanSoundTrace. */
function trace(voice: string) {
  if (traceEnabled === null) {
    try {
      traceEnabled = localStorage.getItem(STORAGE_KEY_TRACE) === "1";
    } catch {
      traceEnabled = false;
    }
  }
  if (!traceEnabled) return;
  const target = window as unknown as { __samaritanSoundTrace?: string[] };
  (target.__samaritanSoundTrace ||= []).push(voice);
}

/** In trace mode, window.__samaritanPeak() reads the bus's current peak level (0 = silence). */
function exposeLevelMeter(ctx: AudioContext, bus: AudioNode) {
  trace("graph");
  if (!traceEnabled) return;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  const sink = ctx.createGain();
  sink.gain.value = 0;
  bus.connect(analyser);
  analyser.connect(sink);
  sink.connect(ctx.destination);
  const samples = new Float32Array(analyser.fftSize);
  (window as unknown as { __samaritanPeak?: () => number }).__samaritanPeak = () => {
    analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    return peak;
  };
}

// ─── Audio graph ───────────────────────────────────────────────────────

/**
 * Retrieves or instantiates the singleton AudioContext and its master bus,
 * with user interaction auto-unlock (browsers start audio suspended until
 * the first gesture).
 */
/**
 * Browsers refuse to start audio before the first user gesture and warn on
 * every attempt, so the engine stays dormant until then. The Electron app
 * lifts that rule (autoplay-policy switch in desktop/main.js).
 */
function mayStartAudio(): boolean {
  if (sharedAudioContext) return true;
  if (/Electron\//.test(navigator.userAgent)) return true;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation ? activation.hasBeenActive : true;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !mayStartAudio()) return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    const ctx = new AudioContextClass({ latencyHint: "interactive" });
    sharedAudioContext = ctx;

    // Master bus: volume/mute gain, then a limiter so stacked voices never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    masterGain = ctx.createGain();
    masterGain.gain.value = isSamaritanAudioEnabled() ? getSamaritanAudioVolume() : 0;
    masterGain.connect(limiter);
    limiter.connect(ctx.destination);
    exposeLevelMeter(ctx, limiter);

    // Auto-resume on first user pointer/touch or key interaction
    const unlock = () => {
      if (!isSamaritanAudioEnabled()) return;
      if (sharedAudioContext && sharedAudioContext.state === "suspended") {
        sharedAudioContext
          .resume()
          .then(() => {
            if (isSamaritanAmbientEnabled()) startAmbient();
          })
          .catch(() => {});
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    // Created during or after a gesture (or where autoplay is allowed): start now.
    if (isSamaritanAudioEnabled()) void ctx.resume().catch(() => {});
  }

  return sharedAudioContext;
}

/** Follows the stored enable/volume choice: ramps the bus, suspends a muted context. */
function applyMasterState() {
  const ctx = sharedAudioContext;
  if (!ctx || !masterGain) {
    if (isSamaritanAudioEnabled()) getAudioContext();
    return;
  }
  const enabled = isSamaritanAudioEnabled();
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setTargetAtTime(enabled ? getSamaritanAudioVolume() : 0, now, 0.015);
  if (enabled) {
    void ctx.resume().then(() => {
      if (isSamaritanAmbientEnabled()) startAmbient();
    }).catch(() => {});
  } else {
    setTimeout(() => {
      if (!isSamaritanAudioEnabled() && ctx.state === "running") void ctx.suspend().catch(() => {});
    }, 120);
  }
}

/** The live context and the bus to play into, or null when muted or still locked. */
function output(): { ctx: AudioContext; out: AudioNode } | null {
  if (!isSamaritanAudioEnabled()) return null;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running" || !masterGain) return null;
  return { ctx, out: masterGain };
}

/** Whether Samaritan can make sound right now (enabled and unlocked by a gesture). */
export function isSamaritanAudioLive(): boolean {
  return output() !== null;
}

/** Reserves a voice slot; interface voices give way when the bus is crowded. */
function claimVoice(source: AudioScheduledSourceNode, priority: "low" | "high" = "low"): boolean {
  if (priority === "low" && activeVoices >= MAX_VOICES) return false;
  activeVoices += 1;
  source.addEventListener("ended", () => {
    activeVoices = Math.max(0, activeVoices - 1);
  });
  return true;
}

const lastPlayed = new Map<string, number>();

/** Drops a repeat of `voice` within `ms` (two components announcing the same dialog). */
function debounced(voice: string, ms: number): boolean {
  const now = performance.now();
  const last = lastPlayed.get(voice) ?? -Infinity;
  if (now - last < ms) return true;
  lastPlayed.set(voice, now);
  return false;
}

/**
 * Generates or returns a cached white noise buffer for metallic clicks & latch transients.
 */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const bufferSize = ctx.sampleRate * 0.5; // 500ms of noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

/**
 * Creates a soft-clip saturation curve for menacing industrial warmth on sub-bass.
 */
function getDistortionCurve(amount = 22): Float32Array<ArrayBuffer> {
  if (cachedDistortionCurve) return cachedDistortionCurve;
  const n = 44100;
  const buffer = new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT);
  const curve = new Float32Array(buffer);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; ++i) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  cachedDistortionCurve = curve;
  return curve;
}

/** A short enveloped oscillator into `out`: the building block of the interface voices. */
function blip(
  ctx: AudioContext,
  out: AudioNode,
  options: { type: OscillatorType; from: number; to?: number; at?: number; length: number; level: number; attack?: number }
): OscillatorNode {
  const start = ctx.currentTime + (options.at ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type;
  osc.frequency.setValueAtTime(options.from, start);
  if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, start + options.length * 0.8);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(options.level, start + (options.attack ?? 0.001));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.length);
  osc.connect(gain);
  gain.connect(out);
  osc.start(start);
  osc.stop(start + options.length + 0.01);
  return osc;
}

/** A filtered noise transient into `out`: latch metal, ratchet teeth, air. */
function grit(
  ctx: AudioContext,
  out: AudioNode,
  options: { filter: BiquadFilterType; frequency: number; q?: number; at?: number; length: number; level: number }
): AudioBufferSourceNode {
  const start = ctx.currentTime + (options.at ?? 0);
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = options.filter;
  filter.frequency.setValueAtTime(options.frequency, start);
  filter.Q.setValueAtTime(options.q ?? 4, start);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(options.level, start + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.length);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  // Random offset: consecutive ticks never sound identical.
  source.start(start, Math.random() * 0.4);
  source.stop(start + options.length + 0.01);
  return source;
}

/**
 * 1. Threatening Sub-Bass Mainframe Turbine Rev
 * The signature deep, ominous motor spool-up of Samaritan spinning up its core.
 * Low frequencies pitch upward with harmonic saturation and analog warmth.
 */
export function playSamaritanRev(intensity = 1.0, duration = 0.38): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("rev");

    const now = ctx.currentTime;

    // Sub-bass Sawtooth (primary industrial engine)
    const oscSaw = ctx.createOscillator();
    oscSaw.type = "sawtooth";
    oscSaw.frequency.setValueAtTime(42, now);
    oscSaw.frequency.exponentialRampToValueAtTime(104, now + duration * 0.7);
    oscSaw.frequency.exponentialRampToValueAtTime(94, now + duration);

    // Pure Sub Sine (chest-thumping low-end weight)
    const oscSub = ctx.createOscillator();
    oscSub.type = "sine";
    oscSub.frequency.setValueAtTime(42, now);
    oscSub.frequency.exponentialRampToValueAtTime(104, now + duration * 0.7);

    // Harmonic Detuned Fifth (creates acoustic beating flutter)
    const oscFifth = ctx.createOscillator();
    oscFifth.type = "triangle";
    oscFifth.frequency.setValueAtTime(63.5, now);
    oscFifth.frequency.exponentialRampToValueAtTime(158, now + duration * 0.7);

    // Waveshaper Saturation
    const shaper = ctx.createWaveShaper();
    shaper.curve = getDistortionCurve(24);
    shaper.oversample = "2x";

    // Dynamic Lowpass Filter (opens then clamps shut)
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.setValueAtTime(3.2, now);
    filter.frequency.setValueAtTime(80, now);
    filter.frequency.exponentialRampToValueAtTime(480, now + duration * 0.6);
    filter.frequency.exponentialRampToValueAtTime(85, now + duration);

    // Volume Envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.45, now + 0.04);
    gain.gain.setValueAtTime(intensity * 0.45, now + duration * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscSaw.connect(shaper);
    oscSub.connect(filter);
    oscFifth.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    claimVoice(oscSaw, "high");
    oscSaw.start(now);
    oscSub.start(now);
    oscFifth.start(now);

    oscSaw.stop(now + duration);
    oscSub.stop(now + duration);
    oscFifth.stop(now + duration);
  } catch {
    // Graceful fallback if audio context is blocked
  }
}

/**
 * 2. Heavy Hydraulic & Piezo Reticle Double-Lock
 * Samaritan's mechanical target lock: high-tension piezoelectric snaps
 * paired with a deep hydraulic latch slam that gives physical weight to the reticle.
 */
export function playSamaritanLock(intensity = 1.0): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("lock");

    const now = ctx.currentTime;

    // --- Layer A: Hydraulic Sub-Bass Impact (Tactile Thump) ---
    const oscThump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    oscThump.type = "sine";
    oscThump.frequency.setValueAtTime(135, now);
    oscThump.frequency.exponentialRampToValueAtTime(28, now + 0.045);

    thumpGain.gain.setValueAtTime(0, now);
    thumpGain.gain.linearRampToValueAtTime(intensity * 0.55, now + 0.003);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    oscThump.connect(thumpGain);
    thumpGain.connect(out);
    claimVoice(oscThump, "high");
    oscThump.start(now);
    oscThump.stop(now + 0.075);

    // --- Layer B: Metallic Locking Pin Latch (Resonant Noise Burst) ---
    grit(ctx, out, { filter: "bandpass", frequency: 2900, q: 6, length: 0.028, level: intensity * 0.35 });

    // --- Layer C: Piezoelectric Dual Optical Chirp (High-Frequency Laser Target) ---
    const oscP1 = ctx.createOscillator();
    const oscP2 = ctx.createOscillator();
    const piezoGain = ctx.createGain();

    oscP1.type = "sine";
    oscP1.frequency.setValueAtTime(2700, now);
    oscP1.frequency.exponentialRampToValueAtTime(3950, now + 0.018);

    oscP2.type = "triangle";
    oscP2.frequency.setValueAtTime(4100, now);
    oscP2.frequency.exponentialRampToValueAtTime(5600, now + 0.024);

    piezoGain.gain.setValueAtTime(0, now);
    piezoGain.gain.linearRampToValueAtTime(intensity * 0.28, now + 0.002);
    piezoGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    oscP1.connect(piezoGain);
    oscP2.connect(piezoGain);
    piezoGain.connect(out);

    oscP1.start(now);
    oscP2.start(now + 0.004);
    oscP1.stop(now + 0.025);
    oscP2.stop(now + 0.035);
  } catch {
    // Graceful fallback
  }
}

/**
 * 3. Stepped Reticle Vertex Snap
 * A single clinical micro-tick corresponding to each step of the reticle bracket framing.
 */
export function playSamaritanVertexTick(step = 1, intensity = 0.8): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("vertex");
    // Step 1: 2.65kHz, Step 2: 3.5kHz, Step 3: 4.35kHz
    const baseFreq = 1800 + step * 850;
    const osc = blip(ctx, out, { type: "triangle", from: baseFreq, to: baseFreq * 1.35, length: 0.018, level: intensity * 0.22 });
    claimVoice(osc);
  } catch {
    // Graceful fallback
  }
}

/**
 * 4. Master Dialog Unfold Sequence (Aperture + Rev + Stepped Lock + Beam Sweep)
 * Coordinates the full canonical Person of Interest sound sequence:
 * - t = 0ms: Mainframe sub-bass rev starts spooling
 * - t = 70ms: Step 1 corner reticle micro-snap
 * - t = 140ms: Step 2 corner reticle micro-snap
 * - t = 210ms: Step 3 full reticle lock + heavy hydraulic pin slam
 * - t = 270ms: Phosphor laser scanline sweep tone
 * A dialog announced by its own component and by the global dialog watcher
 * plays once.
 */
export function playSamaritanDialogSequence(intensity = 1.0): void {
  try {
    if (!output() || debounced("dialog", 450)) return;
    trace("dialog");

    // 0ms: Sub-bass engine rev
    playSamaritanRev(intensity, 0.36);

    // Stepped ticks
    setTimeout(() => playSamaritanVertexTick(1, intensity * 0.7), 65);
    setTimeout(() => playSamaritanVertexTick(2, intensity * 0.85), 135);

    // 210ms: Heavy mechanical double-lock latch slam
    setTimeout(() => playSamaritanLock(intensity * 1.1), 210);

    // 270ms: Phosphor laser scanline sweep
    setTimeout(() => {
      const live = output();
      if (!live) return;
      blip(live.ctx, live.out, { type: "sine", from: 1550, to: 380, length: 0.14, level: intensity * 0.16, attack: 0.01 });
    }, 270);
  } catch {
    // Graceful fallback
  }
}

/**
 * 5. Panopticon Threat Directive / Deviation Pulse
 * Threatening dissonant minor-second tritone alert (880Hz + 830Hz) with sub-rumble,
 * used when deviations or surveillance anomalies occur.
 */
export function playSamaritanThreatAlert(intensity = 1.0): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001 || debounced("threat", 900)) return;
    const { ctx, out } = live;
    trace("threat");

    const now = ctx.currentTime;
    const duration = 0.42;

    // Sub foundation
    const subOsc = ctx.createOscillator();
    subOsc.type = "sawtooth";
    subOsc.frequency.setValueAtTime(55, now);
    const subFilter = ctx.createBiquadFilter();
    subFilter.type = "lowpass";
    subFilter.frequency.setValueAtTime(140, now);

    // Dissonant Beating Pair (A5 and Ab5 -> harsh minor second clash)
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = "sine";
    oscB.type = "sine";
    oscA.frequency.setValueAtTime(880, now);
    oscB.frequency.setValueAtTime(830.6, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.4, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    subOsc.connect(subFilter);
    subFilter.connect(gain);
    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(out);

    claimVoice(subOsc, "high");
    subOsc.start(now);
    oscA.start(now);
    oscB.start(now);

    subOsc.stop(now + duration);
    oscA.stop(now + duration);
    oscB.stop(now + duration);
  } catch {
    // Graceful fallback
  }
}

/**
 * 6. Hydraulic De-spool / Dismiss Sound
 * Reverse rev and hydraulic depressurization hiss when closing dialogs or clearing targets.
 */
export function playSamaritanDismiss(intensity = 0.85): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001 || debounced("dismiss", 350)) return;
    const { ctx, out } = live;
    trace("dismiss");

    const now = ctx.currentTime;
    const duration = 0.22;

    // De-accelerating sub pitch
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + duration);

    // Soft hydraulic air release
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(1200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(150, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity * 0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    noise.connect(noiseFilter);
    noiseFilter.connect(gain);
    gain.connect(out);

    claimVoice(osc, "high");
    osc.start(now);
    noise.start(now);
    osc.stop(now + duration);
    noise.stop(now + duration);
  } catch {
    // Graceful fallback
  }
}

/**
 * 7. Terminal Character Decode Micro-Tick
 * High-speed digital impulse for text decrypt / character decode animations.
 */
export function playSamaritanTypeTick(intensity = 0.5): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("type");
    const freq = 3600 + (Math.random() - 0.5) * 160;
    const osc = blip(ctx, out, { type: "square", from: freq, length: 0.006, level: intensity * 0.08, attack: 0.0005 });
    claimVoice(osc);
  } catch {
    // Graceful fallback
  }
}

/**
 * 8. Target Acquisition Chirp
 * The reticle passing over something it can act on: a rising piezo chirp
 * over a faint servo tick. Cards and passive regions use a lower pitch.
 */
export function playSamaritanAcquire(intensity = 0.3, pitch = 1): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("acquire");
    const base = 1850 * pitch;
    const osc = blip(ctx, out, { type: "sine", from: base, to: base * 1.42, length: 0.024, level: intensity * 0.16 });
    if (!claimVoice(osc)) return;
    blip(ctx, out, { type: "triangle", from: base * 2.1, at: 0.006, length: 0.012, level: intensity * 0.07 });
    grit(ctx, out, { filter: "highpass", frequency: 5200, q: 1, length: 0.008, level: intensity * 0.12 });
  } catch {
    // Graceful fallback
  }
}

/**
 * 9. Mechanical Latch Press
 * The first half of a click: a spring-loaded pin dropping into its seat.
 */
export function playSamaritanPress(intensity = 0.5): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("press");
    const osc = blip(ctx, out, { type: "sine", from: 190, to: 58, length: 0.032, level: intensity * 0.36, attack: 0.002 });
    if (!claimVoice(osc)) return;
    grit(ctx, out, { filter: "bandpass", frequency: 1750, q: 3.5, length: 0.016, level: intensity * 0.28 });
  } catch {
    // Graceful fallback
  }
}

/**
 * 10. Servo Travel Tick
 * One grain of reticle motion as the cursor travels; faster travel ticks higher.
 */
export function playSamaritanServoTick(speed = 0.5, intensity = 0.25): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("servo");
    const clamped = Math.min(1, Math.max(0, speed));
    const freq = 900 + clamped * 1500 + Math.random() * 80;
    const osc = blip(ctx, out, { type: "triangle", from: freq, to: freq * 1.12, length: 0.009, level: intensity * 0.1 });
    if (!claimVoice(osc)) return;
    grit(ctx, out, { filter: "bandpass", frequency: 3400 + clamped * 1800, q: 2, length: 0.006, level: intensity * 0.08 });
  } catch {
    // Graceful fallback
  }
}

/**
 * 11. Scroll Ratchet
 * One tooth of a heavy ratchet per scroll step; pitch follows direction.
 */
export function playSamaritanRatchet(direction: 1 | -1 = 1, intensity = 0.3): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("ratchet");
    const source = grit(ctx, out, { filter: "bandpass", frequency: direction > 0 ? 2300 : 1900, q: 5, length: 0.014, level: intensity * 0.22 });
    if (!claimVoice(source)) return;
    blip(ctx, out, { type: "sine", from: direction > 0 ? 240 : 210, to: 90, length: 0.02, level: intensity * 0.14 });
  } catch {
    // Graceful fallback
  }
}

/**
 * 12. Toggle Actuator
 * Two stepped ticks rising (engaged) or falling (released), then a light latch.
 */
export function playSamaritanToggle(on: boolean, intensity = 0.45): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace(on ? "toggle-on" : "toggle-off");
    const [first, second] = on ? [1500, 2400] : [2400, 1500];
    const osc = blip(ctx, out, { type: "triangle", from: first, length: 0.014, level: intensity * 0.18 });
    if (!claimVoice(osc, "high")) return;
    blip(ctx, out, { type: "triangle", from: second, at: 0.045, length: 0.016, level: intensity * 0.2 });
    grit(ctx, out, { filter: "bandpass", frequency: 2600, q: 5, at: 0.05, length: 0.018, level: intensity * 0.18 });
  } catch {
    // Graceful fallback
  }
}

/**
 * 13. Data Packet Telemetry
 * A faint digital burble when the server pushes fresh intelligence.
 */
export function playSamaritanDataPacket(intensity = 0.25): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("packet");
    for (let i = 0; i < 3; i += 1) {
      const osc = blip(ctx, out, {
        type: "square",
        from: 2800 + Math.random() * 1400,
        at: i * 0.019,
        length: 0.007,
        level: intensity * 0.06,
        attack: 0.0005,
      });
      if (i === 0 && !claimVoice(osc)) return;
    }
  } catch {
    // Graceful fallback
  }
}

/**
 * 14. Directive Confirmed
 * A change the server accepted: the reticle lock followed by a rising two-tone.
 */
export function playSamaritanConfirm(intensity = 0.6): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001 || debounced("confirm", 250)) return;
    const { ctx, out } = live;
    trace("confirm");
    playSamaritanLock(intensity * 0.7);
    blip(ctx, out, { type: "sine", from: 1320, at: 0.06, length: 0.05, level: intensity * 0.12, attack: 0.004 });
    blip(ctx, out, { type: "sine", from: 1760, at: 0.11, length: 0.07, level: intensity * 0.12, attack: 0.004 });
  } catch {
    // Graceful fallback
  }
}

/**
 * 15. Surveillance Scan Sweep
 * The machine looking around while idle: a slow rising sweep and a vertex snap.
 */
export function playSamaritanScanSweep(intensity = 0.2): void {
  try {
    const live = output();
    if (!live || intensity <= 0.001) return;
    const { ctx, out } = live;
    trace("scan");
    const osc = blip(ctx, out, { type: "sine", from: 420, to: 1650, length: 0.55, level: intensity * 0.09, attack: 0.18 });
    if (!claimVoice(osc)) return;
    setTimeout(() => playSamaritanVertexTick(3, intensity * 0.6), 560);
  } catch {
    // Graceful fallback
  }
}

/**
 * 16. Core Online
 * Sign-in: a long turbine spool-up, the three reticle snaps, the lock, the beam.
 */
export function playSamaritanBoot(intensity = 0.9): void {
  try {
    if (!output() || debounced("boot", 2000)) return;
    trace("boot");
    playSamaritanRev(intensity, 0.62);
    setTimeout(() => playSamaritanVertexTick(1, intensity * 0.7), 180);
    setTimeout(() => playSamaritanVertexTick(2, intensity * 0.8), 280);
    setTimeout(() => playSamaritanVertexTick(3, intensity * 0.9), 380);
    setTimeout(() => playSamaritanLock(intensity * 1.1), 520);
    setTimeout(() => playSamaritanScanSweep(intensity * 0.8), 600);
  } catch {
    // Graceful fallback
  }
}

/**
 * 17. Core Offline
 * Sign-out: the hydraulic de-spool followed by the turbine winding down.
 */
export function playSamaritanShutdown(intensity = 0.8): void {
  try {
    const live = output();
    if (!live || debounced("shutdown", 2000)) return;
    const { ctx, out } = live;
    trace("shutdown");
    playSamaritanDismiss(intensity);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(96, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.9);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(70, now + 0.9);
    gain.gain.setValueAtTime(0, now + 0.12);
    gain.gain.linearRampToValueAtTime(intensity * 0.32, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    claimVoice(osc, "high");
    osc.start(now + 0.12);
    osc.stop(now + 1);
  } catch {
    // Graceful fallback
  }
}

// ─── Ambient presence ──────────────────────────────────────────────────

interface AmbientGraph {
  hum: GainNode;
  servoOsc: OscillatorNode;
  servoFilter: BiquadFilterNode;
  servoGain: GainNode;
  sources: AudioScheduledSourceNode[];
}

let ambient: AmbientGraph | null = null;
const AMBIENT_HUM_LEVEL = 0.05;
const AMBIENT_SERVO_LEVEL = 0.075;

/**
 * Starts the always-on layer: a 55 Hz mainframe hum (two detuned partials that
 * beat slowly, breathing on a 0.13 Hz swell) and a servo whine that stays
 * silent until setSamaritanAmbientMotion drives it.
 */
export function startAmbient(): void {
  try {
    if (ambient || !isSamaritanAmbientEnabled()) return;
    const live = output();
    if (!live) return;
    const { ctx, out } = live;
    const now = ctx.currentTime;

    const hum = ctx.createGain();
    hum.gain.setValueAtTime(0, now);
    hum.gain.linearRampToValueAtTime(AMBIENT_HUM_LEVEL, now + 2.5);
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 240;
    const low = ctx.createOscillator();
    low.type = "sine";
    low.frequency.value = 55;
    const high = ctx.createOscillator();
    high.type = "triangle";
    high.frequency.value = 110.35;
    const highLevel = ctx.createGain();
    highLevel.gain.value = 0.35;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.13;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = AMBIENT_HUM_LEVEL * 0.35;
    swell.connect(swellDepth);
    swellDepth.connect(hum.gain);
    low.connect(humFilter);
    high.connect(highLevel);
    highLevel.connect(humFilter);
    humFilter.connect(hum);
    hum.connect(out);

    const servoOsc = ctx.createOscillator();
    servoOsc.type = "sawtooth";
    servoOsc.frequency.value = 150;
    const servoFilter = ctx.createBiquadFilter();
    servoFilter.type = "bandpass";
    servoFilter.Q.value = 9;
    servoFilter.frequency.value = 650;
    const servoGain = ctx.createGain();
    servoGain.gain.value = 0;
    servoOsc.connect(servoFilter);
    servoFilter.connect(servoGain);
    servoGain.connect(out);

    const sources = [low, high, swell, servoOsc];
    sources.forEach((source) => source.start(now));
    ambient = { hum, servoOsc, servoFilter, servoGain, sources };
    trace("ambient-start");
  } catch {
    // Graceful fallback
  }
}

export function stopAmbient(): void {
  const graph = ambient;
  const ctx = sharedAudioContext;
  ambient = null;
  if (!graph || !ctx) return;
  const now = ctx.currentTime;
  graph.hum.gain.cancelScheduledValues(now);
  graph.hum.gain.setTargetAtTime(0, now, 0.2);
  graph.servoGain.gain.setTargetAtTime(0, now, 0.05);
  graph.sources.forEach((source) => {
    try {
      source.stop(now + 1.2);
    } catch {
      // Already stopped.
    }
  });
  trace("ambient-stop");
}

/**
 * Drives the servo whine from cursor speed (0 at rest, 1 at a fast flick):
 * gain, pitch and filter glide toward the target so motion sounds continuous.
 */
export function setSamaritanAmbientMotion(speed: number): void {
  const graph = ambient;
  const ctx = sharedAudioContext;
  if (!graph || !ctx || ctx.state !== "running") return;
  const s = Math.min(1, Math.max(0, speed));
  const now = ctx.currentTime;
  graph.servoGain.gain.setTargetAtTime(s * s * AMBIENT_SERVO_LEVEL, now, s > 0 ? 0.04 : 0.12);
  graph.servoOsc.frequency.setTargetAtTime(140 + s * 300, now, 0.06);
  graph.servoFilter.frequency.setTargetAtTime(600 + s * 2200, now, 0.06);
}

/**
 * Backward compatibility wrapper: plays the rich Samaritan reticle lock.
 */
export function playSamaritanLockTick(volume = 0.08): void {
  const intensity = Math.min(2.0, Math.max(0.5, volume * 10));
  playSamaritanLock(intensity);
}
