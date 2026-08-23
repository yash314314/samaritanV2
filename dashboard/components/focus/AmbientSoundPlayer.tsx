"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Music, Play, Square, Sparkles } from "lucide-react";

export type SoundType = "none" | "binaural_40hz" | "rain" | "pink" | "brown" | "white";

interface AmbientSoundPlayerProps {
  sound?: SoundType;
  volume?: number;
  onSoundChange?: (sound: SoundType) => void;
  onVolumeChange?: (volume: number) => void;
  autoPlay?: boolean;
}

export default function AmbientSoundPlayer({
  sound: initialSound = "none",
  volume: initialVolume = 0.35,
  onSoundChange,
  onVolumeChange,
  autoPlay = false,
}: AmbientSoundPlayerProps) {
  const [selectedSound, setSelectedSound] = useState<SoundType>(initialSound);
  const [volume, setVolume] = useState<number>(initialVolume);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay && initialSound !== "none");
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const activeNodesRef = useRef<AudioNode[]>([]);
  const animationTimerRef = useRef<number | null>(null);

  // Sync external props
  useEffect(() => {
    if (initialSound !== selectedSound) {
      setSelectedSound(initialSound);
    }
  }, [initialSound]);

  useEffect(() => {
    if (initialVolume !== volume) {
      setVolume(initialVolume);
    }
  }, [initialVolume]);

  // Clean up Web Audio API nodes
  const stopAudio = () => {
    if (animationTimerRef.current) {
      cancelAnimationFrame(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    activeNodesRef.current.forEach((node) => {
      try {
        if ("stop" in node && typeof (node as any).stop === "function") {
          (node as any).stop();
        }
        node.disconnect();
      } catch (e) {
        // ignore disconnect errors
      }
    });
    activeNodesRef.current = [];
  };

  // Start synthesizing audio via Web Audio API
  const startAudio = (type: SoundType) => {
    stopAudio();
    if (type === "none") return;

    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      gainNodeRef.current = masterGain;

      if (type === "binaural_40hz") {
        // 40Hz Binaural Beat: Left 200Hz, Right 240Hz
        const merger = ctx.createChannelMerger(2);

        const oscL = ctx.createOscillator();
        oscL.type = "sine";
        oscL.frequency.setValueAtTime(200, ctx.currentTime);

        const oscR = ctx.createOscillator();
        oscR.type = "sine";
        oscR.frequency.setValueAtTime(240, ctx.currentTime);

        oscL.connect(merger, 0, 0);
        oscR.connect(merger, 0, 1);
        merger.connect(masterGain);

        oscL.start();
        oscR.start();

        activeNodesRef.current.push(oscL, oscR, merger);
      } else if (type === "white" || type === "pink" || type === "brown" || type === "rain") {
        // Generate 5-second noise buffer
        const bufferSize = ctx.sampleRate * 5;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.currentTime);
        const output = noiseBuffer.getChannelData(0);

        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        let lastOut = 0.0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;

          if (type === "white") {
            output[i] = white * 0.15;
          } else if (type === "pink" || type === "rain") {
            // Paul Kellet's filter method for pink noise
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
            b6 = white * 0.115926;
          } else if (type === "brown") {
            // Brown noise (integrated white noise)
            output[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = output[i];
            output[i] *= 0.5;
          }
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        if (type === "rain") {
          // Lowpass filter + LFO modulation for rain drops simulation
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(1000, ctx.currentTime);

          const lfo = ctx.createOscillator();
          lfo.frequency.setValueAtTime(0.2, ctx.currentTime); // Slow modulation
          const lfoGain = ctx.createGain();
          lfoGain.gain.setValueAtTime(300, ctx.currentTime);

          lfo.connect(lfoGain);
          lfoGain.connect(filter.frequency);

          whiteNoise.connect(filter);
          filter.connect(masterGain);

          lfo.start();
          whiteNoise.start();
          activeNodesRef.current.push(whiteNoise, filter, lfo, lfoGain);
        } else {
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(type === "pink" ? 1500 : 800, ctx.currentTime);

          whiteNoise.connect(filter);
          filter.connect(masterGain);
          whiteNoise.start();
          activeNodesRef.current.push(whiteNoise, filter);
        }
      }
    } catch (err) {
      console.error("Failed to start Ambient Sound player:", err);
    }
  };

  // Toggle playback
  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      if (selectedSound === "none") {
        changeSound("binaural_40hz");
      } else {
        startAudio(selectedSound);
        setIsPlaying(true);
      }
    }
  };

  const changeSound = (newSound: SoundType) => {
    setSelectedSound(newSound);
    onSoundChange?.(newSound);
    if (newSound === "none") {
      stopAudio();
      setIsPlaying(false);
    } else {
      startAudio(newSound);
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    onVolumeChange?.(newVolume);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(isMuted ? 0 : newVolume, audioCtxRef.current.currentTime);
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(nextMute ? 0 : volume, audioCtxRef.current.currentTime);
    }
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const sounds: { id: SoundType; label: string; desc: string }[] = [
    { id: "none", label: "None", desc: "Mute background audio" },
    { id: "binaural_40hz", label: "Binaural 40Hz", desc: "Gamma frequency focus beat" },
    { id: "rain", label: "Rain Ambience", desc: "Soothing rainfall modulation" },
    { id: "pink", label: "Pink Noise", desc: "Balanced ambient noise" },
    { id: "brown", label: "Brown Noise", desc: "Deep relaxing rumble" },
    { id: "white", label: "White Noise", desc: "High-energy sound mask" },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isPlaying ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"}`}>
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              Ambient Focus Audio
              {isPlaying && (
                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-1.5 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3 animate-pulse" /> Active
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-400">Offline Web Audio focus generator</p>
          </div>
        </div>

        <button
          onClick={togglePlay}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            isPlaying
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
              : "bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" /> Stop
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" /> Play Sound
            </>
          )}
        </button>
      </div>

      {/* Sound Type Selection Pills */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {sounds.map((s) => (
          <button
            key={s.id}
            onClick={() => changeSound(s.id)}
            className={`px-2.5 py-2 rounded-lg text-left text-xs transition-all border ${
              selectedSound === s.id
                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-medium shadow-sm shadow-cyan-500/10"
                : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <div className="font-semibold text-[11px] truncate">{s.label}</div>
            <div className="text-[9px] opacity-75 truncate">{s.desc}</div>
          </button>
        ))}
      </div>

      {/* Volume Control */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60">
        <button
          onClick={toggleMute}
          className="text-slate-400 hover:text-slate-200 transition-colors"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-4 h-4 text-slate-500" />
          ) : (
            <Volume2 className="w-4 h-4 text-cyan-400" />
          )}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
        />

        <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>
    </div>
  );
}
