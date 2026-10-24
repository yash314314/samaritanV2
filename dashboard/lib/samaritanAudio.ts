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
 * 
 * Fully offline, zero external audio assets, sub-millisecond execution.
 */

let sharedAudioContext: AudioContext | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;
let cachedDistortionCurve: Float32Array<ArrayBuffer> | null = null;

const STORAGE_KEY_ENABLED = "samaritan_audio_enabled";
const STORAGE_KEY_VOLUME = "samaritan_audio_volume";
const DEFAULT_VOLUME = 0.28;

/**
 * Checks if Samaritan audio telemetry is enabled by user preference.
 */
export function isSamaritanAudioEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const stored = localStorage.getItem(STORAGE_KEY_ENABLED);
  return stored !== null ? stored === "true" : true;
}

/**
 * Enables or disables Samaritan audio telemetry.
 */
export function setSamaritanAudioEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? "true" : "false");
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
  const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
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
  localStorage.setItem(STORAGE_KEY_VOLUME, clamped.toString());
  notifyAudioPreferenceListeners();
}

/**
 * Retrieves or instantiates the singleton AudioContext with user interaction auto-unlock.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextClass();

    // Auto-resume on first user pointer/touch or key interaction
    const unlock = () => {
      if (sharedAudioContext && sharedAudioContext.state === "suspended") {
        sharedAudioContext.resume().catch(() => {});
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
  }

  if (sharedAudioContext.state === "suspended") {
    void sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
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

/**
 * 1. Threatening Sub-Bass Mainframe Turbine Rev
 * The signature deep, ominous motor spool-up of Samaritan spinning up its core.
 * Low frequencies pitch upward with harmonic saturation and analog warmth.
 */
export function playSamaritanRev(intensity = 1.0, duration = 0.38): void {
  try {
    if (!isSamaritanAudioEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;

    const masterVol = getSamaritanAudioVolume();
    const effectiveVol = masterVol * intensity;
    if (effectiveVol <= 0.001) return;

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
    gain.gain.linearRampToValueAtTime(effectiveVol * 0.45, now + 0.04);
    gain.gain.setValueAtTime(effectiveVol * 0.45, now + duration * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscSaw.connect(shaper);
    oscSub.connect(filter);
    oscFifth.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

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
    if (!isSamaritanAudioEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;

    const masterVol = getSamaritanAudioVolume();
    const effectiveVol = masterVol * intensity;
    if (effectiveVol <= 0.001) return;

    const now = ctx.currentTime;

    // --- Layer A: Hydraulic Sub-Bass Impact (Tactile Thump) ---
    const oscThump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    oscThump.type = "sine";
    oscThump.frequency.setValueAtTime(135, now);
    oscThump.frequency.exponentialRampToValueAtTime(28, now + 0.045);

    thumpGain.gain.setValueAtTime(0, now);
    thumpGain.gain.linearRampToValueAtTime(effectiveVol * 0.55, now + 0.003);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    oscThump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    oscThump.start(now);
    oscThump.stop(now + 0.075);

    // --- Layer B: Metallic Locking Pin Latch (Resonant Noise Burst) ---
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = getNoiseBuffer(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2900, now);
    noiseFilter.Q.setValueAtTime(6.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(effectiveVol * 0.35, now + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + 0.035);

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
    piezoGain.gain.linearRampToValueAtTime(effectiveVol * 0.28, now + 0.002);
    piezoGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    oscP1.connect(piezoGain);
    oscP2.connect(piezoGain);
    piezoGain.connect(ctx.destination);

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
    if (!isSamaritanAudioEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;

    const masterVol = getSamaritanAudioVolume();
    const effectiveVol = masterVol * intensity;
    if (effectiveVol <= 0.001) return;

    const now = ctx.currentTime;
    // Step 1: 2.1kHz, Step 2: 3.1kHz, Step 3: 4.2kHz
    const baseFreq = 1800 + step * 850;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.012);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(effectiveVol * 0.22, now + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.022);
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
 */
export function playSamaritanDialogSequence(intensity = 1.0): void {
  try {
    if (!isSamaritanAudioEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;

    // 0ms: Sub-bass engine rev
    playSamaritanRev(intensity, 0.36);

    // Stepped ticks
    setTimeout(() => playSamaritanVertexTick(1, intensity * 0.7), 65);
    setTimeout(() => playSamaritanVertexTick(2, intensity * 0.85), 135);

    // 210ms: Heavy mechanical double-lock latch slam
    setTimeout(() => playSamaritanLock(intensity * 1.1), 210);

    // 270ms: Phosphor laser scanline sweep
    setTimeout(() => {
      try {
        const sweepCtx = getAudioContext();
        if (!sweepCtx || sweepCtx.state !== "running") return;
        const now = sweepCtx.currentTime;
        const sweepVol = getSamaritanAudioVolume() * intensity * 0.16;

        const osc = sweepCtx.createOscillator();
        const gain = sweepCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1550, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.14);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(sweepVol, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

        osc.connect(gain);
        gain.connect(sweepCtx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } catch {}
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
    if (!isSamaritanAudioEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;

    const masterVol = getSamaritanAudioVolume();
    const effectiveVol = masterVol * intensity;
    if (effectiveVol <= 0.001) return;

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
    gain.gain.linearRampToValueAtTime(effectiveVol * 0.4, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    subOsc.connect(subFilter);
    subFilter.connect(gain);
    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(ctx.destination);

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
    if (!isSamaritanAudioEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;

    const masterVol = getSamaritanAudioVolume();
    const effectiveVol = masterVol * intensity;
    if (effectiveVol <= 0.001) return;

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
    gain.gain.linearRampToValueAtTime(effectiveVol * 0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    noise.connect(noiseFilter);
    noiseFilter.connect(gain);
    gain.connect(ctx.destination);

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
    if (!isSamaritanAudioEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;

    const masterVol = getSamaritanAudioVolume();
    const effectiveVol = masterVol * intensity;
    if (effectiveVol <= 0.001) return;

    const now = ctx.currentTime;
    const jitter = (Math.random() - 0.5) * 160;
    const freq = 3600 + jitter;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(effectiveVol * 0.08, now + 0.0005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.006);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.008);
  } catch {
    // Graceful fallback
  }
}

/**
 * Backward compatibility wrapper: plays the rich Samaritan reticle lock.
 */
export function playSamaritanLockTick(volume = 0.08): void {
  const intensity = Math.min(2.0, Math.max(0.5, volume * 10));
  playSamaritanLock(intensity);
}
