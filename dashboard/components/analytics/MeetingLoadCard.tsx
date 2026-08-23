"use client";

import { useState } from "react";
import { Video, Users, Clock, AlertCircle, CheckCircle, Sparkles, PhoneCall } from "lucide-react";

interface MeetingAppUsage {
  name: string;
  minutes: number;
  icon?: string;
}

interface MeetingLoadCardProps {
  meetingMinutes?: number;
  focusMinutes?: number;
  totalWorkMinutes?: number;
  apps?: MeetingAppUsage[];
  className?: string;
}

export default function MeetingLoadCard({
  meetingMinutes = 85,
  focusMinutes = 270,
  totalWorkMinutes = 420,
  apps = [
    { name: "Google Meet", minutes: 45 },
    { name: "Zoom", minutes: 25 },
    { name: "Slack Huddle", minutes: 15 },
  ],
  className = "",
}: MeetingLoadCardProps) {
  const meetingPct = Math.round((meetingMinutes / Math.max(1, totalWorkMinutes)) * 100);
  const focusPct = Math.round((focusMinutes / Math.max(1, totalWorkMinutes)) * 100);

  const formatHours = (mins: number) => {
    const hrs = (mins / 60).toFixed(1);
    return `${hrs}h`;
  };

  const getMeetingStatus = () => {
    if (meetingPct <= 25) {
      return {
        label: "Optimal Meeting Load",
        color: "text-emerald-400 bg-emerald-950/60 border-emerald-800",
        icon: CheckCircle,
        desc: "Healthy balance. Plenty of unstructured deep work time remaining.",
      };
    } else if (meetingPct <= 45) {
      return {
        label: "Moderate Meeting Load",
        color: "text-amber-400 bg-amber-950/60 border-amber-800",
        icon: AlertCircle,
        desc: "Consider consolidating short syncs to protect afternoon focus blocks.",
      };
    } else {
      return {
        label: "High Meeting Fragmentation",
        color: "text-rose-400 bg-rose-950/60 border-rose-800",
        icon: AlertCircle,
        desc: "Over 45% of workday spent in calls. Context switching risk is elevated.",
      };
    }
  };

  const status = getMeetingStatus();
  const StatusIcon = status.icon;

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md font-sans text-slate-100 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shadow-md shadow-purple-500/10">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Meeting Load Analytics
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${status.color}`}>
                <StatusIcon className="w-3 h-3" /> {status.label}
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">Automated video call & calendar overlap tracking</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl font-extrabold font-mono text-purple-300">
            {meetingPct}%
          </div>
          <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">Meeting Load</div>
        </div>
      </div>

      {/* Stacked Work Breakdown Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 font-medium mb-1.5">
          <span className="flex items-center gap-1 text-purple-300">
            <PhoneCall className="w-3 h-3" /> Meetings ({formatHours(meetingMinutes)})
          </span>
          <span className="flex items-center gap-1 text-cyan-300">
            <Clock className="w-3 h-3" /> Focus Work ({formatHours(focusMinutes)})
          </span>
        </div>

        <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
          <div
            className="h-full bg-purple-500 rounded-l-full transition-all duration-500"
            style={{ width: `${meetingPct}%` }}
          />
          <div
            className="h-full bg-cyan-400 rounded-r-full transition-all duration-500"
            style={{ width: `${focusPct}%` }}
          />
        </div>
      </div>

      {/* App Breakdown Pills */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {apps.map((app) => (
          <div
            key={app.name}
            className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
          >
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-semibold text-slate-200 truncate">{app.name}</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">{app.minutes}m</span>
          </div>
        ))}
      </div>

      {/* Insights Banner */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Rize Insight: </span>
          <span className="text-slate-400">{status.desc}</span>
        </div>
      </div>
    </div>
  );
}
