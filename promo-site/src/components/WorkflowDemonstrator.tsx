import React, { useState } from 'react';
import { Play, CheckCircle2, Sliders } from 'lucide-react';

export const WorkflowDemonstrator: React.FC = () => {
  // Workflow 1: Deep Work Focus Protocol Setup
  const [timerMode, setTimerMode] = useState<'countdown' | 'pomodoro'>('pomodoro');
  const [enforcement, setEnforcement] = useState<'observe' | 'warn' | 'require_reason' | 'block'>('warn');
  const [sound, setSound] = useState<'none' | 'rain' | 'pink' | 'white' | 'brown'>('rain');
  const [sessionActive, setSessionActive] = useState(false);

  // Workflow 2: Rule Creator State
  const [appNameInput, setAppNameInput] = useState('Cursor');
  const [titleKeywordInput, setTitleKeywordInput] = useState('samaritanV2');
  const [ruleCreated, setRuleCreated] = useState(false);

  const toggleSession = () => {
    setSessionActive(!sessionActive);
  };

  return (
    <section id="workflows" className="py-28 bg-[#07070A] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <Sliders className="w-3.5 h-3.5" />
            Chapter 03 • Interactive Workflows
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Live Application Workflow Demonstrator
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Test Samaritan’s core user interactions live in your browser. Every UI state mutation directly reflects Samaritan’s frontend-to-backend API contract.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Workflow Card 1: Deep Work Focus Protocol Controls */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#0A0A0F] border border-white/10 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">1. Start Deep Work Protocol</h3>
                  <span className="text-xs text-zinc-400 font-mono">POST /api/focus/start</span>
                </div>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 font-bold">
                Live Simulator
              </span>
            </div>

            {/* Controls Grid */}
            <div className="space-y-4 text-xs">
              {/* Timer Mode */}
              <div>
                <label className="text-zinc-400 font-mono font-bold mb-2 block">Timer Mode:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['countdown', 'pomodoro'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setTimerMode(m)}
                      className={`p-2.5 rounded-xl border text-center font-mono capitalize transition-all ${
                        timerMode === m
                          ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold'
                          : 'bg-zinc-900 border-white/5 text-zinc-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enforcement Policy */}
              <div>
                <label className="text-zinc-400 font-mono font-bold mb-2 block">Enforcement Policy:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['observe', 'warn', 'require_reason', 'block'] as const).map((e) => (
                    <button
                      key={e}
                      onClick={() => setEnforcement(e)}
                      className={`p-2 rounded-lg border text-[11px] font-mono capitalize transition-all ${
                        enforcement === e
                          ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold'
                          : 'bg-zinc-900 border-white/5 text-zinc-400'
                      }`}
                    >
                      {e.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ambient Sound */}
              <div>
                <label className="text-zinc-400 font-mono font-bold mb-2 block">Ambient Noise Engine:</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(['none', 'rain', 'pink', 'white', 'brown'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSound(s)}
                      className={`p-2 rounded-lg border text-[11px] font-mono capitalize transition-all ${
                        sound === s
                          ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold'
                          : 'bg-zinc-900 border-white/5 text-zinc-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Session Action Trigger */}
            {sessionActive ? (
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-indigo-300">
                    FOCUS SESSION ACTIVE • 25:00
                  </span>
                  <button
                    onClick={toggleSession}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 border border-red-500/40 text-xs font-mono font-bold hover:bg-red-600/30"
                  >
                    End Session
                  </button>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono space-y-1">
                  <div>Enforcement: <span className="text-white uppercase font-bold">{enforcement}</span></div>
                  <div>Ambient Sound: <span className="text-indigo-300 uppercase font-bold">{sound}</span></div>
                </div>
              </div>
            ) : (
              <button
                onClick={toggleSession}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
              >
                <Play className="w-4 h-4 fill-current" />
                Initialize Deep Work Focus Session
              </button>
            )}
          </div>

          {/* Workflow Card 2: Create Project Attribution Rule */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#0A0A0F] border border-white/10 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">2. Create Project Attribution Rule</h3>
                  <span className="text-xs text-zinc-400 font-mono">POST /api/projects/:id/rules</span>
                </div>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 font-bold">
                Auto Tagger
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Test creating a rule to automatically attribute unassigned active windows matching an executable name or title keyword to a target project:
            </p>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-zinc-400 mb-1 block">Executable App Name:</label>
                <input
                  type="text"
                  value={appNameInput}
                  onChange={(e) => setAppNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 mb-1 block">Title Keyword / Regex:</label>
                <input
                  type="text"
                  value={titleKeywordInput}
                  onChange={(e) => setTitleKeywordInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={() => setRuleCreated(true)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-transform hover:scale-[1.01]"
              >
                Create Project Rule Payload
              </button>

              {ruleCreated && (
                <div className="p-4 rounded-xl bg-black border border-emerald-500/40 text-emerald-300 text-[11px] space-y-1">
                  <div className="font-bold">✓ RULE PERSISTED IN POSTGRESQL:</div>
                  <pre className="text-zinc-300 font-mono mt-1">
                    {JSON.stringify(
                      { appName: appNameInput, titleKeyword: titleKeywordInput, matchType: 'contains' },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
