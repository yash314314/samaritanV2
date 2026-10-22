"use client";

import { FiMonitor } from "react-icons/fi";
import { useState } from "react";

function formatDuration(ms: number) {
  if (!ms || isNaN(ms)) return "0s";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(ms / 60000);

  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(ms / 3600000);

  return `${hours}h ${minutes % 60}m`;
}

function formatTime(date: string) {
  const d = new Date(date);

  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function isBrowserApp(appName?: string) {
  const name = appName?.toLowerCase() ?? "";

  return (
    name.includes("chrome") ||
    name.includes("brave") ||
    name.includes("edge") ||
    name.includes("firefox") ||
    name.includes("browser")
  );
}

function isRealWebDomain(domain?: string | null) {
  if (!domain) return false;

  const value = domain.toLowerCase();

  const blockedExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".svg",
    ".ico",
    ".pdf",
    ".mp4",
    ".mkv",
    ".mp3",
    ".zip",
    ".rar"
  ];

  if (blockedExtensions.some(ext => value.endsWith(ext))) {
    return false;
  }

  return (
    value !== "localhost" &&
    !value.startsWith("localhost") &&
    !value.startsWith("127.") &&
    value.includes(".")
  );
}

function getBrowserFallbackIcon(appName?: string) {
  const name = appName?.toLowerCase() ?? "";

  if (name.includes("brave")) return "/icons/apps/brave.png";
  if (name.includes("edge")) return "/icons/apps/edge.png";

  return null;
}

function getDomainFromTitle(title?: string) {
  if (!title) return null;

  const match = title.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
  return match?.[0] ?? null;
}

function getLatestItem(activity: any) {
  return activity?.items?.length
    ? activity.items[activity.items.length - 1]
    : null;
}

function AppIcon({ activity }: { activity: any }) {
  // Every source that failed to load. Remembering only the last one made two
  // broken candidates alternate forever.
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);

  const latestItem = getLatestItem(activity);
  const latestTitle = latestItem?.title ?? activity?.items?.[0]?.title;

  const domain =
    latestItem?.domain ??
    activity?.domain ??
    getDomainFromTitle(latestTitle);

  const browserFallback =
    getBrowserFallbackIcon(activity?.appName);

  const faviconUrl =
    isBrowserApp(activity?.appName) && isRealWebDomain(domain)
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
      : null;

  const candidates = [
    faviconUrl,
    latestItem?.iconUrl,
    activity?.iconUrl,
    isBrowserApp(activity?.appName) ? browserFallback : null
  ].filter(Boolean) as string[];

  const src = candidates.find(candidate => !failedSrcs.includes(candidate));

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-4 w-4 object-contain"
        onError={() => setFailedSrcs(previous => [...previous, src])}
      />
    );
  }

  return <FiMonitor size={14} strokeWidth={1.5} />;
}

export default function RecentActivity({ data, limit = 8 }: any) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <p className="text-[12px] text-key">
        Nothing observed for this day yet. Activity appears here as you work.
      </p>
    );
  }

  const recent = [...data].slice(-limit).reverse();

  return (
    <ol className="divide-y divide-grid">
      {recent.map((a: any, i: number) => {
        const latestItem = getLatestItem(a);
        const title =
          latestItem?.title ??
          a?.items?.[0]?.title ??
          "Untitled window";

        return (
          <li
            key={`${a?.start ?? i}-${a?.appName ?? ""}`}
            className="grid grid-cols-[3.25rem_1rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5"
            title={`${a?.appName ?? "Unknown"}: ${title}`}
          >
            <span className="tabular-nums text-[11px] text-key">
              {a?.start ? formatTime(a.start) : "--:--"}
            </span>
            <span className="flex h-4 w-4 items-center justify-center text-key">
              <AppIcon activity={a} />
            </span>
            <span className="min-w-0 truncate">
              <span className="text-signal">[{a?.appName ?? "unknown"}]</span>
              <span className="ml-2 text-key">{title}</span>
            </span>
            <span className="tabular-nums text-trace">
              {formatDuration(a?.duration ?? 0)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
