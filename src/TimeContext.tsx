import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";

interface TimeContextValue {
  /** Current time in ms since epoch, updated every second */
  now: number;
  /** Formatted 24h time string HH:MM:SS */
  formatted: string;
}

const TimeContext = createContext<TimeContextValue | null>(null);

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Returns the current time from the source of truth.
 * Currently uses Date.now(). When we integrate an atomic clock API,
 * this is the only function that needs to change.
 */
function getSourceTime(): number {
  return Date.now();
}

export function TimeProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(getSourceTime);

  const tick = useCallback(() => {
    setNow(getSourceTime());
  }, []);

  useEffect(() => {
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  const value: TimeContextValue = {
    now,
    formatted: formatTime(now),
  };

  return (
    <TimeContext.Provider value={value}>
      {children}
    </TimeContext.Provider>
  );
}

export function useTime(): TimeContextValue {
  const ctx = useContext(TimeContext);
  if (!ctx) throw new Error("useTime must be inside TimeProvider");
  return ctx;
}
