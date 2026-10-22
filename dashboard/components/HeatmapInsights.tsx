"use client";

import { useMemo } from "react";
import { Zap, TrendingUp, Clock, Calendar, BarChart3, Target } from "lucide-react";
import { Decode } from "./sam/Decode";

interface HeatmapBucket {
  score: number;
  productivity: number;
  focus: number;
  duration: number;
  idleRatio: number;
  trackedMinutes: number;
  idleMinutes: number;
  dominantApp: string | null;
  dominantCategory: string | null;
  dominantIntent: string | null;
}

type HeatmapDay = Record<number, HeatmapBucket>;
type HeatmapResponse = Record<string, HeatmapDay>;

function formatHMS(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function analyzeHeatmap(data: HeatmapResponse) {
  let bestSingleHour = { score: -Infinity, hour: 0, date: "" };
  let bestTwoHourWindow = { score: -Infinity, startHour: 0, endHour: 0, date: "", duration: 0 };
  let bestThreeHourWindow = { score: -Infinity, startHour: 0, endHour: 0, date: "", duration: 0 };

  const dayStats: Record<string, {
    totalScore: number;
    activeHours: number;
    totalDuration: number;
    avgProductivity: number;
    peakHour: number;
    peakScore: number;
    dominantCategory: string;
    categoryCounts: Record<string, number>;
  }> = {};

  const hourlyPattern = new Map<number, { totalScore: number; count: number; totalDuration: number }>();

  Object.entries(data).forEach(([date, hours]) => {
    let dayTotalScore = 0;
    let dayActiveHours = 0;
    let dayTotalDuration = 0;
    let dayPeakHour = 0;
    let dayPeakScore = -Infinity;
    const categoryCounts: Record<string, number> = {};

    const sortedHours = Object.entries(hours)
      .map(([h, b]) => ({ hour: Number(h), bucket: b }))
      .sort((a, b) => a.hour - b.hour);

    // Single hour + day aggregation
    sortedHours.forEach(({ hour, bucket }) => {
      if (bucket.duration > 0) {
        // Global best single hour
        if (bucket.score > bestSingleHour.score) {
          bestSingleHour = { score: bucket.score, hour, date };
        }

        // Day stats
        dayTotalScore += bucket.score;
        dayActiveHours++;
        dayTotalDuration += bucket.duration;

        if (bucket.score > dayPeakScore) {
          dayPeakScore = bucket.score;
          dayPeakHour = hour;
        }

        // Category tracking
        if (bucket.dominantCategory) {
          categoryCounts[bucket.dominantCategory] = (categoryCounts[bucket.dominantCategory] || 0) + 1;
        }

        // Hourly pattern
        const hStat = hourlyPattern.get(hour) || { totalScore: 0, count: 0, totalDuration: 0 };
        hStat.totalScore += bucket.score;
        hStat.count++;
        hStat.totalDuration += bucket.duration;
        hourlyPattern.set(hour, hStat);
      }
    });

    // Sliding windows for 2h and 3h
    for (let i = 0; i < sortedHours.length - 1; i++) {
      const h1 = sortedHours[i];
      const h2 = sortedHours[i + 1];
      if (h1.bucket.duration > 0 && h2.bucket.duration > 0) {
        const windowScore = h1.bucket.score + h2.bucket.score;
        const windowDuration = h1.bucket.duration + h2.bucket.duration;
        if (windowScore > bestTwoHourWindow.score) {
          bestTwoHourWindow = {
            score: windowScore,
            startHour: h1.hour,
            endHour: h2.hour + 1,
            date,
            duration: windowDuration,
          };
        }
      }
    }

    for (let i = 0; i < sortedHours.length - 2; i++) {
      const h1 = sortedHours[i];
      const h2 = sortedHours[i + 1];
      const h3 = sortedHours[i + 2];
      if (h1.bucket.duration > 0 && h2.bucket.duration > 0 && h3.bucket.duration > 0) {
        const windowScore = h1.bucket.score + h2.bucket.score + h3.bucket.score;
        const windowDuration = h1.bucket.duration + h2.bucket.duration + h3.bucket.duration;
        if (windowScore > bestThreeHourWindow.score) {
          bestThreeHourWindow = {
            score: windowScore,
            startHour: h1.hour,
            endHour: h3.hour + 1,
            date,
            duration: windowDuration,
          };
        }
      }
    }

    // Dominant category for day
    const dominantCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";

    dayStats[date] = {
      totalScore: dayActiveHours > 0 ? dayTotalScore / dayActiveHours : 0,
      activeHours: dayActiveHours,
      totalDuration: dayTotalDuration,
      avgProductivity: dayActiveHours > 0 ? dayTotalScore / dayActiveHours : 0,
      peakHour: dayPeakHour,
      peakScore: dayPeakScore,
      dominantCategory,
      categoryCounts,
    };
  });

  // Best day
  const sortedDays = Object.entries(dayStats).sort((a, b) => b[1].totalScore - a[1].totalScore);
  const bestDay = sortedDays[0];

  // Consistency score (how predictable your good hours are)
  const hourlyReliability = Array.from(hourlyPattern.entries())
    .map(([hour, stat]) => ({
      hour,
      avgScore: stat.count > 0 ? stat.totalScore / stat.count : 0,
      reliability: stat.count, // how many days this hour was active
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // Recommended routine: top 3 consistent hours
  const recommendedHours = hourlyReliability
    .filter(h => h.reliability >= Math.max(2, Object.keys(data).length * 0.3)) // at least 30% of days
    .slice(0, 3);

  return {
    bestSingleHour,
    bestTwoHourWindow,
    bestThreeHourWindow,
    bestDay,
    allDays: sortedDays,
    dayStats,
    hourlyPattern,
    hourlyReliability,
    recommendedHours,
  };
}

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`samaritan-card min-w-0 max-w-full ${className}`}>{children}</div>
);

export default function HeatmapInsights({ data }: { data: HeatmapResponse }) {
  const stats = useMemo(() => analyzeHeatmap(data), [data]);

  if (!stats.bestDay) {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-3">
        <Card className="p-6">
          <p className="text-sm text-zinc-500">No data available for insights.</p>
        </Card>
      </div>
    );
  }

  const [bestDayDate, bestDayStat] = stats.bestDay;
  const bestDayName = new Date(bestDayDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long" });

  return (
    <div className="min-w-0 grid grid-cols-1 xl:grid-cols-1 gap-3">
      {/* Peak Productivity Window - UPGRADED */}
      <Card className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Peak Window
            </p>
            <h3 className="text-xl font-bold text-zinc-100 mt-1">
              <Decode
                value={`${stats.bestTwoHourWindow.startHour.toString().padStart(2, "0")}:00 – ${stats.bestTwoHourWindow.endHour.toString().padStart(2, "0")}:00`}
              />
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {formatDateShort(stats.bestTwoHourWindow.date)} • {formatHMS(stats.bestTwoHourWindow.duration / 1000)}
            </p>
          </div>
          <div className="p-2 bg-red-500/10 rounded-lg">
            <Target className="w-4 h-4 text-red-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Avg Score</p>
            <p className="text-base font-bold text-zinc-100 font-mono">
              {(stats.bestTwoHourWindow.score / 2).toFixed(1)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Best 3H</p>
            <p className="text-base font-bold text-zinc-300 font-mono">
              {stats.bestThreeHourWindow.startHour.toString().padStart(2, "0")}:00 – {stats.bestThreeHourWindow.endHour.toString().padStart(2, "0")}:00
            </p>
          </div>
        </div>

        {/* Recommended routine */}
        {stats.recommendedHours.length > 0 && (
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Recommended Routine
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stats.recommendedHours.map((h) => (
                <span
                  key={h.hour}
                  className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono"
                >
                  {h.hour.toString().padStart(2, "0")}:00
                </span>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">
              Consistent across {Math.round((stats.recommendedHours[0]?.reliability / Object.keys(data).length) * 100)}% of tracked days
            </p>
          </div>
        )}
      </Card>

      {/* Most Productive Day - UPGRADED */}
      <Card className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Best Day
            </p>
            <h3 className="text-xl font-bold text-zinc-100 mt-1">
              {bestDayName}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {bestDayDate} • {bestDayStat.activeHours} active hrs
            </p>
          </div>
          <div className="p-2 bg-zinc-800 rounded-lg">
            <Calendar className="w-4 h-4 text-zinc-300" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Avg Score</p>
            <p className="text-base font-bold text-zinc-100 font-mono">
              {bestDayStat.totalScore.toFixed(1)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Peak Hour</p>
            <p className="text-base font-bold text-zinc-300 font-mono">
              {bestDayStat.peakHour.toString().padStart(2, "0")}:00
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Day Rankings
          </p>
          <div className="space-y-1">
            {stats.allDays.slice(0, 5).map(([date, stat], i) => {
              const dayLabel = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const maxScore = stats.allDays[0][1].totalScore || 1;
              const width = Math.max(5, (stat.totalScore / maxScore) * 100);

              return (
                <div key={date} className="flex items-center gap-2 group">
                  <span className={`text-[10px] w-4 text-right font-mono ${i === 0 ? "text-red-400" : "text-zinc-600"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`sam-fill h-full rounded-full ${i === 0 ? "bg-red-500" : "bg-zinc-600 group-hover:bg-zinc-500"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 w-20 text-right truncate">{dayLabel}</span>
                  <span className="text-xs text-zinc-500 font-mono w-7 text-right">{stat.totalScore.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Hourly Pattern - NEW */}
      <Card className="p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Hourly Pattern
        </p>
        <div className="space-y-1.5">
          {stats.hourlyReliability.slice(0, 5).map((h) => (
            <div key={h.hour} className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono w-8">{h.hour.toString().padStart(2, "0")}:00</span>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="sam-fill h-full bg-red-500/70 rounded-full"
                  style={{ width: `${Math.min(100, (h.avgScore / (stats.hourlyReliability[0]?.avgScore || 1)) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500 font-mono w-10 text-right">{h.avgScore.toFixed(1)}</span>
              <span className="text-[10px] text-zinc-600 w-6 text-right">{h.reliability}d</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
