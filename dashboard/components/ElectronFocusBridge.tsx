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
    <div className="sam-ui fixed inset-0 z-[100] flex items-center justify-center bg-void/90 px-4" role="alertdialog" aria-modal="true" aria-labelledby="focus-guard-title" aria-describedby="focus-guard-message">
      <div className="w-full max-w-md border border-grid border-t-alert bg-void p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-alert" strokeWidth={1.5} />
            <div>
              <h2 id="focus-guard-title" className="font-display text-[15px] uppercase tracking-[0.06em] text-signal">
                Deep work protection
              </h2>
              <p className="mt-1 text-[12px] text-key">
                {event.appName} triggered your focus rules.
              </p>
            </div>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={() => setEvent(null)}
              className="text-key transition-colors hover:text-signal"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        <p id="focus-guard-message" className="border-l border-alert pl-3 text-[13px] text-trace">
          {event.message}
        </p>

        {requiresReason ? (
          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="sam-key mb-1.5 block">Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need this during deep work?"
                className="sam-input min-h-24 w-full resize-none py-2"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEvent(null)} className="sam-button">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const clean = reason.trim();
                  if (!clean) return;
                  window.samaritanAPI?.requestOverride?.(clean);
                  setReason("");
                  setEvent(null);
                }}
                disabled={!reason.trim()}
                className="sam-button"
                data-variant="primary"
              >
                Submit reason
              </button>
            </div>
          </div>
        ) : (
          canDismiss ? (
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setEvent(null)} className="sam-button" data-variant="primary">
                Back to focus
              </button>
            </div>
          ) : (
            <p className="mt-5 text-[12px] text-key">
              Return to an allowed app or domain to clear this block.
            </p>
          )
        )}
      </div>
    </div>
  );
}
