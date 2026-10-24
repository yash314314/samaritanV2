"use client";

import { useState } from "react";
import { BellOff, MessageSquare, Shield, Check, Sparkles, RefreshCw } from "lucide-react";

interface SlackDndSyncProps {
  isDeepWorkActive?: boolean;
  className?: string;
}

export default function SlackDndSync({
  isDeepWorkActive = false,
  className = "",
}: SlackDndSyncProps) {
  const [slackSyncEnabled, setSlackSyncEnabled] = useState<boolean>(true);
  const [dndSyncEnabled, setDndSyncEnabled] = useState<boolean>(true);
  const [statusText, setStatusText] = useState<string>("In Deep Work Focus Session");
  const [statusEmoji, setStatusEmoji] = useState<string>("🎯");
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const handleSaveSettings = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
  };

  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur-md font-sans text-zinc-100 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400">
            <BellOff className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              Slack & OS DND Sync
              {isDeepWorkActive && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/60 border border-red-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 animate-pulse" /> DND Armed
                </span>
              )}
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">Automated status & notification silence during focus blocks</p>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-700 transition-all"
        >
          {isSaved ? (
            <>
              <Check className="w-3.5 h-3.5 text-zinc-200" /> Saved
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" /> Save Sync Rules
            </>
          )}
        </button>
      </div>

      {/* Sync Toggle Rules */}
      <div className="space-y-3 mb-4">
        {/* Slack Sync */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="text-xs font-bold text-zinc-200">Slack Status Auto-Sync</div>
              <div className="text-[11px] text-zinc-400">Set Slack status and snooze notifications when Deep Work starts</div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={slackSyncEnabled}
              onChange={(e) => setSlackSyncEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600" />
          </label>
        </div>

        {/* System DND Sync */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="text-xs font-bold text-zinc-200">Windows / OS Focus Mode DND</div>
              <div className="text-[11px] text-zinc-400">Silence desktop popups and system banners during sessions</div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={dndSyncEnabled}
              onChange={(e) => setDndSyncEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600" />
          </label>
        </div>
      </div>

      {/* Active Status Preview */}
      <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs">
        <span className="text-zinc-400">Slack Status Preview:</span>
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          <span>{statusEmoji}</span>
          <span>{statusText}</span>
        </span>
      </div>
    </div>
  );
}
