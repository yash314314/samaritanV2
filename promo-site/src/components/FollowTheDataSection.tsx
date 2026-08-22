import React, { useState } from 'react';
import { Network } from 'lucide-react';

interface Scenario {
  id: string;
  title: string;
  action: string;
  steps: {
    layer: string;
    title: string;
    detail: string;
    codeSnippet?: string;
  }[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'start-focus',
    title: 'User Clicks "Start Deep Work Focus Block"',
    action: 'POST /api/focus/start',
    steps: [
      {
        layer: 'Frontend UI',
        title: '1. React Event Handler Triggers',
        detail: 'User submits focus block form with 25m Pomodoro, Warn enforcement, and Rain sound.',
        codeSnippet: 'deepWorkApi.start({ plannedMinutes: 25, enforcement: "warn" })'
      },
      {
        layer: 'HTTP Transport',
        title: '2. Express REST API Request',
        detail: 'POST request sent to http://localhost:4000/api/focus/start with JSON payload.',
        codeSnippet: 'POST /api/focus/start HTTP/1.1 { userId, plannedMinutes: 25 }'
      },
      {
        layer: 'Express Router',
        title: '3. Router & Validation Middleware',
        detail: 'Routes request to focus.ts, validates userId UUID and planned duration parameters.',
        codeSnippet: 'router.post("/start", async (req, res) => startDeepWorkSession(req.body))'
      },
      {
        layer: 'Classifier Service',
        title: '4. DeepWorkService Initialization',
        detail: 'Computes phase start/end timestamps, sets active enforcement rules, and initializes minute log.',
        codeSnippet: 'prisma.deepWorkSession.create({ data: { status: "active", enforcement: "warn" } })'
      },
      {
        layer: 'PostgreSQL 15',
        title: '5. Prisma ORM Persistence',
        detail: 'Inserts row into DeepWorkSession table and generates DeepWorkPhase records.',
        codeSnippet: 'INSERT INTO "DeepWorkSession" (id, status, enforcement) VALUES (...)'
      },
      {
        layer: 'WebSocket Engine',
        title: '6. Realtime Broadcast Event',
        detail: 'WebSocket manager broadcasts deepwork:started event to desktop observer and dashboard.',
        codeSnippet: 'emitDeepWorkChanged(userId, "started", session)'
      },
      {
        layer: 'Updated UI',
        title: '7. Dashboard UI State Updates',
        detail: 'Dashboard activates top countdown timer, starts Web Audio rain engine, and sets observer overlay.',
        codeSnippet: 'setSessionActive(true); startAmbientSound("rain");'
      }
    ]
  },
  {
    id: 'window-switch',
    title: 'User Switches Foreground Desktop Window',
    action: '500ms Active Window Tick Stream',
    steps: [
      {
        layer: 'Desktop Observer',
        title: '1. Win32 Active Window Sampling',
        detail: 'Electron observer queries GetForegroundWindow() and detects switch to "Cursor - samaritanV2".',
        codeSnippet: 'activeWin().then(window => sendTickToWebSocket(window))'
      },
      {
        layer: 'WebSocket Stream',
        title: '2. WS Message Transmitted',
        detail: 'Pushes JSON payload over ws://localhost:4000/ws with sequence index.',
        codeSnippet: 'ws.send(JSON.stringify({ type: "activity:tick", appName: "Cursor.exe" }))'
      },
      {
        layer: 'Classifier Service',
        title: '3. Multi-Layer Pattern Classifier',
        detail: 'Matches "Cursor.exe" against AppPattern regex rules -> Category: coding, Intent: productive (0.96 focus weight).',
        codeSnippet: 'classifyContext({ appName: "Cursor", windowTitle: "samaritanV2" })'
      },
      {
        layer: 'Metric Engine',
        title: '4. Duration-Weighted Focus Curve',
        detail: 'Recalculates focus score and updates Shannon entropy index based on switch frequency.',
        codeSnippet: 'updateFocusScore(session, currentImpact, deltaMs)'
      },
      {
        layer: 'PostgreSQL 15',
        title: '5. Activity Table Ingest',
        detail: 'Appends 500ms duration tick to Activity database table.',
        codeSnippet: 'prisma.activity.create({ data: { sessionId, appName: "Cursor" } })'
      },
      {
        layer: 'Updated UI',
        title: '6. Realtime Focus Score Curve Renders',
        detail: 'Home dashboard updates focus score indicator and timeline sparkline without full page reload.',
        codeSnippet: 'useWsMessage("activity:current", updateLiveScore)'
      }
    ]
  }
];

export const FollowTheDataSection: React.FC = () => {
  const [activeScenarioId, setActiveScenarioId] = useState('start-focus');
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const activeScenario = SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];

  return (
    <section id="dataflow" className="py-28 bg-[#050507] border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            <Network className="w-3.5 h-3.5" />
            Signature Chapter • End-to-End Tracing
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Follow The Data Inside Samaritan
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4 leading-relaxed">
            Select a critical application user action below to trace its journey from browser click, across HTTP/WebSocket transport, through Express controllers, into Prisma SQL database persistence, and back to the updated UI.
          </p>

          {/* Scenario Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                onClick={() => {
                  setActiveScenarioId(sc.id);
                  setActiveStepIndex(0);
                }}
                className={`px-5 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeScenarioId === sc.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30'
                    : 'bg-[#0A0A0F] text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {sc.title}
              </button>
            ))}
          </div>
        </div>

        {/* Data Trace Timeline Explorer */}
        <div className="bg-[#0A0A0F] rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-8">
          {/* Step Selector Pipeline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {activeScenario.steps.map((st, i) => (
              <button
                key={i}
                onClick={() => setActiveStepIndex(i)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  activeStepIndex === i
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg font-bold'
                    : i < activeStepIndex
                    ? 'bg-indigo-950/20 border-indigo-500/30 text-indigo-300'
                    : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <div className="text-[10px] font-mono font-bold text-indigo-400 uppercase">{st.layer}</div>
                <div className="text-xs truncate font-bold text-white mt-1">{i + 1}. {st.title.split('.')[1]}</div>
              </button>
            ))}
          </div>

          {/* Step Detail Card */}
          {activeScenario.steps[activeStepIndex] && (
            <div className="p-6 rounded-2xl bg-[#0F0F16] border border-indigo-500/30 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                  Layer: {activeScenario.steps[activeStepIndex].layer}
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  Step {activeStepIndex + 1} of {activeScenario.steps.length}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white">
                {activeScenario.steps[activeStepIndex].title}
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {activeScenario.steps[activeStepIndex].detail}
              </p>

              {activeScenario.steps[activeStepIndex].codeSnippet && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Executed Code:</span>
                  <pre className="p-4 rounded-xl bg-black border border-white/10 font-mono text-xs text-indigo-200 overflow-x-auto">
                    <code>{activeScenario.steps[activeStepIndex].codeSnippet}</code>
                  </pre>
                </div>
              )}

              {/* Navigation Next/Prev */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  disabled={activeStepIndex === 0}
                  onClick={() => setActiveStepIndex(activeStepIndex - 1)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white disabled:opacity-40"
                >
                  ← Previous Step
                </button>
                <button
                  disabled={activeStepIndex === activeScenario.steps.length - 1}
                  onClick={() => setActiveStepIndex(activeStepIndex + 1)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  Next Step →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
