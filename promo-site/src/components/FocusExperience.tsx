import React, { useState, useEffect, useRef } from 'react';
import { Square, Volume2 } from 'lucide-react';

export const FocusExperience: React.FC = () => {
  const [audioType, setAudioType] = useState<'rain' | 'pink' | 'white' | 'brown'>('rain');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.25);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const startSound = (type: 'rain' | 'pink' | 'white' | 'brown') => {
    stopSound();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;

        if (type === 'white') {
          data[i] = white * 0.15;
        } else if (type === 'pink') {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
          b6 = white * 0.115926;
        } else if (type === 'brown' || type === 'rain') {
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 0.85;
        }
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const gain = ctx.createGain();
      gain.gain.value = volume;

      noise.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noiseNodeRef.current = noise;
      gainNodeRef.current = gain;
      setIsPlaying(true);
    } catch (err) {
      console.error('Web Audio error:', err);
    }
  };

  const stopSound = () => {
    if (noiseNodeRef.current) {
      try {
        (noiseNodeRef.current as any).stop();
      } catch {}
      noiseNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      stopSound();
    };
  }, []);

  return (
    <section id="focus" className="py-28 bg-[#030304] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <Volume2 className="w-3.5 h-3.5" />
            Chapter 04 • Deep Work Protocols
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            DISTRACTION DISSOLVES IN FOCUS.
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Test Samaritan's procedural HTML5 Web Audio ambient noise generator live in your browser with zero network audio asset downloads.
          </p>
        </div>

        {/* Live Audio Control Card */}
        <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-2xl bg-[#08080c] border border-white/10 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Procedural Web Audio Noise Engine</h3>
                <span className="text-xs text-zinc-400 font-mono">HTML5 AudioContext • Zero Network Assets</span>
              </div>
            </div>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 font-bold">
              Synthesizer Active
            </span>
          </div>

          {/* Noise Type Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            {(['rain', 'pink', 'white', 'brown'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setAudioType(type);
                  if (isPlaying) startSound(type);
                }}
                className={`p-3 rounded-xl text-center border font-bold capitalize transition-all ${
                  audioType === type
                    ? 'bg-amber-600/30 border-amber-500 text-white shadow-lg'
                    : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {type} Sound
              </button>
            ))}
          </div>

          {/* Volume Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-400 font-mono">
              <span>Synthesizer Volume:</span>
              <span className="text-amber-400 font-bold">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-amber-500 bg-zinc-800 h-2 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Play/Stop Toggle */}
          {isPlaying ? (
            <button
              onClick={stopSound}
              className="w-full py-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop Ambient Audio Synthesizer
            </button>
          ) : (
            <button
              onClick={() => startSound(audioType)}
              className="w-full py-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              Synthesize Ambient {audioType.toUpperCase()} Focus Sound Live
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
