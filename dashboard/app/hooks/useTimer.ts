"use client";

import { useState, useEffect } from "react";

export function useTimer(targetMinutes: number, startedAt: string) {
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(targetMinutes * 60);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    
    const tick = () => {
      const now = Date.now();
      const elapsedSec = Math.floor((now - start) / 1000);
      const remainingSec = Math.max(0, targetMinutes * 60 - elapsedSec);
      setElapsed(elapsedSec);
      setRemaining(remainingSec);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetMinutes, startedAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return {
    elapsed,
    remaining,
    elapsedFormatted: formatTime(elapsed),
    remainingFormatted: formatTime(remaining),
    isExpired: remaining <= 0,
  };
}