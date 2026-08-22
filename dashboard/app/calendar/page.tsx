"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers3,
  ListChecks,
  MapPin,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";

import { calendarApi, clearApiCache, fetchHeatmap, fetchTimeline, projectsApi } from "@/lib/api";
import { CalendarTimeGrid, type TimeGridEvent } from "@/components/calendar/CalendarTimeGrid";
import { CalendarAgenda } from "@/components/calendar/CalendarAgenda";
import { CalendarReviewInbox } from "@/components/calendar/CalendarReviewInbox";
import { CalendarInsights, type CalendarMeetingInsights, type CalendarWorkHoursUtilization } from "@/components/calendar/CalendarInsights";
import type { CalendarIntelligence, CalendarSlotSuggestion } from "@/components/calendar/CalendarIntelligencePanel";
import {
  CalendarReminderBell,
  CalendarReminderToast,
  type CalendarReminder,
} from "@/components/calendar/CalendarReminderCenter";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { useWsMessage } from "@/lib/ws";
import { useAppContext } from "@/context/AppContext";
import {
  calendarDateKey,
  calendarInputDateTime,
  calendarIntervalSegment,
  calendarMinuteOfDay,
  calendarTimeLabel,
  floatingCalendarDateTime,
} from "@/lib/calendarTime";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";
const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_WORK_HOURS: CalendarWorkHour[] = WEEKDAY_NAMES.map((_, dayOfWeek) => ({
  dayOfWeek,
  enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
  startMinute: 9 * 60,
  endMinute: 18 * 60,
}));

interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string | null;
  description?: string | null;
  location?: string | null;
  status?: string;
  busy?: boolean;
  recurrenceRule?: string | null;
  recurrenceParentId?: string | null;
  recurrenceOriginalStart?: string | null;
  recurrenceException?: boolean;
  recurrenceParent?: { id: string; recurrenceRule: string | null } | null;
  reminderMinutes?: number | null;
  notes?: string | null;
  projectId?: string | null;
  project?: Project | null;
  attendeeCount?: number;
  attendeeStatus?: string;
  eventType?: string;
  deepWorkId?: string | null;
  focusAutoStart?: boolean;
  focusEnforcement?: "observe" | "warn" | "require_reason" | "block";
  focusAllowedApps?: string[];
  focusAllowedDomains?: string[];
  focusBlockedApps?: string[];
  focusBlockedDomains?: string[];
}

interface CalendarSession {
  id: string;
  calendarEventId: string | null;
  type: "meeting" | "focus" | "break";
  source: "calendar" | "manual" | "activity";
  status: "scheduled" | "detecting" | "active" | "confirmed" | "tentative" | "missed" | "rejected";
  title: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  actualDurationMs: number;
  confidence: number;
  reviewReason: string | null;
  projectId?: string | null;
  project?: Project | null;
  _count?: { evidence: number };
}

interface SessionSummary {
  meetingMs: number;
  meetingCount: number;
  focusMs: number;
  breakMs: number;
  meetingLoadPercent: number;
  backToBackCount: number;
  tentativeCount: number;
  activeSession: CalendarSession | null;
}

interface TrackingSettings {
  meetingKeyword: string;
  focusKeyword: string;
  breakKeyword: string;
  attendeeThreshold: number;
  offlineMeetingCreation: boolean;
  offlineMeetingMinutes: number;
  confirmationThresholdSeconds: number;
  timezone: string;
  workHours: CalendarWorkHour[];
}

