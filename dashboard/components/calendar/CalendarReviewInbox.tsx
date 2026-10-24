"use client";

import { useState } from "react";
import { CheckCheck, CheckCircle2, Clock3, Pencil, Radio, Video, X, XCircle } from "lucide-react";
import { calendarTimeLabel } from "@/lib/calendarTime";

export type ReviewSession = {
  id: string;
  title: string;
  type: "meeting" | "focus" | "break";
  source: "calendar" | "manual" | "activity";
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  actualDurationMs: number;
  confidence: number;
  reviewReason: string | null;
  project?: { id: string; name: string; color: string } | null;
  _count?: { evidence: number };
};

type Action = "confirm" | "reject" | "missed";

type Props = {
  open: boolean;
  sessions: ReviewSession[];
  timeZone: string;
  onClose: () => void;
  onReview: (id: string, action: Action) => Promise<void>;
  onApproveAll: () => Promise<void>;
  onCorrect: (session: ReviewSession) => void;
};

function duration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function dateLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(value));
}

export function CalendarReviewInbox({ open, sessions, timeZone, onClose, onReview, onApproveAll, onCorrect }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function runReview(id: string, action: Action) {
    setBusyId(id);
    setError("");
    try {
      await onReview(id, action);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  }

  async function approveAll() {
    setApprovingAll(true);
    setError("");
    try {
      await onApproveAll();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Bulk review failed");
    } finally {
      setApprovingAll(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="Calendar review inbox" className="grid h-full w-full max-w-xl grid-rows-[auto_minmax(0,1fr)] border-l border-red-500/30 bg-black">
        <header className="border-b border-zinc-800 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase text-red-500">Attendance review</div>
              <h2 className="mt-1 text-lg font-semibold text-zinc-100">{sessions.length} session{sessions.length === 1 ? "" : "s"} need a decision</h2>
              <p className="mt-1 text-xs text-zinc-500">Calendar plans with insufficient meeting-app evidence stay out of confirmed totals until reviewed.</p>
            </div>
            <button type="button" onClick={onClose} title="Close review inbox" className="rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-600"><Radio className="h-3.5 w-3.5 text-red-500" />Live review queue</div>
            <button
              type="button"
              onClick={approveAll}
              disabled={!sessions.length || approvingAll}
              className="sam-button" data-variant="primary"
            >
              <CheckCheck className="h-4 w-4" />
              {approvingAll ? "Approving" : "Approve all"}
            </button>
          </div>
          {error && <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
        </header>

        <div className="min-h-0 overflow-y-auto">
          {sessions.map((session) => {
            const scheduledMs = session.scheduledStart && session.scheduledEnd
              ? Math.max(0, new Date(session.scheduledEnd).getTime() - new Date(session.scheduledStart).getTime())
              : 0;
            const detectedPercent = scheduledMs > 0 ? Math.min(100, (session.actualDurationMs / scheduledMs) * 100) : 0;
            const busy = busyId === session.id || approvingAll;
            return (
              <article key={session.id} className="border-b border-zinc-900 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 shrink-0 text-zinc-300" />
                      <h3 className="truncate text-sm font-semibold text-zinc-200">{session.title}</h3>
                    </div>
                    {session.scheduledStart && session.scheduledEnd && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <Clock3 className="h-3 w-3" />
                        {dateLabel(session.scheduledStart, timeZone)} · {calendarTimeLabel(session.scheduledStart, timeZone)} to {calendarTimeLabel(session.scheduledEnd, timeZone)}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-400">Review</span>
                </div>

                <div className="mt-3 grid grid-cols-3 divide-x divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950/70">
                  <div className="px-3 py-2"><div className="text-xs font-medium text-zinc-200">{duration(scheduledMs)}</div><div className="text-[9px] uppercase text-zinc-600">Scheduled</div></div>
                  <div className="px-3 py-2"><div className="text-xs font-medium text-zinc-200">{duration(session.actualDurationMs)}</div><div className="text-[9px] uppercase text-zinc-600">Detected</div></div>
                  <div className="px-3 py-2"><div className="text-xs font-medium text-zinc-200">{session._count?.evidence ?? 0}</div><div className="text-[9px] uppercase text-zinc-600">Signals</div></div>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-900"><div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${detectedPercent}%` }} /></div>

                {session.reviewReason && <p className="mt-3 text-[11px] leading-5 text-zinc-500">{session.reviewReason}</p>}
                {session.project && <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: session.project.color }} />{session.project.name}</div>}

                <div className="mt-4 flex items-center gap-2">
                  <button type="button" disabled={busy} onClick={() => runReview(session.id, "confirm")} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" />Attended</button>
                  <button type="button" disabled={busy} onClick={() => runReview(session.id, "missed")} className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-40"><Clock3 className="h-3.5 w-3.5" />Missed</button>
                  <button type="button" disabled={busy} onClick={() => runReview(session.id, "reject")} title="Reject session" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"><XCircle className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={busy} onClick={() => onCorrect(session)} title="Correct session details" className="sam-button p-2"><Pencil className="h-3.5 w-3.5" /></button>
                </div>
              </article>
            );
          })}

          {sessions.length === 0 && (
            <div className="flex h-full min-h-72 flex-col items-center justify-center px-8 text-center">
              <CheckCheck className="h-7 w-7 text-zinc-400" />
              <div className="mt-3 text-sm font-medium text-zinc-200">Review queue cleared</div>
              <p className="mt-1 text-xs text-zinc-600">New uncertain sessions will appear here in real time.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
