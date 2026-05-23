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

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
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
  if (name.includes("chrome")) return "/icons/apps/chrome.png";
  if (name.includes("firefox")) return "/icons/apps/firefox.png";

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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

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

  const src = candidates.find(candidate => candidate !== failedSrc);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-4 w-4 rounded-sm object-contain"
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return <FiMonitor size={16} />;
}

export default function RecentActivity({ data }: any) {
  const [tooltip, setTooltip] = useState<any>(null);

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-xs text-zinc-500">
        No recent activity
      </div>
    );
  }

  const recent = [...data].slice(-6).reverse();

  return (
    <div className="space-y-2">
      {recent.map((a: any, i: number) => {
        const latestItem = getLatestItem(a);
        const title =
          latestItem?.title ??
          a?.items?.[0]?.title ??
          "Unknown Window";

        const duration = a?.duration ?? 0;

        return (
          <div
            key={i}
            className="flex justify-between items-center text-xs border-b border-zinc-800 pb-2 hover:bg-zinc-800/40 px-2 py-2 rounded transition cursor-default"
            onMouseEnter={(e) => {
              setTooltip({
                x: e.clientX,
                y: e.clientY,
                activity: a
              });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-purple-400 shrink-0">
                <AppIcon activity={a} />
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-zinc-200 font-medium truncate max-w-[160px]">
                  {a?.appName ?? "Unknown"}
                </span>

                <span className="text-zinc-500 truncate max-w-[160px]">
                  {title}
                </span>
              </div>
            </div>

            <span className="text-zinc-400 shrink-0 ml-3">
              {formatDuration(duration)}
            </span>
          </div>
        );
      })}

      {tooltip && (() => {
        const latestItem = getLatestItem(tooltip.activity);
        const title =
          latestItem?.title ??
          tooltip.activity.items?.[0]?.title ??
          "Unknown Window";

        return (
          <div
            className="fixed bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-4 text-xs w-64 z-[9999]"
            style={{
              top: tooltip.y + 12,
              left: tooltip.x + 12
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="text-purple-400 shrink-0">
                <AppIcon activity={tooltip.activity} />
              </div>

              <div className="font-semibold text-zinc-200 truncate">
                {tooltip.activity.appName}
              </div>
            </div>

            <div className="text-zinc-400 mb-2 break-words">
              {title}
            </div>

            <div className="space-y-1 text-zinc-500">
              <div>
                Duration: {formatDuration(tooltip.activity.duration)}
              </div>

              <div>
                Start: {formatTime(tooltip.activity.start)}
              </div>

              <div>
                End: {formatTime(tooltip.activity.end)}
              </div>

              {tooltip.activity.category && (
                <div>
                  Category: {tooltip.activity.category}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}