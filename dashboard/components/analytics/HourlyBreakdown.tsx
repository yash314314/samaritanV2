"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatCategory, getCategoryColor } from "@/lib/categoryColors";
import {
  HOUR_MS,
  IST_OFFSET_MS,
  formatDayKey,
  formatHMS,
  formatHour,
  formatTimeIST,
  istDateKey,
  istHour,
} from "@/lib/analyticsTime";
import type { TimelineItem, TimelineSession } from "./types";

const HOURS_PER_PAGE = 6;
const SESSIONS_PER_PAGE = 8;
const ITEMS_PREVIEW = 3;
// A runaway session (tracker left open) must not fan out into hundreds of hours.
const MAX_HOURS_PER_SESSION = 48;

export interface SessionEntry {
  session: TimelineSession;
  /** Time of the session inside the span it is listed under (ms). */
  overlapMs: number;
}

export interface HourGroup {
  key: string;
  date: string;
  hour: number;
  start: number;
  trackedMs: number;
  apps: string[];
  entries: SessionEntry[];
}

interface TimeWindow {
  start: number;
  end: number;
}

function sessionBounds(session: TimelineSession) {
  const start = Date.parse(session.start);
  const parsedEnd = Date.parse(session.end);
  const end = Number.isFinite(parsedEnd) && parsedEnd >= start ? parsedEnd : start + Math.max(0, session.duration || 0);
  return { start, end };
}

const newestFirst = (left: SessionEntry, right: SessionEntry) =>
  Date.parse(right.session.start) - Date.parse(left.session.start);

/**
 * Groups sessions by the IST hours they overlap. A session that crosses an
 * hour boundary is listed under each hour with the time it spent there, so an
 * hour's total never exceeds sixty minutes.
 */
export function groupSessionsByHour(sessions: TimelineSession[]): HourGroup[] {
  const groups = new Map<string, HourGroup>();
  for (const session of sessions) {
    const { start, end } = sessionBounds(session);
    if (!Number.isFinite(start)) continue;
    let hourStart = start - ((start + IST_OFFSET_MS) % HOUR_MS);
    for (let step = 0; step < MAX_HOURS_PER_SESSION; step += 1, hourStart += HOUR_MS) {
      if (step > 0 && hourStart >= end) break;
      const overlapMs = Math.max(0, Math.min(end, hourStart + HOUR_MS) - Math.max(start, hourStart));
      if (step > 0 && overlapMs === 0) break;
      const date = istDateKey(hourStart);
      const hour = istHour(hourStart);
      const key = `${date}|${String(hour).padStart(2, "0")}`;
      let group = groups.get(key);
      if (!group) {
        group = { key, date, hour, start: hourStart, trackedMs: 0, apps: [], entries: [] };
        groups.set(key, group);
      }
      group.entries.push({ session, overlapMs });
      group.trackedMs += overlapMs;
      if (!group.apps.includes(session.appName)) group.apps.push(session.appName);
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, entries: group.entries.sort(newestFirst) }))
    .sort((left, right) => right.start - left.start);
}

/** Sessions overlapping a span, newest first, with their time inside it. */
export function sessionsInWindow(sessions: TimelineSession[], span: TimeWindow): SessionEntry[] {
  return sessions
    .map((session) => {
      const { start, end } = sessionBounds(session);
      return { session, overlapMs: Math.max(0, Math.min(end, span.end) - Math.max(start, span.start)) };
    })
    .filter(({ overlapMs }) => overlapMs > 0)
    .sort(newestFirst);
}

function itemsInWindow(items: TimelineItem[], span: TimeWindow | null): TimelineItem[] {
  if (!span) return items;
  return items.flatMap((item) => {
    const start = Math.max(Date.parse(item.start), span.start);
    const end = Math.min(Date.parse(item.end), span.end);
    if (!(end > start)) return [];
    return [{ ...item, start: new Date(start).toISOString(), end: new Date(end).toISOString(), duration: end - start }];
  });
}

export function AppIcon({ url, name, size = 28 }: { url: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- icons are data URIs and API paths
      <img src={url} alt="" style={box} className="shrink-0 border border-grid bg-raised object-contain p-0.5" onError={() => setFailed(true)} />
    );
  }
  return (
    <span style={box} className="flex shrink-0 items-center justify-center border border-grid bg-raised font-display text-[11px] uppercase text-trace">
      {name.trim()[0] ?? "?"}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-key">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: getCategoryColor(category) }} />
      {formatCategory(category)}
    </span>
  );
}

