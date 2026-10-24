"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { changePassword, endSession, listSessions, logoutEverywhere, type SessionInfo } from "../../lib/auth";

function describeClient(session: SessionInfo): string {
  if (session.client === "desktop") return "Desktop tracker";
  const agent = session.userAgent || "";
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : /Electron\//.test(agent) ? "Samaritan app" : "Browser";
  const os = /Linux/.test(agent) ? "Linux" : /Mac OS X/.test(agent) ? "macOS" : /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : "";
  return os ? `${browser} on ${os}` : browser;
}

function when(value: string | null): string {
  if (!value) return "never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/** Password change, live sessions and sign-out everywhere. */
export default function SecurityPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    listSessions()
      .then((rows) => {
        setSessions(rows);
        setSessionError(null);
      })
      .catch((error: Error) => setSessionError(error.message));
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next !== repeat) {
      setMessage({ tone: "error", text: "The new passwords do not match." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setRepeat("");
      setMessage({ tone: "ok", text: "Password changed. Every other session was signed out." });
      loadSessions();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Password change failed." });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await endSession(id);
      loadSessions();
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not end that session.");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-3" aria-labelledby="password-heading">
        <h3 id="password-heading" className="sam-key">Change password</h3>
        <label className="block">
          <span className="mb-1 block text-[11px] text-key">Current password</span>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="sam-input" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-key">New password (at least 10 characters)</span>
          <input type="password" autoComplete="new-password" minLength={10} maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} className="sam-input" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-key">Repeat new password</span>
          <input type="password" autoComplete="new-password" minLength={10} maxLength={72} value={repeat} onChange={(e) => setRepeat(e.target.value)} className="sam-input" required />
        </label>
        <button type="submit" disabled={busy} className="sam-button" data-variant="primary">
          {busy ? "Updating" : "Update password"}
        </button>
        {message && (
          <p role="status" className={`text-[12px] ${message.tone === "error" ? "text-alert" : "text-trace"}`}>
            {message.text}
          </p>
        )}
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="sam-key">Signed-in sessions</h3>
          <button type="button" onClick={() => void logoutEverywhere()} className="sam-button">
            Sign out everywhere
          </button>
        </div>
        {sessionError && <p className="text-[12px] text-alert">{sessionError}</p>}
        {!sessions && !sessionError && <p className="text-[12px] text-key">Loading sessions</p>}
        {sessions && (
          <ul className="divide-y divide-grid border-y border-grid">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-signal">
                    {describeClient(session)}
                    {session.current && <span className="ml-2 text-[11px] text-key">(this browser)</span>}
                  </div>
                  <div className="text-[11px] text-key">
                    Started {when(session.startedAt)} · last used {when(session.lastUsedAt)}
                  </div>
                </div>
                {!session.current && (
                  <button type="button" onClick={() => void revoke(session.id)} className="sam-button shrink-0">
                    End
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
