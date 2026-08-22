"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AmbientSound = "none" | "white" | "pink" | "brown" | "rain";

function storedVolume(fallback: number) {
  if (typeof window === "undefined") return fallback;
  const stored = Number(window.localStorage.getItem("samaritan:ambient-volume"));
  return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : fallback;
}

function fillNoise(data: Float32Array, sound: AmbientSound) {
  let brown = 0;
  let pink0 = 0;
  let pink1 = 0;
  let pink2 = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    if (sound === "brown") {
      brown = (brown + 0.02 * white) / 1.02;
      data[index] = brown * 3.5;
    } else if (sound === "pink") {
      pink0 = 0.99765 * pink0 + white * 0.099046;
      pink1 = 0.963 * pink1 + white * 0.2965164;
      pink2 = 0.57 * pink2 + white * 1.0526913;
      data[index] = (pink0 + pink1 + pink2 + white * 0.1848) * 0.2;
    } else {
      data[index] = white * (sound === "rain" ? 0.7 : 0.45);
    }
  }
}

export function useAmbientAudio(initialSound: AmbientSound, initialVolume = 0.3, enabled = true) {
  const [sound, setSound] = useState<AmbientSound>(initialSound);
  const [volume, setVolumeState] = useState(() => storedVolume(initialVolume));
  const [playing, setPlaying] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const volumeRef = useRef(volume);
  const mountedRef = useRef(true);

  const stop = useCallback(() => {
    try { sourceRef.current?.stop(); } catch { /* already stopped */ }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    setPlaying(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    if (!enabled || sound === "none") {
      setNeedsGesture(false);
      return;
    }
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    await context.resume();
    if (!mountedRef.current) return;

    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    fillNoise(buffer.getChannelData(0), sound);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volumeRef.current)) * 0.45;
    source.buffer = buffer;
    source.loop = true;

    if (sound === "rain") {
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      filter.Q.value = 0.45;
      source.connect(filter).connect(gain).connect(context.destination);
    } else {
      source.connect(gain).connect(context.destination);
    }
    sourceRef.current = source;
    gainRef.current = gain;
    source.start();
    setPlaying(context.state === "running");
    setNeedsGesture(context.state !== "running");
  }, [enabled, sound, stop]);

  const setVolume = useCallback((next: number) => {
    const normalized = Math.max(0, Math.min(1, next));
    volumeRef.current = normalized;
    setVolumeState(normalized);
    if (gainRef.current) gainRef.current.gain.value = normalized * 0.45;
    localStorage.setItem("samaritan:ambient-volume", String(normalized));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, [stop]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!enabled || sound === "none") stop();
      else void start().catch(() => setNeedsGesture(true));
    }, 0);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [enabled, sound, start, stop]);

  const toggle = useCallback(() => {
    if (playing) stop();
    else void start().catch(() => setNeedsGesture(true));
  }, [playing, start, stop]);

  return { sound, setSound, volume, setVolume, playing, needsGesture, toggle, start, stop };
}
