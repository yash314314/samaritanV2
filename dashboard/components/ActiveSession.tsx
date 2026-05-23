"use client";

import { useActiveSession } from "@/app/hooks/useActiveSession";
import { useTimer } from "@/app/hooks/useTimer";
import { focusApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Timer, StopCircle, AlertTriangle, Shield, Eye, ShieldCheck } from "lucide-react";

export function ActiveSession() {
  const { data: status, loading, refetch } = useActiveSession();
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 animate-pulse">
        <div className="h-8 bg-zinc-800 rounded w-1/3 mb-4" />
        <div className="h-24 bg-zinc-800 rounded" />
      </div>
    );
  }

  if (!status?.active || !status.session) return null;

  const session = status.session;
  const { remainingFormatted, elapsedFormatted, isExpired } = useTimer(
    session.plannedMinutes,
    new Date(Date.now() - session.elapsedMinutes * 60000).toISOString()
  );

  const handleEnd = async (endStatus: "completed" | "abandoned") => {
    try {
      await focusApi.end(session.id, endStatus);
      router.push(`/history?highlight=${session.id}`);
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  };

  const getEnforcementIcon = () => {
    switch (session.enforcement) {
      case "block": return <Shield className="w-5 h-5 text-red-400" />;
      case "warn": return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case "require_reason": return <ShieldCheck className="w-5 h-5 text-purple-400" />;
      default: return <Eye className="w-5 h-5 text-zinc-400" />;
    }
  };

  const getEnforcementLabel = () => {
    switch (session.enforcement) {
      case "block": return "Blocking";
      case "warn": return "Warning";
      case "require_reason": return "Reason Required";
      default: return "Observing";
    }
  };

  return (
    <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
            {getEnforcementIcon()}
            <span>{getEnforcementLabel()}</span>
            {session.violationCount > 0 && (
              <span className="text-red-400 ml-2">
                • {session.violationCount} violation{session.violationCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-white">{session.goal || "Deep Work Session"}</h2>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-mono font-bold ${isExpired ? "text-red-400" : "text-white"}`}>
            {remainingFormatted}
          </div>
          <div className="text-sm text-zinc-500">remaining</div>
        </div>
      </div>

      <div className="w-full bg-zinc-800 rounded-full h-3 mb-6">
        <div
          className={`h-3 rounded-full transition-all ${isExpired ? "bg-red-500" : "bg-blue-500"}`}
          style={{ width: `${Math.min(100, (session.elapsedMinutes / session.plannedMinutes) * 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-500 mb-1">Elapsed</div>
          <div className="text-xl font-mono text-white">{elapsedFormatted}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-500 mb-1">Focus Score</div>
          <div className="text-xl font-mono text-blue-400">{session.focusScore.toFixed(1)}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-500 mb-1">Planned</div>
          <div className="text-xl font-mono text-white">{session.plannedMinutes}m</div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleEnd("completed")}
          className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <StopCircle className="w-5 h-5" />
          Complete
        </button>
        <button
          onClick={() => handleEnd("abandoned")}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Timer className="w-5 h-5" />
          Abandon
        </button>
      </div>
    </div>
  );
}