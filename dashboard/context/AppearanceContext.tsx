"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  applyAppearance,
  resolveAppearance,
  type Appearance,
} from "../lib/appearance";
import { getUserId } from "../lib/api";
import { useWsMessage } from "../lib/ws";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// A broadcast arriving this soon after a local change is our own echo (or
// older); applying it could undo a newer choice.
const ECHO_WINDOW_MS = 3000;
const SAVE_DELAY_MS = 400;

/* ---------------- STORE ---------------- */

let current: Appearance | null = null;
const listeners = new Set<() => void>();

function readStored(): Appearance {
  if (current) return current;
  try {
    current = resolveAppearance(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? "null"));
  } catch {
    current = DEFAULT_APPEARANCE;
  }
  return current;
}

function commit(next: Appearance) {
  current = next;
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: the API copy still persists it.
  }
  applyAppearance(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ---------------- CONTEXT ---------------- */

export type SaveState = "idle" | "saving" | "saved" | "error";

type AppearanceContextValue = {
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
  resetAppearance: () => void;
  saveState: SaveState;
  saveError: string | null;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const appearance = useSyncExternalStore(subscribe, readStored, () => DEFAULT_APPEARANCE);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const lastLocalChange = useRef(0);

  // The API copy wins on load: it follows the user between the browser and
  // the desktop app, which keep separate local storage.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/preferences/appearance?userId=${encodeURIComponent(getUserId())}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.appearance && Date.now() - lastLocalChange.current > ECHO_WINDOW_MS) {
          commit(resolveAppearance({ ...readStored(), ...data.appearance }));
        }
      })
      .catch(() => {
        // API offline: keep the locally stored appearance.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useWsMessage<Partial<Appearance>>("appearance:changed", (payload) => {
    if (Date.now() - lastLocalChange.current < ECHO_WINDOW_MS) return;
    commit(resolveAppearance({ ...readStored(), ...payload }));
  });

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const setAppearance = useCallback((patch: Partial<Appearance>) => {
    const next = resolveAppearance({ ...readStored(), ...patch });
    lastLocalChange.current = Date.now();
    commit(next);

    setSaveState("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetch(`${API_BASE}/api/preferences/appearance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: getUserId(), appearance: next }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.error ?? `Server responded ${response.status}`);
          }
          lastLocalChange.current = Date.now();
          setSaveState("saved");
          setSaveError(null);
        })
        .catch((error) => {
          setSaveState("error");
          setSaveError(
            error instanceof TypeError
              ? "Saved on this device only. The API is unreachable, so other devices will not see this change."
              : `Saved on this device only. ${error.message}`
          );
        });
    }, SAVE_DELAY_MS);
  }, []);

  const resetAppearance = useCallback(() => setAppearance(DEFAULT_APPEARANCE), [setAppearance]);

  const value = useMemo(
    () => ({ appearance, setAppearance, resetAppearance, saveState, saveError }),
    [appearance, setAppearance, resetAppearance, saveState, saveError]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
