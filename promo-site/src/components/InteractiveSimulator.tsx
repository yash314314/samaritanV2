import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  ShieldAlert,
  Volume2,
  Square,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Motion3DSection } from './Motion3DSection';

interface AppPreset {
  id: string;
  name: string;
  category: string;
  focusWeight: number;
  intent: string;
  title: string;
}

const APPS: AppPreset[] = [
  {
    id: 'cursor',
    name: 'Cursor IDE',
    category: 'coding',
    focusWeight: 96,
    intent: 'productive',
    title: 'samaritanV2/api/src/services/metricsEngine.ts'
  },
  {
    id: 'figma',
    name: 'Figma',
    category: 'design',
    focusWeight: 88,
    intent: 'productive',
    title: 'Samaritan V2 UI System & Component Library'
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    category: 'social_media',
    focusWeight: 15,
    intent: 'distracting',
    title: 'Twitter / X — Live Feed'
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    focusWeight: 45,
    intent: 'neutral',
    title: '#engineering — Architecture RFC Discussion'
  }
];

export const InteractiveSimulator: React.FC = () => {
  // 1. Live Window Observer State
  const [selectedApp, setSelectedApp] = useState<AppPreset>(APPS[0]);

  // 2. Enforcement Simulator State
  const [enforcementMode, setEnforcementMode] = useState<'observe' | 'warn' | 'require_reason' | 'block'>('warn');
  const [blockedAppTriggered, setBlockedAppTriggered] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [reasonApproved, setReasonApproved] = useState(false);

  // 3. Web Audio Noise Synthesizer State
  const [audioType, setAudioType] = useState<'rain' | 'pink' | 'white' | 'brown'>('rain');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2);

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
          data[i] *= 0.8;
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

  const triggerEnforcementSimulation = () => {
    setBlockedAppTriggered(true);
    setReasonApproved(false);
  };

  return (
    <section id="simulator" className="py-24 bg-[#08080A] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Motion3DSection direction="up">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Interactive Technology Sandbox
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
              Simulate Samaritan's Engine Live
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg mt-4">
              Test Samaritan’s active window classifier, 4 enforcement protocols, and Web Audio ambient noise generator directly in your browser.
            </p>
          </div>
        </Motion3DSection>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1: Live Window Observer Simulator */}
          <Motion3DSection direction="left" delay={0.1}>
            <div className="p-6 rounded-2xl bg-[#0B0B0D] border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-mono">
                  <Activity className="w-4 h-4 text-purple-400" />
                  1. LIVE WINDOW OBSERVER
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  500ms Active
                </span>
              </div>

              <p className="text-xs text-zinc-400">
                Select an application to simulate switching desktop windows. Observe how category, intent, and focus impact update instantly:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {APPS.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      selectedApp.id === app.id
                        ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg'
                        : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{app.name}</div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{app.category}</div>
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-black/80 border border-white/10 font-mono text-xs space-y-2">
                <div className="flex justify-between text-zinc-400">
                  <span>Current Active Window:</span>
                  <span className="text-purple-300 font-bold">{selectedApp.name}</span>
                </div>
                <div className="text-zinc-500 text-[10px] truncate">
                  Title: {selectedApp.title}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-zinc-400">Category:</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                    selectedApp.intent === 'productive'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : selectedApp.intent === 'distracting'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {selectedApp.intent}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Focus Weight:</span>
                  <span className="text-white font-bold">{selectedApp.focusWeight}%</span>
                </div>
              </div>

              <div className="text-[10px] font-mono text-zinc-500 text-center">
                WebSocket Payload Ingested via <code className="text-purple-300">ws://localhost:4000/ws</code>
              </div>
            </div>
          </Motion3DSection>

          {/* Column 2: Deep Work Enforcement Simulator */}
          <Motion3DSection direction="up" delay={0.2}>
            <div className="p-6 rounded-2xl bg-[#0B0B0D] border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-mono">
                  <ShieldAlert className="w-4 h-4 text-pink-400" />
                  2. DEEP WORK ENFORCEMENT
                </div>
                <span className="text-[10px] font-mono text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
                  4 Modes
                </span>
              </div>

              <p className="text-xs text-zinc-400">
                Test how Samaritan handles disallowed apps under each enforcement policy:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {(['observe', 'warn', 'require_reason', 'block'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setEnforcementMode(mode);
                      setBlockedAppTriggered(false);
                      setReasonApproved(false);
                    }}
                    className={`p-2.5 rounded-xl text-center border text-xs font-mono capitalize transition-all ${
                      enforcementMode === mode
                        ? 'bg-pink-600/20 border-pink-500 text-white font-bold shadow-lg'
                        : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {mode.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <button
                onClick={triggerEnforcementSimulation}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold text-xs shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
              >
                <ShieldAlert className="w-4 h-4" />
                Simulate Launching Blocked App
              </button>

              {/* Simulation Result Box */}
              {blockedAppTriggered && (
                <div className="p-4 rounded-xl bg-black/90 border border-pink-500/40 space-y-3 animate-fadeIn">
                  <div className="text-xs font-bold text-pink-300 uppercase font-mono">
                    Mode: {enforcementMode.replace('_', ' ')}
                  </div>

                  {enforcementMode === 'observe' && (
                    <p className="text-xs text-zinc-300">
                      ℹ️ App launch logged quietly. Focus score decay initiated in background.
                    </p>
                  )}

                  {enforcementMode === 'warn' && (
                    <p className="text-xs text-amber-300 font-medium">
                      ⚠️ Warning Toast Displayed: "Distracting app opened during Deep Work session."
                    </p>
                  )}

                  {enforcementMode === 'require_reason' && (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-300">Enter justification to proceed:</p>
                      <input
                        type="text"
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        placeholder="e.g. Urgent customer support bug..."
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white"
                      />
                      <button
                        onClick={() => setReasonApproved(true)}
                        className="px-3 py-1 rounded bg-purple-600 text-white text-xs font-medium"
                      >
                        Submit Reason
                      </button>
                      {reasonApproved && (
                        <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Exception granted for 15 minutes.
                        </div>
                      )}
                    </div>
                  )}

                  {enforcementMode === 'block' && (
                    <p className="text-xs text-red-400 font-mono font-bold">
                      🛑 PROCESS TERMINATED: Executable killed via Electron process control.
                    </p>
                  )}
                </div>
              )}

              <div className="text-[10px] font-mono text-zinc-500 text-center">
                Preemptive local Windows process control via Electron
              </div>
            </div>
          </Motion3DSection>

          {/* Column 3: Web Audio Sound Synthesizer */}
          <Motion3DSection direction="right" delay={0.3}>
            <div className="p-6 rounded-2xl bg-[#0B0B0D] border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-mono">
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  3. PROCEDURAL WEB AUDIO ENGINE
                </div>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Zero Assets
                </span>
              </div>

              <p className="text-xs text-zinc-400">
                Play synthesized ambient focus sound generated in real time using browser Web Audio nodes:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {(['rain', 'pink', 'white', 'brown'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setAudioType(type);
                      if (isPlaying) startSound(type);
                    }}
                    className={`p-2.5 rounded-xl text-center border text-xs font-mono capitalize transition-all ${
                      audioType === type
                        ? 'bg-amber-600/20 border-amber-500 text-white font-bold shadow-lg'
                        : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {type} Sound
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                  <span>Volume Level:</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {isPlaying ? (
                <button
                  onClick={stopSound}
                  className="w-full py-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Stop Ambient Sound Engine
                </button>
              ) : (
                <button
                  onClick={() => startSound(audioType)}
                  className="w-full py-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                  Synthesize Ambient {audioType} Sound
                </button>
              )}

              <div className="text-[10px] font-mono text-zinc-500 text-center">
                HTML5 Web Audio API • No audio files downloaded
              </div>
            </div>
          </Motion3DSection>
        </div>
      </div>
    </section>
  );
};
