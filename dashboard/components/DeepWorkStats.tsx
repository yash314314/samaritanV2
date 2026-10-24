"use client";

function formatDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return "0m";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export default function DeepWorkStats({ data }: any) {
  if (!data) return null;

  // FIXED: Backend returns milliseconds, not seconds
  const deepWorkMs = data.totalDeepWorkMs ?? data.deepWorkDuration ?? 0;
  const totalActiveMs = data.totalActiveMs ?? data.totalDuration ?? 1;

  const deepWorkSeconds = Math.round(deepWorkMs / 1000);
  const totalActiveSeconds = Math.round(totalActiveMs / 1000);

  const deepWorkSessions = data.deepWorkSessions ?? 0;
  const focusScore = data.focusScore ?? data.averageFocusScore ?? 0;

  const deepWorkRatio = totalActiveSeconds > 0 
    ? (deepWorkSeconds / totalActiveSeconds) * 100 
    : 0;

  const avgDeepWork = deepWorkSessions > 0 
    ? deepWorkSeconds / deepWorkSessions 
    : 0;

  return (
    <div className="samaritan-card p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-zinc-300">Deep Work</h2>
        <span className="text-xs text-zinc-400">{deepWorkSessions} sessions</span>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <div className="flex justify-between text-zinc-400 mb-1">
            <span>Total Deep Work</span>
            <span className="text-zinc-200">{formatDuration(deepWorkSeconds)}</span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded">
            <div className="bg-signal text-void h-2 rounded" style={{ width: `${Math.min(deepWorkRatio, 100)}%` }} />
          </div>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">Deep Work Ratio</span>
          <span className="text-zinc-200">{deepWorkRatio.toFixed(1)}%</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">Avg Deep Work Session</span>
          <span className="text-zinc-200">{formatDuration(avgDeepWork)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">Focus Score</span>
          <span className="text-red-500 font-medium">{focusScore.toFixed(1)}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-500">
        Deep work reflects uninterrupted cognitive effort. Higher ratios indicate sustained focus periods.
      </div>
    </div>
  );
}
