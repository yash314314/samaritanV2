"use client";

import { ALERT_THRESHOLD } from "@/lib/samaritanTheme";
import { Decode } from "@/components/sam/Decode";

interface ReadinessData {
  score: number;
  factors: {
    timeOfDay: number;
    recentPattern: number;
    burnoutRisk: number;
    lastSessionQuality: number;
  };
  recommendedDuration: number;
  bestWindow: { start: number; end: number } | null;
  riskFactors: string[];
  activeDeepWork?: {
    goal?: string | null;
    remainingMinutes?: number;
    plannedMinutes?: number;
  } | null;
}

interface DeepWorkReadinessCardProps {
  data: ReadinessData | null;
  onOpenConfig: () => void;
}

export default function DeepWorkReadinessCard({ data, onOpenConfig }: DeepWorkReadinessCardProps) {
  if (!data) return null;

  const { score, factors, recommendedDuration, bestWindow, riskFactors, activeDeepWork } = data;

  const level = score >= 75 ? "Optimal" : score >= 50 ? "Good" : score >= ALERT_THRESHOLD ? "Fair" : "Poor";
  const low = score < ALERT_THRESHOLD;

  if (activeDeepWork) {
    return (
      <div className="samaritan-card h-full min-h-0 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2>Deep work active</h2>
            <p className="mt-1 text-[12px] text-key">{activeDeepWork.goal || "Session in progress"}</p>
          </div>
          <span className="sam-triangle sam-pulse h-2 w-2.5" aria-hidden />
        </div>
        <div className="mt-6 flex items-baseline gap-2">
          <span className="sam-numeral text-[48px] leading-none">{activeDeepWork.remainingMinutes}</span>
          <span className="sam-key">min left of {activeDeepWork.plannedMinutes}</span>
        </div>
        <button type="button" onClick={onOpenConfig} className="sam-button mt-6 w-full" data-variant="primary">
          Resume session
        </button>
      </div>
    );
  }

  return (
    <div className="samaritan-card h-full min-h-0 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2>Deep work readiness</h2>
          <p className="mt-1 text-[12px] text-key">Current conditions for a focus session</p>
        </div>
        <span className={`sam-key ${low ? "text-alert" : "text-signal"}`}>{level}</span>
      </div>

      <div className="mt-6 flex items-baseline gap-2">
        <span className={`sam-numeral text-[56px] leading-none ${low ? "!text-alert" : ""}`}>
          <Decode value={score} />
        </span>
        <span className="sam-key">/ 100</span>
      </div>

      <div className="sam-bar mt-4" data-alert={low} role="meter" aria-label="Readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        <span style={{ width: `${score}%` }} />
      </div>

      <dl className="mt-6 space-y-3">
        <FactorBar label="Time of day" value={factors.timeOfDay} />
        <FactorBar label="Recent pattern" value={factors.recentPattern} />
        <FactorBar label="Burnout buffer" value={factors.burnoutRisk} />
        <FactorBar label="Last session" value={factors.lastSessionQuality} />
      </dl>

      {recommendedDuration > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-grid pt-4">
          <div>
            <dt className="sam-key">Recommended</dt>
            <dd className="sam-value mt-1 text-[15px]">
              <Decode value={`${recommendedDuration} min`} />
            </dd>
          </div>
          {bestWindow && (
            <div className="text-right">
              <dt className="sam-key">Best window</dt>
              <dd className="sam-value mt-1 text-[15px]">
                {bestWindow.start.toString().padStart(2, "0")}:00–{bestWindow.end.toString().padStart(2, "0")}:00
              </dd>
            </div>
          )}
        </dl>
      )}

      {riskFactors.length > 0 && (
        <ul className="mt-5 space-y-1.5">
          {riskFactors.map((risk, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-warn">
              <span className="sam-triangle mt-1 h-1.5 w-2 shrink-0 !bg-warn" aria-hidden />
              <span>{risk}</span>
            </li>
          ))}
        </ul>
      )}

      {low ? (
        <p className="mt-5 border-l border-alert pl-3 text-[12px] text-alert">
          Conditions are poor for deep work. Take a recovery break first.
        </p>
      ) : (
        <button type="button" onClick={onOpenConfig} className="sam-button mt-5 w-full" data-variant="primary">
          Start a session
        </button>
      )}
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_2rem] items-center gap-3">
      <dt className="sam-key truncate">{label}</dt>
      <dd className="sam-bar" data-alert={value < 20}>
        <span style={{ width: `${value}%` }} />
      </dd>
      <dd className="sam-value text-right text-[12px]">
        <Decode value={value} />
      </dd>
    </div>
  );
}
