// Response shapes of the /analytics endpoints used by the analytics page.

export interface TimelineItem {
  title: string;
  iconUrl: string | null;
  domain: string | null;
  url: string | null;
  start: string;
  end: string;
  /** milliseconds */
  duration: number;
}

export interface TimelineSession {
  appName: string;
  iconUrl: string | null;
  domain: string | null;
  url: string | null;
  start: string;
  end: string;
  /** milliseconds */
  duration: number;
  category: string;
  items: TimelineItem[];
}

export interface BreakdownEntry {
  name: string;
  duration: number;
  minutes: number;
  percentage: number;
}

export interface HeatmapBucket {
  score: number;
  productivity: number;
  /** milliseconds */
  duration: number;
  trackedMinutes: number;
  idleMinutes: number;
  dominantApp: string | null;
  dominantCategory: string | null;
  dominantIntent: string | null;
  topApps: (BreakdownEntry & { category?: string; categories?: BreakdownEntry[] })[];
  categoryBreakdown: BreakdownEntry[];
  intentBreakdown: BreakdownEntry[];
}

export type HeatmapResponse = Record<string, Record<number, HeatmapBucket>>;

export interface IntentShare {
  intent: string;
  percentage: number;
  avgFocus: number;
}

export interface FocusTrendBucket {
  index: number;
  hour: number;
  minute: number;
  label: string;
  start: string;
  end: string;
  duration: number;
  focus: number;
  productivity?: number | null;
  /** Focus over active time only, as the dashboard's focusScore. */
  activeFocus?: number | null;
  activeMinutes?: number;
}
