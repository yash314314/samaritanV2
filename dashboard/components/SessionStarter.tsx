"use client";

import { useState } from "react";
import { focusApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Target, Clock, Shield, ShieldAlert, ShieldCheck, Eye } from "lucide-react";

export function SessionStarter() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [enforcement, setEnforcement] = useState<"observe" | "warn" | "block" | "require_reason">("warn");
  const [loading, setLoading] = useState(false);

  const enforcementOptions = [
    { value: "observe" as const, label: "Observe", icon: Eye, desc: "Log only, no alerts" },
    { value: "warn" as const, label: "Warn", icon: ShieldAlert, desc: "Notification on distraction" },
    { value: "block" as const, label: "Block", icon: Shield, desc: "Block distracting apps" },
    { value: "require_reason" as const, label: "Require Reason", icon: ShieldCheck, desc: "Ask for justification" },
  ];

  const handleStart = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    try {
      await focusApi.start({
        goal: goal.trim(),
        plannedMinutes: minutes,
        enforcement,
      });
      router.push("/focus");
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Target className="w-6 h-6 text-blue-500" />
        Start Deep Work Session
      </h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">What&apos;s your goal?</label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g., Write API documentation"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Duration (minutes)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-white font-mono text-lg w-16 text-right">{minutes}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-3">Distraction Protection</label>
          <div className="grid grid-cols-2 gap-3">
            {enforcementOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEnforcement(opt.value)}
                className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                  enforcement === opt.value
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <opt.icon className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs opacity-70">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!goal.trim() || loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Target className="w-5 h-5" />
              Start Session
            </>
          )}
        </button>
      </div>
    </div>
  );
}