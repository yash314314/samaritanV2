export type CalendarSessionType = "meeting" | "focus" | "break";

export type CalendarClassifierSettings = {
  meetingKeyword: string;
  focusKeyword: string;
  breakKeyword: string;
  attendeeThreshold: number;
};

export type CalendarEventCandidate = {
  title: string;
  status?: string | null;
  attendeeCount?: number | null;
  attendeeStatus?: string | null;
  eventType?: string | null;
  allDay?: boolean | null;
};

export type MeetingActivityCandidate = {
  appName: string;
  windowTitle: string;
  domain?: string | null;
  url?: string | null;
  type?: string | null;
  intent?: string | null;
};

function containsKeyword(title: string, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  return normalizedKeyword.length > 0 && title.toLowerCase().includes(normalizedKeyword);
}

export function classifyCalendarEvent(
  event: CalendarEventCandidate,
  settings: CalendarClassifierSettings
): CalendarSessionType | null {
  if (event.allDay || event.status?.toLowerCase() === "cancelled") return null;

  const explicitType = event.eventType?.toLowerCase();
  if (explicitType === "meeting" || explicitType === "focus" || explicitType === "break") {
    return explicitType;
  }

  if (containsKeyword(event.title, settings.focusKeyword)) return "focus";
  if (containsKeyword(event.title, settings.breakKeyword)) return "break";
  if (containsKeyword(event.title, settings.meetingKeyword)) return "meeting";

  const declined = event.attendeeStatus?.toLowerCase() === "declined";
  if (!declined && (event.attendeeCount ?? 0) >= settings.attendeeThreshold) return "meeting";

  return null;
}

export function detectMeetingActivity(activity: MeetingActivityCandidate) {
  if (activity.type === "idle") return null;

  const app = activity.appName.toLowerCase();
  const title = activity.windowTitle.toLowerCase();
  const location = `${activity.domain ?? ""} ${activity.url ?? ""}`.toLowerCase();

  const domainSignals = [
    "meet.google.com",
    "zoom.us",
    "teams.microsoft.com",
    "webex.com",
    "whereby.com",
    "around.co",
  ];
  const matchedDomain = domainSignals.find((domain) => location.includes(domain));
  if (matchedDomain) {
    return { signalType: "meeting_domain", confidence: 0.98, label: matchedDomain };
  }

  if (/(^|\s)zoom(\.exe)?($|\s)/.test(app) || app.includes("webex") || app.includes("whereby")) {
    return { signalType: "meeting_app", confidence: 0.95, label: activity.appName };
  }

  const callTitle = /(meeting|call|huddle|conference|screen sharing|presenting)/i.test(title);
  if ((app.includes("teams") || app.includes("slack") || app.includes("skype")) && callTitle) {
    return { signalType: "meeting_window", confidence: 0.9, label: activity.appName };
  }

  if (activity.intent === "video_conferencing" || activity.intent === "meeting") {
    return { signalType: "meeting_intent", confidence: 0.88, label: activity.appName };
  }

  return null;
}

export function mergeIntervals(
  intervals: Array<{ start: Date; end: Date }>,
  maxGapMs = 60_000
) {
  const sorted = intervals
    .filter((interval) => interval.end.getTime() > interval.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Array<{ start: Date; end: Date; durationMs: number }> = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start.getTime() <= previous.end.getTime() + maxGapMs) {
      if (interval.end > previous.end) previous.end = interval.end;
      previous.durationMs = previous.end.getTime() - previous.start.getTime();
    } else {
      merged.push({
        start: new Date(interval.start),
        end: new Date(interval.end),
        durationMs: interval.end.getTime() - interval.start.getTime(),
      });
    }
  }

  return merged;
}
