"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Lock, MessageSquare, X } from "lucide-react";

type FocusEvent = {
  appName?: string;
  action?: string;
  interventionId?: string | null;
  showReason?: boolean;
  message?: string;
};

type SamaritanApi = {
  onFocusBlocked?: (callback: (event: unknown, data: FocusEvent) => void) => void;
  onIntervention?: (callback: (event: unknown, data: FocusEvent) => void) => void;
  onFocusCleared?: (callback: (event: unknown, data: FocusEvent) => void) => void;
  requestOverride?: (reason: string) => void;
};

declare global {
  interface Window {
    samaritanAPI?: SamaritanApi;
  }
}

function normalizeEvent(data: FocusEvent): FocusEvent {
  return {
    appName: data.appName || "This app",
    action: data.action || "blocked",
    interventionId: data.interventionId ?? null,
    showReason: Boolean(data.showReason || data.action === "reason_required"),
    message: data.message || "This activity is outside your active deep work protocol.",
  };
}

export default function ElectronFocusBridge() {
  const [event, setEvent] = useState<FocusEvent | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const api = window.samaritanAPI;
    if (!api) return;

    api.onFocusBlocked?.((_ipcEvent, data) => {
      setEvent(normalizeEvent(data || {}));
    });

    api.onIntervention?.((_ipcEvent, data) => {
      const normalized = normalizeEvent(data || {});
      if (normalized.action === "observed" || normalized.action === "observe") return;
      setEvent((current) => {
        const currentIsBlock = current?.action === "blocked" || current?.action === "block";
        const nextIsBlock = normalized.action === "blocked" || normalized.action === "block";
        if (currentIsBlock && !nextIsBlock) return current;
        return normalized;
      });
    });

    api.onFocusCleared?.(() => {
      setEvent(null);
      setReason("");
    });
  }, []);

  if (!event) return null;

  const requiresReason = event.showReason || event.action === "reason_required";
  const isBlock = event.action === "blocked" || event.action === "block";
  const canDismiss = !isBlock || requiresReason;
  const Icon = requiresReason ? MessageSquare : isBlock ? Lock : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-rose-500/30 bg-zinc-950 p-5 shadow-2xl shadow-rose-950/40">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Deep work protection
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                {event.appName} triggered your focus rules.
              </p>
            </div>
          </div>
          {canDismiss && (
            <button
              onClick={() => setEvent(null)}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
          {event.message}
        </div>

        {requiresReason ? (
          <div className="mt-4 space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you need this during deep work?"
              className="min-h-24 w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500/60"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEvent(null)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const clean = reason.trim();
                  if (!clean) return;
                  window.samaritanAPI?.requestOverride?.(clean);
                  setReason("");
                  setEvent(null);
                }}
                className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-400"
              >
                Submit reason
              </button>
            </div>
          </div>
        ) : (
          canDismiss ? (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setEvent(null)}
                className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
              >
                Back to focus
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              Return to an allowed app or domain to clear this block.
            </div>
          )
        )}
      </div>
    </div>
  );
}
