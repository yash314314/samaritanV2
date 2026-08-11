"use client";

import { History, ChevronRight } from "lucide-react";

interface DeepWorkSession {
  id: string;
  goal?: string | null;
  status: string;
  plannedMinutes: number;
  focusScore?: number;
  finalFocusScore?: number;
  productivityScore?: number;
  startedAt: string;
  endedAt?: string | null;
}

interface DeepWorkHistoryCardProps {
  sessions: DeepWorkSession[];
  onViewResult: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusColor(status: string) {
  if (status === "completed") return "text-emerald-400";
  if (status === "abandoned") return "text-rose-400";
  if (status === "active") return "text-purple-400";
  return "text-zinc-500";
}

export default function DeepWorkHistoryCard({ sessions, onViewResult }: DeepWorkHistoryCardProps) {
  const recent = sessions.slice(0, 6);

  return (
    <div className="samaritan-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <History className="w-4 h-4 text-purple-500" />
            Deep Work History
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Recent sessions</p>
        </div>
        <span className="text-xs text-zinc-600 font-mono">{sessions.length}</span>
      </div>

      {recent.length === 0 ? (
        <p className="text-xs text-zinc-600 flex-1 flex items-center justify-center">No sessions yet</p>
      ) : (
        <ul className="space-y-2 flex-1 overflow-y-auto">
          {recent.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onViewResult(session.id)}
                className="w-full text-left p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-200 truncate">
                      {session.goal || "Deep work session"}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {formatDate(session.startedAt)} · {session.plannedMinutes}m
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                  <span className={`capitalize ${statusColor(session.status)}`}>{session.status}</span>
                  {(session.finalFocusScore != null || session.focusScore != null) && (
                    <span className="text-zinc-500 font-mono">
                      Focus {Math.round(session.finalFocusScore ?? session.focusScore ?? 0)}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