interface CalendarWorkHour {
  dayOfWeek: number;
  enabled: boolean;
  startMinute: number;
  endMinute: number;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

type DaySummary = {
  trackedMs: number;
  idleMinutes: number;
  focus: number;
  productivity: number;
  dominantApp: string | null;
  dominantCategory: string | null;
  topApps: { name: string; duration: number; minutes?: number; percentage?: number }[];
  categories: { name: string; duration: number; minutes?: number; percentage?: number }[];
};

function dateKey(day: Date) {
  return format(day, "yyyy-MM-dd");
}

function inputDate(day: Date, hour: number) {
  return floatingCalendarDateTime(day, hour * 60);
}

function minuteTime(value: number) {
  const minute = Math.max(0, Math.min(1439, Math.round(value)));
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function timeMinute(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function nextDateKeyValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function splitRules(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function normalizeScore(value: any) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n <= 1 ? n * 100 : n));
}

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function mergeBreakdowns(items: any[], totalMs: number) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item?.name) continue;
    totals.set(item.name, (totals.get(item.name) ?? 0) + Number(item.duration ?? 0));
  }
  return [...totals.entries()]
    .map(([name, duration]) => ({
      name,
      duration,
      minutes: Number((duration / 60000).toFixed(1)),
      percentage: totalMs > 0 ? Number(((duration / totalMs) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.duration - a.duration);
}

function summarizeDay(dayHeatmap: Record<string, any> | undefined): DaySummary {
  const buckets = Object.values(dayHeatmap ?? {});
  const trackedMs = buckets.reduce((sum, bucket: any) => sum + Number(bucket?.duration ?? 0), 0);
  const idleMinutes = buckets.reduce((sum, bucket: any) => sum + Number(bucket?.idleMinutes ?? 0), 0);
  const weightedFocus = buckets.reduce(
    (sum, bucket: any) => sum + normalizeScore(bucket?.focus ?? bucket?.score) * Number(bucket?.duration ?? 0),
    0
  );
  const weightedProductivity = buckets.reduce(
    (sum, bucket: any) => sum + normalizeScore(bucket?.productivity ?? bucket?.score) * Number(bucket?.duration ?? 0),
    0
  );
  const apps = mergeBreakdowns(buckets.flatMap((bucket: any) => bucket?.topApps ?? []), trackedMs);
  const categories = mergeBreakdowns(buckets.flatMap((bucket: any) => bucket?.categoryBreakdown ?? []), trackedMs);

  return {
    trackedMs,
    idleMinutes,
    focus: trackedMs > 0 ? weightedFocus / trackedMs : 0,
    productivity: trackedMs > 0 ? weightedProductivity / trackedMs : 0,
    dominantApp: apps[0]?.name ?? null,
    dominantCategory: categories[0]?.name ?? null,
    topApps: apps,
    categories,
  };
}

function focusColor(summary: DaySummary) {
  if (summary.trackedMs <= 0) return "#18181b";
  if (summary.focus >= 75) return "#a855f7";
  if (summary.focus >= 55) return "#7c3aed";
  if (summary.focus >= 35) return "#4c1d95";
  return "#27272a";
}

function sessionStatusClass(status: CalendarSession["status"]) {
  if (status === "active") return "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200";
  if (status === "confirmed") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (status === "detecting") return "border-purple-500/20 bg-purple-500/10 text-purple-300";
  if (status === "tentative") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (status === "missed" || status === "rejected") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-400";
}

function getLatestTitle(entry: any) {
  return entry?.items?.at?.(-1)?.title ?? entry?.items?.[0]?.title ?? "Untitled activity";
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
      <div className="text-[10px] uppercase text-zinc-600">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-zinc-100">{value}</div>
      {sub && <div className="mt-1 truncate text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

export default function CalendarPage() {
  const { setSelectedDate } = useAppContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day" | "agenda" | "insights">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventSearch, setEventSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [calendarSessions, setCalendarSessions] = useState<CalendarSession[]>([]);
  const [reviewSessions, setReviewSessions] = useState<CalendarSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [monthHeatmap, setMonthHeatmap] = useState<Record<string, Record<string, any>>>({});
  const [selectedTimeline, setSelectedTimeline] = useState<any[]>([]);
  const [loadingReview, setLoadingReview] = useState(true);
  const [calendarError, setCalendarError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [trackingSettingsError, setTrackingSettingsError] = useState("");
  const [showReminderCenter, setShowReminderCenter] = useState(false);
  const [showReviewInbox, setShowReviewInbox] = useState(false);
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [reminderToast, setReminderToast] = useState<CalendarReminder | null>(null);
  const [editingSession, setEditingSession] = useState<CalendarSession | null>(null);
  const [sessionEditError, setSessionEditError] = useState("");
  const [sessionEditForm, setSessionEditForm] = useState({
    title: "",
    type: "meeting" as CalendarSession["type"],
    status: "confirmed" as "confirmed" | "tentative" | "missed" | "rejected",
    actualStart: "",
    actualEnd: "",
    projectId: "",
  });
  const [sessionMode, setSessionMode] = useState<"start" | "log">("start");
  const [sessionSummary, setSessionSummary] = useState<SessionSummary>({
    meetingMs: 0,
    meetingCount: 0,
    focusMs: 0,
    breakMs: 0,
    meetingLoadPercent: 0,
    backToBackCount: 0,
    tentativeCount: 0,
    activeSession: null,
  });
  const [trackingSettings, setTrackingSettings] = useState<TrackingSettings | null>(null);
  const calendarTimeZone = trackingSettings?.timezone ?? "Asia/Kolkata";
  const timezoneOptions = useMemo(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return [...new Set([...COMMON_TIMEZONES, detected, calendarTimeZone].filter(Boolean))];
  }, [calendarTimeZone]);
  const [meetingInsights, setMeetingInsights] = useState<CalendarMeetingInsights>({
    scheduledMs: 0,
    actualMs: 0,
    varianceMs: 0,
    overrunMs: 0,
    meetingCount: 0,
    confirmedCount: 0,
    tentativeCount: 0,
    missedCount: 0,
    attendanceRate: null,
    medianRecoveryMs: null,
    recoverySampleCount: 0,
    focusDelta: null,
    focusSampleCount: 0,
    daily: [],
    projects: [],
  });
  const [calendarIntelligence, setCalendarIntelligence] = useState<CalendarIntelligence>({
    timezone: "Asia/Kolkata",
    workday: { startHour: 9, endHour: 18 },
    workHours: DEFAULT_WORK_HOURS,
    summary: { pressureScore: 0, pressureLevel: "low", conflictCount: 0, compressedGapCount: 0, overloadedDayCount: 0, focusWindowCount: 0, availableFocusMs: 0 },
    days: [],
    conflicts: [],
    focusWindows: [],
    recommendations: [],
  });
  const [workHoursUtilization, setWorkHoursUtilization] = useState<CalendarWorkHoursUtilization>({
    timezone: "Asia/Kolkata",
    from: "",
    to: "",
    summary: { scheduledMs: 0, elapsedScheduledMs: 0, trackedMs: 0, withinWorkHoursMs: 0, offHoursMs: 0, utilizationPercent: 0, adherencePercent: 0, scheduledDayCount: 0, elapsedDayCount: 0, onTargetDayCount: 0, offHoursDayCount: 0 },
    days: [],
  });
  const [nowMs, setNowMs] = useState(Date.now());
  const [sessionForm, setSessionForm] = useState({
    type: "meeting",
    title: "",
    startAt: inputDate(new Date(), 9),
    endAt: inputDate(new Date(), 10),
    projectId: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRecurrenceScope, setEditRecurrenceScope] = useState<"occurrence" | "series">("occurrence");
  const [form, setForm] = useState({
    title: "",
    startAt: inputDate(new Date(), 9),
    endAt: inputDate(new Date(), 10),
    allDay: false,
    color: "#8b5cf6",
    description: "",
    location: "",
    status: "confirmed",
    busy: true,
    recurrenceRule: "",
    reminderMinutes: 10,
    notes: "",
    projectId: "",
    attendeeCount: 0,
    attendeeStatus: "accepted",
    eventType: "event",
    focusAutoStart: false,
    focusEnforcement: "warn" as "observe" | "warn" | "require_reason" | "block",
    focusAllowedApps: "",
    focusAllowedDomains: "",
    focusBlockedApps: "Discord, Steam, Spotify",
    focusBlockedDomains: "youtube.com, reddit.com, x.com",
  });

  const { calendarFrom, calendarTo, insightFrom, insightTo, days } = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const result: Date[] = [];
    const cursor = new Date(calendarStart);
    while (cursor <= calendarEnd) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return {
      calendarFrom: dateKey(calendarStart),
      calendarTo: dateKey(calendarEnd),
      insightFrom: dateKey(monthStart),
      insightTo: dateKey(monthEnd),
      days: result,
    };
  }, [currentMonth]);

  const selectedKey = dateKey(selectedDay);
  const visibleEvents = useMemo(() => {
    const query = eventSearch.trim().toLowerCase();
    return events.filter((event) => {
      if (eventTypeFilter !== "all" && (event.eventType ?? "event") !== eventTypeFilter) return false;
      const eventProjectId = event.projectId ?? event.project?.id;
      if (projectFilter === "unassigned" && eventProjectId) return false;
      if (projectFilter !== "all" && projectFilter !== "unassigned" && eventProjectId !== projectFilter) return false;
      if (!query) return true;
      return [event.title, event.location, event.notes, event.project?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [eventSearch, eventTypeFilter, events, projectFilter]);
  const selectedEvents = useMemo(
    () => visibleEvents.filter((event) => Boolean(calendarIntervalSegment(event.startAt, event.endAt, selectedKey, calendarTimeZone))),
    [visibleEvents, selectedKey, calendarTimeZone]
  );
  const selectedSummary = useMemo(
    () => summarizeDay(monthHeatmap[selectedKey]),
    [monthHeatmap, selectedKey]
  );

  const resetForm = useCallback((day = selectedDay) => {
    setEditingId(null);
    setEditRecurrenceScope("occurrence");
    setForm({
      title: "",
      startAt: inputDate(day, 9),
      endAt: inputDate(day, 10),
      allDay: false,
      color: "#8b5cf6",
      description: "",
      location: "",
      status: "confirmed",
      busy: true,
      recurrenceRule: "",
      reminderMinutes: 10,
      notes: "",
      projectId: "",
      attendeeCount: 0,
      attendeeStatus: "accepted",
      eventType: "event",
      focusAutoStart: false,
      focusEnforcement: "warn",
      focusAllowedApps: "",
      focusAllowedDomains: "",
      focusBlockedApps: "Discord, Steam, Spotify",
      focusBlockedDomains: "youtube.com, reddit.com, x.com",
    });
  }, [selectedDay]);

  const loadMonth = useCallback(async () => {
    setLoadingReview(true);
    setCalendarError("");
    try {
      const [eventData, heatmapData, sessionData, summaryData, insightsData, intelligenceData, utilizationData] = await Promise.all([
        calendarApi.list(USER_ID, calendarFrom, calendarTo),
        fetchHeatmap(USER_ID, calendarFrom, calendarTo, "focus"),
        calendarApi.sessions(USER_ID, calendarFrom, calendarTo),
        calendarApi.sessionSummary(USER_ID, insightFrom, insightTo),
        calendarApi.meetingInsights(USER_ID, insightFrom, insightTo),
        calendarApi.intelligence(USER_ID, insightFrom, insightTo),
        calendarApi.workHoursUtilization(USER_ID, insightFrom, insightTo),
      ]);
      setEvents(Array.isArray(eventData) ? eventData : []);
      setMonthHeatmap(heatmapData ?? {});
      setCalendarSessions(Array.isArray(sessionData) ? sessionData : []);
      setSessionSummary(summaryData);
      setMeetingInsights(insightsData);
      setCalendarIntelligence(intelligenceData);
      setWorkHoursUtilization(utilizationData);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "Calendar sync failed");
      throw error;
    } finally {
      setLoadingReview(false);
    }
  }, [calendarFrom, calendarTo, insightFrom, insightTo]);

  const loadSelectedDay = useCallback(async () => {
    const data = await fetchTimeline(USER_ID, undefined, undefined, selectedKey);
    setSelectedTimeline(Array.isArray(data) ? data : []);
  }, [selectedKey]);

  const loadReminders = useCallback(async () => {
    const data = await calendarApi.reminders(USER_ID);
    setReminders(Array.isArray(data) ? data : []);
  }, []);

  const loadReviews = useCallback(async () => {
    const data = await calendarApi.sessions(USER_ID, undefined, undefined, "tentative");
    setReviewSessions(Array.isArray(data) ? data : []);
  }, []);

  const upsertReminder = useCallback((reminder: CalendarReminder) => {
    setReminders((current) => {
      const next = current.filter((item) => item.id !== reminder.id);
      return [...next, reminder].sort((a, b) => new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime());
    });
  }, []);

  useEffect(() => {
    loadMonth().catch(console.error);
    projectsApi.list(USER_ID).then((data) => setProjects(data)).catch(console.error);
    calendarApi.trackingSettings(USER_ID).then(setTrackingSettings).catch(console.error);
    loadReminders().catch(console.error);
    loadReviews().catch(console.error);
  }, [loadMonth, loadReminders, loadReviews]);

  useEffect(() => {
    if (!sessionSummary.activeSession) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sessionSummary.activeSession]);

  useEffect(() => {
    loadSelectedDay().catch(console.error);
  }, [loadSelectedDay]);

  useEffect(() => {
    function handleCalendarKeys(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editingText = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if (event.key === "/" && !editingText && !showModal && !showSessionModal && !showSettings && !editingSession) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        setEventSearch("");
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleCalendarKeys);
    return () => window.removeEventListener("keydown", handleCalendarKeys);
  }, [editingSession, showModal, showSessionModal, showSettings]);

  const applyCalendarSessionUpdate = useCallback((payload: { session?: CalendarSession & { deleted?: boolean } }) => {
    const session = payload?.session;
    if (!session) return;
    setCalendarSessions((current) => {
      if (session.deleted) return current.filter((item) => item.id !== session.id);
      const index = current.findIndex((item) => item.id === session.id);
      if (index === -1) return [...current, session];
      const next = [...current];
      next[index] = session;
      return next;
    });
    setReviewSessions((current) => {
      if (session.deleted || session.status !== "tentative") return current.filter((item) => item.id !== session.id);
      const index = current.findIndex((item) => item.id === session.id);
      if (index === -1) return [...current, session].sort((left, right) => new Date(left.scheduledStart ?? left.actualStart ?? 0).getTime() - new Date(right.scheduledStart ?? right.actualStart ?? 0).getTime());
      const next = [...current];
      next[index] = session;
      return next;
    });
    clearApiCache();
    loadMonth().catch(console.error);
  }, [loadMonth]);

  useWsMessage<{ session?: CalendarSession }>("calendar:session.started", applyCalendarSessionUpdate);
  useWsMessage<{ session?: CalendarSession }>("calendar:session.updated", applyCalendarSessionUpdate);
  useWsMessage<{ session?: CalendarSession }>("calendar:session.review-required", applyCalendarSessionUpdate);
  useWsMessage<{ session?: CalendarSession }>("calendar:session.ended", applyCalendarSessionUpdate);
  useWsMessage<CalendarReminder>("calendar:reminder.due", (reminder) => {
    upsertReminder(reminder);
    setReminderToast(reminder);
    if ("Notification" in window && Notification.permission === "granted") {
      const startsAt = calendarTimeLabel(reminder.calendarEvent.startAt, calendarTimeZone);
      new Notification(reminder.calendarEvent.title, { body: `Starts at ${startsAt}` });
    }
  });
  useWsMessage<CalendarReminder>("calendar:reminder.snoozed", upsertReminder);
  useWsMessage<{ id: string }>("calendar:reminder.dismissed", ({ id }) => {
    setReminders((current) => current.filter((item) => item.id !== id));
    setReminderToast((current) => current?.id === id ? null : current);
  });

  useRealtimeRefresh(
    () => Promise.all([loadMonth(), loadSelectedDay()]).then(() => undefined),
    {
      events: [
        "activity:new",
        "session:metrics",
        "analytics:daily",
        "calendar:changed",
        "deepwork:ended",
      ],
      debounceMs: 800,
    }
  );

  function goMonth(direction: "prev" | "next") {
    const next = direction === "prev" ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
    setCurrentMonth(next);
    const nextSelected = startOfMonth(next);
    setSelectedDay(nextSelected);
    setSelectedDate(nextSelected);
  }

  async function toggleReminderCenter() {
    setShowReminderCenter((open) => !open);
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  async function snoozeReminder(id: string, minutes: number) {
    const updated = await calendarApi.snoozeReminder(id, USER_ID, minutes);
    upsertReminder(updated);
    setReminderToast((current) => current?.id === id ? null : current);
  }

  async function dismissReminder(id: string) {
    await calendarApi.dismissReminder(id, USER_ID);
    setReminders((current) => current.filter((item) => item.id !== id));
    setReminderToast((current) => current?.id === id ? null : current);
  }

  function goPeriod(direction: "prev" | "next") {
    if (calendarView === "month" || calendarView === "agenda" || calendarView === "insights") return goMonth(direction);
    const amount = calendarView === "week" ? 7 : 1;
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + (direction === "prev" ? -amount : amount));
    setSelectedDay(next);
    setCurrentMonth(next);
    setSelectedDate(next);
  }

  function selectDay(day: Date) {
    setSelectedDay(day);
    setSelectedDate(day);
  }

  const eventsForDay = (day: Date) => {
    const dayStr = dateKey(day);
    return visibleEvents.filter((event) => Boolean(calendarIntervalSegment(event.startAt, event.endAt, dayStr, calendarTimeZone)));
  };

  function openCreate(day = selectedDay) {
    resetForm(day);
    setShowModal(true);
  }

  function openCreateRange(day: Date, startMinute: number, endMinute: number) {
    resetForm(day);
    setForm((current) => ({
      ...current,
      startAt: floatingCalendarDateTime(day, startMinute),
      endAt: floatingCalendarDateTime(day, endMinute),
    }));
    setShowModal(true);
  }

  function protectFocusWindow(window: CalendarIntelligence["focusWindows"][number]) {
    const [year, month, day] = calendarDateKey(window.startAt, calendarTimeZone).split("-").map(Number);
    const calendarDay = new Date(year, month - 1, day);
    openCreateRange(
      calendarDay,
      calendarMinuteOfDay(window.startAt, calendarTimeZone),
      calendarMinuteOfDay(window.endAt, calendarTimeZone)
    );
    setForm((current) => ({
      ...current,
      title: "Protected focus block",
      eventType: "focus",
      color: "#a855f7",
      busy: true,
      focusAutoStart: true,
    }));
  }

  async function findCalendarSlot(eventId: string) {
    return calendarApi.slotSuggestion(USER_ID, eventId) as Promise<CalendarSlotSuggestion>;
  }

  async function applyCalendarSlot(suggestion: CalendarSlotSuggestion) {
    const event = events.find((item) => item.id === suggestion.eventId);
    if (!event) throw new Error("Calendar event is no longer available");
    await calendarApi.update(event.id, {
      userId: USER_ID,
      startAt: suggestion.startAt,
      endAt: suggestion.endAt,
      ...(suggestion.recurrenceScope ? { recurrenceScope: suggestion.recurrenceScope } : {}),
    });
    const movedDayKey = calendarDateKey(suggestion.startAt, calendarTimeZone);
    const [year, month, day] = movedDayKey.split("-").map(Number);
    selectDay(new Date(year, month - 1, day));
    await loadMonth();
  }

  async function moveCalendarEvent(event: TimeGridEvent, day: Date, startMinute: number) {
    const originalStart = new Date(event.startAt);
    const originalEnd = new Date(event.endAt);
    const durationMinutes = Math.max(15, Math.round((originalEnd.getTime() - originalStart.getTime()) / 60_000));
    await calendarApi.update(event.id, {
      userId: USER_ID,
      startAt: floatingCalendarDateTime(day, startMinute),
      endAt: floatingCalendarDateTime(day, startMinute + durationMinutes),
    });
    selectDay(day);
    await loadMonth();
  }

  async function resizeCalendarEvent(event: TimeGridEvent, endDay: Date, endMinute: number) {
    await calendarApi.update(event.id, {
      userId: USER_ID,
      endAt: floatingCalendarDateTime(endDay, endMinute),
    });
    await loadMonth();
  }

  function openEdit(evt: CalendarEvent) {
    setEditingId(evt.id);
    setEditRecurrenceScope(evt.recurrenceParentId ? "occurrence" : "series");
    setForm({
      title: evt.title,
      startAt: calendarInputDateTime(evt.startAt, calendarTimeZone),
      endAt: calendarInputDateTime(evt.endAt, calendarTimeZone),
      allDay: evt.allDay,
      color: evt.color || evt.project?.color || "#8b5cf6",
      description: evt.description || "",
      location: evt.location || "",
      status: evt.status || "confirmed",
      busy: evt.busy ?? true,
      recurrenceRule: evt.recurrenceRule || evt.recurrenceParent?.recurrenceRule || "",
      reminderMinutes: evt.reminderMinutes ?? 10,
      notes: evt.notes || "",
      projectId: evt.projectId || evt.project?.id || "",
      attendeeCount: evt.attendeeCount ?? 0,
      attendeeStatus: evt.attendeeStatus ?? "accepted",
      eventType: evt.eventType ?? "event",
      focusAutoStart: evt.focusAutoStart ?? false,
      focusEnforcement: evt.focusEnforcement ?? "warn",
      focusAllowedApps: (evt.focusAllowedApps ?? []).join(", "),
      focusAllowedDomains: (evt.focusAllowedDomains ?? []).join(", "),
      focusBlockedApps: (evt.focusBlockedApps ?? []).join(", "),
      focusBlockedDomains: (evt.focusBlockedDomains ?? []).join(", "),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        userId: USER_ID,
        title: form.title,
        startAt: form.startAt,
        endAt: form.endAt,
        allDay: form.allDay,
        color: form.color,
        description: form.description,
        location: form.location,
        status: form.status,
        busy: form.busy,
        recurrenceRule: form.recurrenceRule || undefined,
        reminderMinutes: form.reminderMinutes,
        notes: form.notes,
        projectId: form.projectId || undefined,
        attendeeCount: form.attendeeCount,
        attendeeStatus: form.attendeeStatus,
        eventType: form.eventType,
        focusAutoStart: form.eventType === "focus" && form.focusAutoStart,
        focusEnforcement: form.focusEnforcement,
        focusAllowedApps: splitRules(form.focusAllowedApps),
        focusAllowedDomains: splitRules(form.focusAllowedDomains),
        focusBlockedApps: splitRules(form.focusBlockedApps),
        focusBlockedDomains: splitRules(form.focusBlockedDomains),
      };
      if (editingId) {
        const currentEvent = events.find((event) => event.id === editingId);
        await calendarApi.update(editingId, {
          ...payload,
          ...(currentEvent?.recurrenceParentId ? { recurrenceScope: editRecurrenceScope } : {}),
        });
      } else {
        await calendarApi.create(payload);
      }
      setShowModal(false);
      resetForm();
      await loadMonth();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDelete(id: string) {
    const event = events.find((item) => item.id === id);
    let scope: "occurrence" | "series" | undefined;
    if (event?.recurrenceParentId) {
      scope = confirm("Delete only this occurrence?") ? "occurrence" : "series";
      if (scope === "series" && !confirm("Delete the entire recurring series?")) return;
    } else if (event?.recurrenceRule) {
      scope = "series";
      if (!confirm("Delete this recurring series and all future occurrences?")) return;
    } else if (!confirm("Delete this event?")) return;
    try {
      await calendarApi.delete(id, scope);
      await loadMonth();
    } catch (error) {
      console.error(error);
    }
  }

  async function reviewSession(id: string, action: "confirm" | "reject" | "missed") {
    await calendarApi.reviewSession(id, USER_ID, action);
    setReviewSessions((current) => current.filter((session) => session.id !== id));
    await loadMonth();
  }

  async function approveAllReviewSessions() {
    const ids = reviewSessions.map((session) => session.id);
    if (!ids.length) return;
    await calendarApi.reviewSessions(ids, USER_ID, "confirm");
    setReviewSessions([]);
    await loadMonth();
  }

  function openSessionCorrection(session: CalendarSession) {
    const status = ["confirmed", "tentative", "missed", "rejected"].includes(session.status)
      ? session.status as "confirmed" | "tentative" | "missed" | "rejected"
      : "tentative";
    setEditingSession(session);
    setSessionEditError("");
    setSessionEditForm({
      title: session.title,
      type: session.type,
      status,
      actualStart: calendarInputDateTime(session.actualStart ?? session.scheduledStart, calendarTimeZone),
      actualEnd: calendarInputDateTime(session.actualEnd ?? session.scheduledEnd, calendarTimeZone),
      projectId: session.projectId ?? session.project?.id ?? "",
    });
  }

  async function saveSessionCorrection(event: React.FormEvent) {
    event.preventDefault();
    if (!editingSession) return;
    const hasAttendance = !["missed", "rejected"].includes(sessionEditForm.status);
    setSessionEditError("");
    try {
      await calendarApi.updateSession(editingSession.id, {
        userId: USER_ID,
        title: sessionEditForm.title,
        type: sessionEditForm.type,
        status: sessionEditForm.status,
        actualStart: hasAttendance ? sessionEditForm.actualStart : null,
        actualEnd: hasAttendance ? sessionEditForm.actualEnd : null,
        projectId: sessionEditForm.projectId || null,
      });
      setEditingSession(null);
      await Promise.all([loadMonth(), loadSelectedDay()]);
    } catch (error) {
      setSessionEditError(error instanceof Error ? error.message : "Could not update session");
    }
  }

  function openSession(mode: "start" | "log") {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60_000);
    setSessionMode(mode);
    setSessionForm({
      type: "meeting",
      title: "",
      startAt: calendarInputDateTime(hourAgo, calendarTimeZone),
      endAt: calendarInputDateTime(now, calendarTimeZone),
      projectId: "",
    });
    setShowSessionModal(true);
  }

  async function submitManualSession(event: React.FormEvent) {
    event.preventDefault();
    const base = {
      userId: USER_ID,
      type: sessionForm.type,
      title: sessionForm.title || undefined,
      projectId: sessionForm.projectId || undefined,
    };
    if (sessionMode === "start") await calendarApi.startManualSession(base);
    else await calendarApi.logManualSession({ ...base, startAt: sessionForm.startAt, endAt: sessionForm.endAt });
    setShowSessionModal(false);
    await loadMonth();
  }

  async function stopActiveSession() {
    if (!sessionSummary.activeSession) return;
    await calendarApi.endManualSession(sessionSummary.activeSession.id, USER_ID);
    await loadMonth();
  }

  async function saveTrackingSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!trackingSettings) return;
    setTrackingSettingsError("");
    try {
      const updated = await calendarApi.updateTrackingSettings(USER_ID, trackingSettings);
      setTrackingSettings(updated);
      setShowSettings(false);
      await loadMonth();
    } catch (error) {
      setTrackingSettingsError(error instanceof Error ? error.message : "Could not save calendar settings");
    }
  }

  const monthSummaries = days
    .filter((day) => isSameMonth(day, currentMonth))
    .map((day) => summarizeDay(monthHeatmap[dateKey(day)]));
  const trackedDays = monthSummaries.filter((summary) => summary.trackedMs > 0);
  const totalTrackedMs = trackedDays.reduce((sum, summary) => sum + summary.trackedMs, 0);
  const monthFocus =
    totalTrackedMs > 0
      ? trackedDays.reduce((sum, summary) => sum + summary.focus * summary.trackedMs, 0) / totalTrackedMs
      : 0;
  const sessionForEvent = (eventId: string) =>
    calendarSessions.find((session) => session.calendarEventId === eventId);
  const selectedAdHocSessions = calendarSessions.filter((session) => {
    if (session.calendarEventId || !session.actualStart) return false;
    return calendarDateKey(session.actualStart, calendarTimeZone) === selectedKey;
  });
  const displayTitle = calendarView === "month" || calendarView === "agenda" || calendarView === "insights"
    ? format(currentMonth, "MMMM yyyy")
    : calendarView === "week"
    ? `${format(startOfWeek(selectedDay), "MMM d")} - ${format(endOfWeek(selectedDay), "MMM d, yyyy")}`
    : format(selectedDay, "EEEE, MMMM d");
  const editingEvent = editingId ? events.find((event) => event.id === editingId) : null;
  const editingRecurring = Boolean(editingEvent?.recurrenceRule || editingEvent?.recurrenceParentId);
  const recurrencePresets = new Set([
    "",
    "FREQ=DAILY",
    "FREQ=WEEKLY",
    "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "FREQ=MONTHLY",
    "FREQ=YEARLY",
  ]);

  return (
    <div className="dashboard-page text-zinc-100">
      <div className="dashboard-surface grid grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className="samaritan-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-purple-300">
                <Sparkles className="h-4 w-4" />
                Calendar Review
              </div>
              <h1 className="text-xl font-semibold text-zinc-100">
                {displayTitle}
              </h1>
              <p className="mt-1 text-xs text-zinc-500">
                Scheduled events, tracked time, focus quality, and daily drilldown in one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
                {(["month", "week", "day", "agenda", "insights"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setCalendarView(view)}
                    className={`rounded-md px-2.5 py-1.5 text-xs capitalize transition ${calendarView === view ? "bg-purple-500 text-white" : "text-zinc-500 hover:text-zinc-200"}`}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <CalendarReminderBell
                reminders={reminders}
                open={showReminderCenter}
                onToggle={toggleReminderCenter}
                onSnooze={snoozeReminder}
                onDismiss={dismissReminder}
              />
              <button
                type="button"
                onClick={() => setShowReviewInbox(true)}
                title="Open attendance review inbox"
                className={`relative rounded-lg border p-2 transition ${reviewSessions.length ? "border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20" : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-200"}`}
              >
                <ListChecks className="h-4 w-4" />
                {reviewSessions.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-black">{reviewSessions.length > 99 ? "99+" : reviewSessions.length}</span>}
              </button>
              {sessionSummary.activeSession ? (
                <button
                  onClick={stopActiveSession}
                  className="flex items-center gap-2 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-200 transition hover:bg-fuchsia-500/20"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-400" />
                  </span>
                  {formatMs(Math.max(0, nowMs - new Date(sessionSummary.activeSession.actualStart!).getTime()))}
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => openSession("start")}
                  className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-sm text-purple-200 transition hover:bg-purple-500/20"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Start session
                </button>
              )}
              <button
                onClick={() => openSession("log")}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 transition hover:text-zinc-100"
                title="Log past session"
              >
                <Clock3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setTrackingSettingsError("");
                  setShowSettings(true);
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 transition hover:text-zinc-100"
                title="Calendar tracking settings"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => goPeriod("prev")}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 transition hover:text-zinc-100"
                title="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  selectDay(today);
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:text-zinc-100"
              >
                Today
              </button>
              <button
                onClick={() => goPeriod("next")}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 transition hover:text-zinc-100"
                title="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => openCreate()}
                className="ml-2 flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-600"
              >
                <Plus className="h-4 w-4" />
                New Event
              </button>
            </div>
          </div>

          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
            <div className="relative min-w-48 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600" />
              <input
                ref={searchInputRef}
                type="search"
                value={eventSearch}
                onChange={(event) => setEventSearch(event.target.value)}
                placeholder="Search events"
                aria-label="Search calendar events"
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-purple-500/50"
              />
            </div>
            <select
              value={eventTypeFilter}
              onChange={(event) => setEventTypeFilter(event.target.value)}
              aria-label="Filter by event type"
              className="h-9 min-w-32 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-400 outline-none focus:border-purple-500/50"
            >
              <option value="all">All types</option>
              <option value="event">Events</option>
              <option value="meeting">Meetings</option>
              <option value="focus">Focus blocks</option>
              <option value="break">Breaks</option>
            </select>
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              aria-label="Filter by project"
              className="h-9 min-w-36 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-400 outline-none focus:border-purple-500/50"
            >
              <option value="all">All projects</option>
              <option value="unassigned">Unassigned</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            {calendarError ? (
              <button type="button" onClick={() => loadMonth().catch(console.error)} className="ml-auto text-[10px] font-medium text-rose-300 hover:text-rose-200">
                Sync failed. Retry
              </button>
            ) : (
              <span className="ml-auto text-[10px] text-zinc-600">{visibleEvents.length} of {events.length}</span>
            )}
            <button
              type="button"
              onClick={() => {
                setEventSearch("");
                setEventTypeFilter("all");
                setProjectFilter("all");
              }}
              disabled={!eventSearch && eventTypeFilter === "all" && projectFilter === "all"}
              title="Clear calendar filters"
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Month Focus" value={monthFocus.toFixed(0)} sub="activity weighted" />
            <StatTile label="Tracked" value={formatMs(totalTrackedMs)} sub={`${trackedDays.length} active days`} />
            <StatTile label="Meetings" value={formatMs(sessionSummary.meetingMs)} sub={`${sessionSummary.meetingCount} sessions · ${sessionSummary.meetingLoadPercent}% load`} />
            <StatTile label="Fragmentation" value={sessionSummary.backToBackCount} sub={`${sessionSummary.tentativeCount} awaiting review`} />
          </div>
        </div>

        {calendarView === "month" ? (
        <div className="grid min-h-0 min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="samaritan-card min-h-0 p-4">
            <div className="mb-3 grid grid-cols-7 gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-zinc-500">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid h-[calc(100%-2rem)] grid-cols-7 grid-rows-6 gap-1.5">
              {days.map((day) => {
                const key = dateKey(day);
                const summary = summarizeDay(monthHeatmap[key]);
                const dayEvents = eventsForDay(day);
                const selected = isSameDay(day, selectedDay);
                const inMonth = isSameMonth(day, currentMonth);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`group min-h-0 rounded-lg border p-1.5 text-left transition ${
                      selected
                        ? "border-purple-400 bg-purple-500/10"
                        : inMonth
                        ? "border-zinc-800 bg-zinc-950/80 hover:border-purple-500/30"
                        : "border-zinc-900 bg-zinc-950/30 opacity-55"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-sm font-medium ${inMonth ? "text-zinc-200" : "text-zinc-600"}`}>
                        {format(day, "d")}
                      </span>
                      {summary.trackedMs > 0 && (
                        <span className="text-[10px] text-zinc-500">
                          {summary.focus.toFixed(0)}
                        </span>
                      )}
                    </div>

                    <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-zinc-900">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: summary.trackedMs > 0 ? `${Math.max(8, summary.focus)}%` : "0%",
                          backgroundColor: focusColor(summary),
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event) => {
                        const segment = calendarIntervalSegment(event.startAt, event.endAt, key, calendarTimeZone)!;
                        const timeLabel = event.allDay
                          ? "All day"
                          : segment.startsHere
                          ? calendarTimeLabel(event.startAt, calendarTimeZone)
                          : `Until ${segment.endMinute === 24 * 60 ? "24:00" : calendarTimeLabel(event.endAt, calendarTimeZone)}`;
                        return (
                          <div
                            key={event.id}
                            className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: event.color || event.project?.color || "#8b5cf6" }}
                          >
                            {(event.recurrenceRule || event.recurrenceParentId) && <Repeat2 className="h-2.5 w-2.5 shrink-0" />}
                            <span className="truncate">{timeLabel} {event.title}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-600">
                      <span>{summary.trackedMs > 0 ? formatMs(summary.trackedMs) : "No tracking"}</span>
                      {dayEvents.length > 2 && <span>+{dayEvents.length - 2}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="grid min-h-0 grid-rows-[auto_minmax(0,0.8fr)_minmax(0,1fr)] gap-4">
            <div className="samaritan-card p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-purple-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">
                      {format(selectedDay, "EEEE, MMM d")}
                    </h2>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">Review schedule against actual tracked work.</p>
                </div>
                {loadingReview && <span className="text-[10px] text-purple-300">Syncing</span>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Tracked" value={formatMs(selectedSummary.trackedMs)} />
                <StatTile label="Focus" value={selectedSummary.focus.toFixed(0)} />
                <StatTile label="Idle" value={`${selectedSummary.idleMinutes.toFixed(0)}m`} />
                <StatTile label="Productivity" value={selectedSummary.productivity.toFixed(0)} />
              </div>

              <div className="mt-4 rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-300">
                  <Layers3 className="h-3.5 w-3.5 text-purple-400" />
                  Dominant Work
                </div>
                <div className="text-sm text-zinc-100">
                  {selectedSummary.dominantCategory ?? "No tracked category"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {selectedSummary.dominantApp ?? "No dominant app yet"}
                </div>
              </div>
            </div>

            <div className="samaritan-card flex min-h-0 flex-col p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Scheduled</h2>
                <button
                  type="button"
                  onClick={() => openCreate(selectedDay)}
                  className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-300 transition hover:bg-purple-500/20"
                >
                  Add
                </button>
              </div>

              <div className="dashboard-scroll-panel space-y-2 pr-1">
                {selectedEvents.map((event) => {
                  const trackedSession = sessionForEvent(event.id);
                  return (
                  <div key={event.id} className="rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-200">
                          {(event.recurrenceRule || event.recurrenceParentId) && <Repeat2 className="h-3 w-3 shrink-0 text-purple-400" />}
                          <span className="truncate">{event.title}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span>
                          {event.allDay
                            ? "All day"
                            : `${calendarTimeLabel(event.startAt, calendarTimeZone)} - ${calendarTimeLabel(event.endAt, calendarTimeZone)}`}
                          </span>
                          {trackedSession && (
                            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${sessionStatusClass(trackedSession.status)}`}>
                              {trackedSession.status}
                            </span>
                          )}
                          {event.eventType === "focus" && event.focusAutoStart && (
                            <span className="flex items-center gap-1 rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-purple-300">
                              <ShieldCheck className="h-2.5 w-2.5" />{event.focusEnforcement ?? "warn"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => openEdit(event)} title="Edit event" className="text-zinc-500 hover:text-zinc-200">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(event.id)} title="Delete event" className="text-zinc-500 hover:text-rose-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {event.location && <div className="mt-2 text-[11px] text-zinc-600">{event.location}</div>}
                    {trackedSession && (
                      <div className="mt-2 flex items-center justify-between gap-3 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
                        <div className="flex min-w-0 items-center gap-2">
                          <Video className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                          <span className="truncate capitalize">{trackedSession.type}</span>
                          <span>·</span>
                          <span>{formatMs(trackedSession.actualDurationMs)}</span>
                          <span>·</span>
                          <span>{trackedSession._count?.evidence ?? 0} signals</span>
                        </div>
                         {trackedSession.status === "tentative" && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              title="Confirm attended"
                              onClick={() => reviewSession(trackedSession.id, "confirm").catch(console.error)}
                              className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Mark missed"
                              onClick={() => reviewSession(trackedSession.id, "missed").catch(console.error)}
                              className="rounded p-1 text-amber-400 hover:bg-amber-500/10"
                            >
                              <Clock3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Reject session"
                              onClick={() => reviewSession(trackedSession.id, "reject").catch(console.error)}
                              className="rounded p-1 text-rose-400 hover:bg-rose-500/10"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                         )}
                         {trackedSession.status !== "active" && (
                           <button
                             type="button"
                             title="Correct session details"
                             onClick={() => openSessionCorrection(trackedSession)}
                             className="shrink-0 rounded p-1 text-zinc-500 transition hover:bg-purple-500/10 hover:text-purple-300"
                           >
                             <Pencil className="h-3.5 w-3.5" />
                           </button>
                         )}
                       </div>
                    )}
                  </div>
                  );
                })}
                {selectedAdHocSessions.map((session) => (
                  <div key={session.id} className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Video className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                          <span className="truncate text-sm font-medium text-zinc-200">{session.title}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {formatMs(session.actualDurationMs)} · activity detected · {session._count?.evidence ?? 0} signals
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${sessionStatusClass(session.status)}`}>
                          {session.status}
                        </span>
                        {session.status !== "active" && (
                          <button type="button" onClick={() => openSessionCorrection(session)} title="Correct session details" className="rounded p-1 text-zinc-500 transition hover:bg-purple-500/10 hover:text-purple-300">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {selectedEvents.length === 0 && selectedAdHocSessions.length === 0 && (
                  <div className="rounded-lg bg-zinc-950/60 p-5 text-center text-sm text-zinc-500">
                    No scheduled events.
                  </div>
                )}
              </div>
            </div>

            <div className="samaritan-card flex min-h-0 flex-col p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Actual Timeline</h2>
              </div>

              <div className="dashboard-scroll-panel space-y-2 pr-1">
                {selectedTimeline.slice().reverse().slice(0, 10).map((entry) => (
                  <div key={`${entry.start}-${entry.appName}`} className="rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-200">{entry.appName}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{getLatestTitle(entry)}</div>
                      </div>
                      <div className="shrink-0 text-xs text-zinc-500">{formatMs(Number(entry.duration ?? 0))}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-600">
                      <span>{entry.category ?? "unknown"}</span>
                      <span>{entry.intent ?? "unknown"}</span>
                    </div>
                  </div>
                ))}
                {selectedTimeline.length === 0 && (
                  <div className="rounded-lg bg-zinc-950/60 p-5 text-center text-sm text-zinc-500">
                    No tracked activity for this day.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
        ) : calendarView === "agenda" ? (
          <div className="samaritan-card min-h-0 overflow-hidden p-0">
            <CalendarAgenda
              events={visibleEvents}
              sessions={calendarSessions}
              timeZone={calendarTimeZone}
              onEditEvent={(event) => openEdit(event as CalendarEvent)}
            />
          </div>
        ) : calendarView === "insights" ? (
          <div className="samaritan-card min-h-0 overflow-hidden p-0">
            <CalendarInsights
              insights={meetingInsights}
              intelligence={calendarIntelligence}
              utilization={workHoursUtilization}
              onProtectFocus={protectFocusWindow}
              onFindSlot={findCalendarSlot}
              onApplySlot={applyCalendarSlot}
            />
          </div>
        ) : (
          <div className="samaritan-card min-h-0 overflow-hidden p-0">
            <CalendarTimeGrid
              view={calendarView}
              selectedDay={selectedDay}
              events={visibleEvents}
              sessions={calendarSessions}
              timeZone={calendarTimeZone}
              workHours={trackingSettings?.workHours ?? DEFAULT_WORK_HOURS}
              onSelectDay={selectDay}
              onCreateRange={openCreateRange}
              onEditEvent={(event) => openEdit(event as CalendarEvent)}
              onMoveEvent={moveCalendarEvent}
              onResizeEvent={resizeCalendarEvent}
            />
          </div>
        )}

        <CalendarReminderToast
          reminder={reminderToast}
          onSnooze={snoozeReminder}
          onDismiss={dismissReminder}
        />

        <CalendarReviewInbox
          open={showReviewInbox}
          sessions={reviewSessions}
          timeZone={calendarTimeZone}
          onClose={() => setShowReviewInbox(false)}
          onReview={reviewSession}
          onApproveAll={approveAllReviewSessions}
          onCorrect={(session) => {
            setShowReviewInbox(false);
            openSessionCorrection(session as CalendarSession);
          }}
        />

        {editingSession && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <form onSubmit={saveSessionCorrection} className="samaritan-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-purple-400">Actual session</div>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-100">Correct tracked time</h2>
                  <p className="mt-1 text-xs text-zinc-500">The original calendar schedule stays unchanged.</p>
                </div>
                <button type="button" onClick={() => setEditingSession(null)} className="rounded p-1 text-zinc-500 hover:text-zinc-200" title="Close">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-zinc-400">Session title</label>
                  <input required value={sessionEditForm.title} onChange={(event) => setSessionEditForm({ ...sessionEditForm, title: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Type</label>
                  <select value={sessionEditForm.type} onChange={(event) => setSessionEditForm({ ...sessionEditForm, type: event.target.value as CalendarSession["type"] })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="meeting">Meeting</option>
                    <option value="focus">Focus</option>
                    <option value="break">Break</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Attendance</label>
                  <select value={sessionEditForm.status} onChange={(event) => setSessionEditForm({ ...sessionEditForm, status: event.target.value as typeof sessionEditForm.status })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="confirmed">Confirmed</option>
                    <option value="tentative">Tentative</option>
                    <option value="missed">Missed</option>
                    <option value="rejected">Discarded</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Actual join</label>
                  <input type="datetime-local" required={!(["missed", "rejected"].includes(sessionEditForm.status))} disabled={["missed", "rejected"].includes(sessionEditForm.status)} value={sessionEditForm.actualStart} onChange={(event) => setSessionEditForm({ ...sessionEditForm, actualStart: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs disabled:opacity-40" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Actual leave</label>
                  <input type="datetime-local" required={!(["missed", "rejected"].includes(sessionEditForm.status))} disabled={["missed", "rejected"].includes(sessionEditForm.status)} value={sessionEditForm.actualEnd} onChange={(event) => setSessionEditForm({ ...sessionEditForm, actualEnd: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs disabled:opacity-40" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-zinc-400">Project</label>
                  <select value={sessionEditForm.projectId} onChange={(event) => setSessionEditForm({ ...sessionEditForm, projectId: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="">No project</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </div>
              </div>

              {sessionEditForm.actualStart && sessionEditForm.actualEnd && !["missed", "rejected"].includes(sessionEditForm.status) && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-purple-500/15 bg-purple-500/5 px-3 py-2 text-xs">
                  <span className="text-zinc-500">Corrected duration</span>
                  <span className="font-medium text-purple-200">{formatMs(Math.max(0, new Date(sessionEditForm.actualEnd).getTime() - new Date(sessionEditForm.actualStart).getTime()))}</span>
                </div>
              )}
              {sessionEditError && <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{sessionEditError}</div>}

              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setEditingSession(null)} className="flex-1 rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900">Cancel</button>
                <button type="submit" className="flex-1 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600">Save correction</button>
              </div>
            </form>
          </div>
        )}

        {showSessionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <form onSubmit={submitManualSession} className="samaritan-card w-full max-w-md p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-purple-400">Manual tracking</div>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-100">
                    {sessionMode === "start" ? "Start a live session" : "Log a completed session"}
                  </h2>
                </div>
                <button type="button" onClick={() => setShowSessionModal(false)} className="rounded p-1 text-zinc-500 hover:text-zinc-200" title="Close">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Session type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["meeting", "focus", "break"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSessionForm({ ...sessionForm, type })}
                        className={`rounded-md border px-3 py-2 text-xs capitalize transition ${
                          sessionForm.type === type
                            ? "border-purple-400 bg-purple-500/15 text-purple-200"
                            : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Title</label>
                  <input
                    value={sessionForm.title}
                    onChange={(event) => setSessionForm({ ...sessionForm, title: event.target.value })}
                    placeholder={`Manual ${sessionForm.type}`}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </div>
                {sessionMode === "log" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">Started</label>
                      <input type="datetime-local" required value={sessionForm.startAt} onChange={(event) => setSessionForm({ ...sessionForm, startAt: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">Ended</label>
                      <input type="datetime-local" required value={sessionForm.endAt} onChange={(event) => setSessionForm({ ...sessionForm, endAt: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Project</label>
                  <select value={sessionForm.projectId} onChange={(event) => setSessionForm({ ...sessionForm, projectId: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="">No project</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowSessionModal(false)} className="flex-1 rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900">Cancel</button>
                <button type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600">
                  {sessionMode === "start" ? <Play className="h-4 w-4 fill-current" /> : <CheckCircle2 className="h-4 w-4" />}
                  {sessionMode === "start" ? "Start" : "Log session"}
                </button>
              </div>
            </form>
          </div>
        )}

        {showSettings && trackingSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <form onSubmit={saveTrackingSettings} className="samaritan-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-purple-400">Automation</div>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-100">Calendar tracking</h2>
                  <p className="mt-1 text-xs text-zinc-500">Tune how scheduled and activity-detected sessions are classified.</p>
                </div>
                <button type="button" onClick={() => setShowSettings(false)} className="rounded p-1 text-zinc-500 hover:text-zinc-200" title="Close">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {([
                  ["Meeting keyword", "meetingKeyword"],
                  ["Focus keyword", "focusKeyword"],
                  ["Break keyword", "breakKeyword"],
                ] as const).map(([label, key]) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-zinc-400">{label}</label>
                    <input value={trackingSettings[key]} onChange={(event) => setTrackingSettings({ ...trackingSettings, [key]: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                  </div>
                ))}
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Attendee threshold</label>
                  <input type="number" min={1} max={50} value={trackingSettings.attendeeThreshold} onChange={(event) => setTrackingSettings({ ...trackingSettings, attendeeThreshold: Number(event.target.value) })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Calendar timezone</label>
                  <select value={trackingSettings.timezone} onChange={(event) => setTrackingSettings({ ...trackingSettings, timezone: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                    {timezoneOptions.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-xs text-zinc-400">Work hours</label>
                    <span className="text-[10px] text-zinc-600">Used for focus windows and conflict repair</span>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/70">
                    {(trackingSettings.workHours ?? DEFAULT_WORK_HOURS).map((workday) => (
                      <div key={workday.dayOfWeek} className="flex flex-wrap items-center gap-2 border-b border-zinc-900 px-3 py-2 last:border-b-0">
                        <input
                          type="checkbox"
                          checked={workday.enabled}
                          onChange={(event) => setTrackingSettings({
                            ...trackingSettings,
                            workHours: (trackingSettings.workHours ?? DEFAULT_WORK_HOURS).map((item) => item.dayOfWeek === workday.dayOfWeek ? { ...item, enabled: event.target.checked } : item),
                          })}
                          aria-label={`Enable ${WEEKDAY_NAMES[workday.dayOfWeek]}`}
                          className="accent-purple-500"
                        />
                        <span className={`min-w-20 flex-1 truncate text-xs ${workday.enabled ? "text-zinc-300" : "text-zinc-600"}`}>{WEEKDAY_NAMES[workday.dayOfWeek]}</span>
                        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 pl-6 sm:w-[230px] sm:pl-0">
                          <input
                            type="time"
                            value={minuteTime(workday.startMinute)}
                            disabled={!workday.enabled}
                            onChange={(event) => setTrackingSettings({
                              ...trackingSettings,
                              workHours: (trackingSettings.workHours ?? DEFAULT_WORK_HOURS).map((item) => item.dayOfWeek === workday.dayOfWeek ? { ...item, startMinute: timeMinute(event.target.value) } : item),
                            })}
                            aria-label={`${WEEKDAY_NAMES[workday.dayOfWeek]} starts`}
                            className="min-w-0 rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs disabled:opacity-35"
                          />
                          <span className="text-[10px] text-zinc-700">to</span>
                          <input
                            type="time"
                            value={minuteTime(workday.endMinute)}
                            disabled={!workday.enabled}
                            onChange={(event) => setTrackingSettings({
                              ...trackingSettings,
                              workHours: (trackingSettings.workHours ?? DEFAULT_WORK_HOURS).map((item) => item.dayOfWeek === workday.dayOfWeek ? { ...item, endMinute: timeMinute(event.target.value) } : item),
                            })}
                            aria-label={`${WEEKDAY_NAMES[workday.dayOfWeek]} ends`}
                            className="min-w-0 rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs disabled:opacity-35"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Ad-hoc detection</label>
                  <div className="flex h-[38px] items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3">
                    <span className="text-xs text-zinc-300">Meeting apps</span>
                    <input type="checkbox" checked={trackingSettings.offlineMeetingCreation} onChange={(event) => setTrackingSettings({ ...trackingSettings, offlineMeetingCreation: event.target.checked })} className="accent-purple-500" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Detect after</label>
                  <div className="relative">
                    <input type="number" min={1} max={120} value={trackingSettings.offlineMeetingMinutes} onChange={(event) => setTrackingSettings({ ...trackingSettings, offlineMeetingMinutes: Number(event.target.value) })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 pr-16 text-sm" />
                    <span className="absolute right-3 top-2.5 text-xs text-zinc-600">minutes</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Confirm after</label>
                  <div className="relative">
                    <input type="number" min={10} max={600} value={trackingSettings.confirmationThresholdSeconds} onChange={(event) => setTrackingSettings({ ...trackingSettings, confirmationThresholdSeconds: Number(event.target.value) })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 pr-16 text-sm" />
                    <span className="absolute right-3 top-2.5 text-xs text-zinc-600">seconds</span>
                  </div>
                </div>
              </div>
              {trackingSettingsError && <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{trackingSettingsError}</div>}
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowSettings(false)} className="flex-1 rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900">Cancel</button>
                <button type="submit" className="flex-1 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600">Save settings</button>
              </div>
            </form>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="samaritan-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6">
              <h2 className="mb-4 text-lg font-bold">{editingId ? "Edit Event" : "New Event"}</h2>
              {editingRecurring && editingEvent?.recurrenceParentId && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs text-zinc-500">Apply changes to</label>
                  <div className="grid grid-cols-2 rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
                    <button type="button" onClick={() => setEditRecurrenceScope("occurrence")} className={`rounded-md px-3 py-2 text-xs transition ${editRecurrenceScope === "occurrence" ? "bg-purple-500 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>This occurrence</button>
                    <button type="button" onClick={() => setEditRecurrenceScope("series")} className={`rounded-md px-3 py-2 text-xs transition ${editRecurrenceScope === "series" ? "bg-purple-500 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>Entire series</button>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">{form.allDay ? "Start date" : "Start"}</label>
                    <input
                      type={form.allDay ? "date" : "datetime-local"}
                      value={form.allDay ? form.startAt.slice(0, 10) : form.startAt}
                      onChange={(e) => {
                        if (!form.allDay) return setForm({ ...form, startAt: e.target.value });
                        const startDate = e.target.value;
                        const currentEnd = form.endAt.slice(0, 10);
                        const endDate = currentEnd <= startDate ? nextDateKeyValue(startDate) : currentEnd;
                        setForm({ ...form, startAt: `${startDate}T00:00`, endAt: `${endDate}T00:00` });
                      }}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">{form.allDay ? "End date" : "End"}</label>
                    <input
                      type={form.allDay ? "date" : "datetime-local"}
                      min={form.allDay ? nextDateKeyValue(form.startAt.slice(0, 10)) : undefined}
                      value={form.allDay ? form.endAt.slice(0, 10) : form.endAt}
                      onChange={(e) => setForm({ ...form, endAt: form.allDay ? `${e.target.value}T00:00` : e.target.value })}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Tracking type</label>
                    <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <option value="event">Calendar event</option>
                      <option value="meeting">Meeting</option>
                      <option value="focus">Focus block</option>
                      <option value="break">Break</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Attendees</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <input type="number" min={0} value={form.attendeeCount} onChange={(e) => setForm({ ...form, attendeeCount: Math.max(0, Number(e.target.value)) })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3" />
                    </div>
                  </div>
                </div>
                {form.eventType === "focus" && (
                  <div className="overflow-hidden rounded-lg border border-purple-500/20 bg-purple-500/5">
                    <div className="flex items-center justify-between gap-4 border-b border-purple-500/15 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-purple-400" />
                        <div><div className="text-xs font-medium text-zinc-200">Deep Work enforcement</div><div className="text-[10px] text-zinc-600">Activate when this focus block begins</div></div>
                      </div>
                      <input type="checkbox" checked={form.focusAutoStart} onChange={(event) => setForm({ ...form, focusAutoStart: event.target.checked })} className="h-4 w-4 accent-purple-500" />
                    </div>
                    {form.focusAutoStart && (
                      <div className="grid gap-3 p-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs text-zinc-400">Enforcement level</label>
                          <select value={form.focusEnforcement} onChange={(event) => setForm({ ...form, focusEnforcement: event.target.value as typeof form.focusEnforcement })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                            <option value="observe">Observe - track only</option>
                            <option value="warn">Warn - notify on violations</option>
                            <option value="require_reason">Require reason - justify overrides</option>
                            <option value="block">Block - terminate violating apps</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">Allowed apps</label>
                          <input value={form.focusAllowedApps} onChange={(event) => setForm({ ...form, focusAllowedApps: event.target.value })} placeholder="Cursor, Terminal" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">Allowed domains</label>
                          <input value={form.focusAllowedDomains} onChange={(event) => setForm({ ...form, focusAllowedDomains: event.target.value })} placeholder="github.com" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">Blocked apps</label>
                          <input value={form.focusBlockedApps} onChange={(event) => setForm({ ...form, focusBlockedApps: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">Blocked domains</label>
                          <input value={form.focusBlockedDomains} onChange={(event) => setForm({ ...form, focusBlockedDomains: event.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={form.allDay}
                    onChange={(e) => {
                      const allDay = e.target.checked;
                      const startDate = form.startAt.slice(0, 10);
                      if (allDay) {
                        const currentEnd = form.endAt.slice(0, 10);
                        const endDate = currentEnd <= startDate ? nextDateKeyValue(startDate) : currentEnd;
                        setForm({ ...form, allDay, startAt: `${startDate}T00:00`, endAt: `${endDate}T00:00` });
                      } else {
                        setForm({ ...form, allDay, startAt: `${startDate}T09:00`, endAt: `${startDate}T10:00` });
                      }
                    }}
                  />
                  All day
                </label>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Project</label>
                  <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Color</label>
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <option value="confirmed">Confirmed</option>
                      <option value="tentative">Tentative</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <label className="mt-6 flex items-center gap-2 text-sm text-zinc-300">
                    <Briefcase className="h-4 w-4 text-zinc-500" />
                    <input type="checkbox" checked={form.busy} onChange={(e) => setForm({ ...form, busy: e.target.checked })} />
                    Busy
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Reminder</label>
                    <div className="relative">
                      <Bell className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <input type="number" value={form.reminderMinutes} onChange={(e) => setForm({ ...form, reminderMinutes: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Repeat</label>
                    <select value={form.recurrenceRule} onChange={(e) => setForm({ ...form, recurrenceRule: e.target.value })} disabled={Boolean(editingEvent?.recurrenceParentId && editRecurrenceScope === "occurrence")} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="">Does not repeat</option>
                      <option value="FREQ=DAILY">Every day</option>
                      <option value="FREQ=WEEKLY">Every week</option>
                      <option value="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR">Every weekday</option>
                      <option value="FREQ=MONTHLY">Every month</option>
                      <option value="FREQ=YEARLY">Every year</option>
                      {!recurrencePresets.has(form.recurrenceRule) && <option value={form.recurrenceRule}>Custom recurrence</option>}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" rows={2} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" rows={3} />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg border border-zinc-800 px-4 py-2 transition hover:bg-zinc-800">Cancel</button>
                <button type="submit" className="flex-1 rounded-lg bg-purple-500 px-4 py-2 text-white transition hover:bg-purple-600">
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  {editingId ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
