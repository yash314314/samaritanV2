"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearApiCache } from "./api";
import type { WsMessage } from "./ws";
import { useWsAll } from "./ws";

const DEFAULT_EVENTS = [
  "activity:new",
  "session:metrics",
  "analytics:daily",
  "deepwork:started",
  "deepwork:ended",
  "deepwork:state",
  "deepwork:minute",
  "deepwork:expired",
  "intervention:triggered",
  "intervention:resolved",
  "calendar:changed",
  "goal:changed",
  "goal:progress",
];

type RealtimeRefreshOptions = {
  events?: string[];
  debounceMs?: number;
  enabled?: boolean;
};

export function useRealtimeRefresh(
  onRefresh?: () => void | Promise<void>,
  options: RealtimeRefreshOptions = {}
) {
  const { events = DEFAULT_EVENTS, debounceMs = 600, enabled = true } = options;
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshRef = useRef(onRefresh);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const eventsKey = events.join("|");
  const eventSet = useMemo(() => new Set(events), [eventsKey]);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (!enabled) return;

    clearApiCache();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      Promise.resolve(refreshRef.current?.())
        .catch((err) => console.error("Realtime refresh failed:", err))
        .finally(() => {
          if (mountedRef.current) {
            setRefreshVersion((version) => version + 1);
          }
        });
    }, debounceMs);
  }, [debounceMs, enabled]);

  useWsAll(
    useCallback(
      (msg: WsMessage) => {
        if (eventSet.has(msg.type)) {
          scheduleRefresh();
        }
      },
      [eventSet, scheduleRefresh]
    )
  );

  return { refreshVersion, refreshNow: scheduleRefresh };
}