function SessionRow({ entry, span }: { entry: SessionEntry; span: TimeWindow | null }) {
  const { session, overlapMs } = entry;
  const [showAllItems, setShowAllItems] = useState(false);
  const items = useMemo(() => itemsInWindow(session.items ?? [], span), [session.items, span]);
  const visibleItems = showAllItems ? items : items.slice(0, ITEMS_PREVIEW);
  const partial = span !== null && overlapMs < session.duration - 1000;

  return (
    <li className="flex min-w-0 gap-3 px-3 py-2.5 sm:px-4">
      <AppIcon url={session.iconUrl} name={session.appName} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="truncate text-[12px] text-signal">{session.appName}</span>
            <CategoryTag category={session.category} />
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-trace">{formatHMS((partial ? overlapMs : session.duration) / 1000)}</span>
        </div>
        <p className="mt-0.5 text-[11px] tabular-nums text-key">
          {formatTimeIST(session.start)} – {formatTimeIST(session.end)}
          {partial && <span> · {formatHMS(session.duration / 1000)} in total</span>}
        </p>
        {items.length > 0 && (
          <ul className="mt-1.5 space-y-1 border-l border-grid pl-3">
            {visibleItems.map((item, index) => (
              <li key={`${item.start}-${index}`} className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-trace" title={item.title}>{item.title || item.domain || "Untitled"}</span>
                {item.domain && <span className="hidden max-w-40 shrink-0 truncate text-[10px] text-key sm:block">{item.domain}</span>}
                <span className="shrink-0 text-[10px] tabular-nums text-key">{formatHMS(item.duration / 1000)}</span>
              </li>
            ))}
            {items.length > ITEMS_PREVIEW && (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAllItems((value) => !value)}
                  className="text-[10px] uppercase tracking-[0.06em] text-key hover:text-signal"
                  aria-expanded={showAllItems}
                >
                  {showAllItems ? "Show fewer pages" : `Show ${items.length - ITEMS_PREVIEW} more pages`}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}

/** Session rows revealed a page at a time. */
export function SessionList({ entries, span }: { entries: SessionEntry[]; span: TimeWindow | null }) {
  const [visible, setVisible] = useState(SESSIONS_PER_PAGE);
  const shown = entries.slice(0, visible);
  const remaining = entries.length - shown.length;

  return (
    <div>
      <ul className="divide-y divide-grid">
        {shown.map((entry, index) => (
          <SessionRow key={`${entry.session.appName}-${entry.session.start}-${index}`} entry={entry} span={span} />
        ))}
      </ul>
      {entries.length > SESSIONS_PER_PAGE && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-grid px-3 py-2 sm:px-4">
          <span className="sam-key tabular-nums">
            {shown.length} of {entries.length} sessions
          </span>
          <div className="flex gap-2">
            {remaining > 0 ? (
              <>
                <button type="button" className="sam-button" onClick={() => setVisible((value) => value + SESSIONS_PER_PAGE)}>
                  Show {Math.min(SESSIONS_PER_PAGE, remaining)} more
                </button>
                {remaining > SESSIONS_PER_PAGE && (
                  <button type="button" className="sam-button" onClick={() => setVisible(entries.length)}>
                    Show all
                  </button>
                )}
              </>
            ) : (
              <button type="button" className="sam-button" onClick={() => setVisible(SESSIONS_PER_PAGE)}>
                Show fewer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HourPanel({ group, open, onToggle }: { group: HourGroup; open: boolean; onToggle: () => void }) {
  const panelId = useId();
  const span = useMemo(() => ({ start: group.start, end: group.start + HOUR_MS }), [group.start]);
  const icons = useMemo(() => {
    const seen = new Set<string>();
    return group.entries
      .filter(({ session }) => (seen.has(session.appName) ? false : (seen.add(session.appName), true)))
      .slice(0, 4)
      .map(({ session }) => session);
  }, [group.entries]);

  return (
    <section className="border border-grid">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-raised sm:px-4 ${open ? "border-b border-grid" : ""}`}
      >
        <span className="sam-numeral w-[54px] shrink-0 text-[15px]">{formatHour(group.hour)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-signal">
            {formatDayKey(group.date)} · {group.entries.length} {group.entries.length === 1 ? "session" : "sessions"}
          </span>
          <span className="block text-[11px] tabular-nums text-key">
            {formatHMS(group.trackedMs / 1000)} tracked · {group.apps.length} {group.apps.length === 1 ? "app" : "apps"}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 sm:flex" aria-hidden>
          {icons.map((session) => (
            <AppIcon key={session.appName} url={session.iconUrl} name={session.appName} size={20} />
          ))}
          {group.apps.length > icons.length && <span className="pl-1 text-[10px] text-key">+{group.apps.length - icons.length}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-key transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={panelId}>
          <SessionList entries={group.entries} span={span} />
        </div>
      )}
    </section>
  );
}

/**
 * Timeline sessions grouped by IST hour, newest first. Hours open on demand
 * and long lists are revealed a page at a time, so a 30-day range renders a
 * handful of rows instead of every session.
 */
export default function HourlyBreakdown({ sessions }: { sessions: TimelineSession[] }) {
  const groups = useMemo(() => groupSessionsByHour(sessions), [sessions]);
  const [visibleHours, setVisibleHours] = useState(HOURS_PER_PAGE);
  // Hours the user toggled; the newest hour starts open.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  if (groups.length === 0) {
    return <p className="py-10 text-center text-[12px] text-key">No sessions were recorded in this range.</p>;
  }

  const shown = groups.slice(0, visibleHours);
  const remaining = groups.length - shown.length;
  const isOpen = (group: HourGroup, index: number) => toggled[group.key] ?? index === 0;

  return (
    <div className="space-y-2">
      {shown.map((group, index) => (
        <HourPanel
          key={group.key}
          group={group}
          open={isOpen(group, index)}
          onToggle={() => setToggled((current) => ({ ...current, [group.key]: !isOpen(group, index) }))}
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="sam-key tabular-nums">
          {shown.length} of {groups.length} hours
        </span>
        <div className="flex gap-2">
          {remaining > 0 && (
            <button type="button" className="sam-button" onClick={() => setVisibleHours((value) => value + HOURS_PER_PAGE)}>
              Show {Math.min(HOURS_PER_PAGE, remaining)} earlier hours
            </button>
          )}
          {visibleHours > HOURS_PER_PAGE && (
            <button type="button" className="sam-button" onClick={() => setVisibleHours(HOURS_PER_PAGE)}>
              Show fewer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
