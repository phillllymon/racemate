import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";

const TIME_API_URL = "https://racematevercel.vercel.app/api/time";
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // re-sync every 5 minutes
const SYNC_SAMPLES = 3; // take 3 samples and use the one with lowest latency

interface TimeContextValue {
  /** Current time in ms since epoch, corrected for server offset */
  now: number;
  /** Formatted 24h time string HH:MM:SS */
  formatted: string;
  /** Whether we've successfully synced with the server */
  synced: boolean;
  /** The current offset in ms (positive = local clock is behind) */
  offset: number;
}

const TimeContext = createContext<TimeContextValue | null>(null);

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function measureOffset(): Promise<{ offset: number; latency: number } | null> {
  try {
    const t0 = Date.now();
    const res = await fetch(TIME_API_URL);
    const t3 = Date.now();
    if (!res.ok) return null;
    const data = await res.json();
    const serverTime = data.serverTime as number;
    const roundTrip = t3 - t0;
    const latency = roundTrip / 2;
    // offset = how much to add to Date.now() to get true time
    const offset = serverTime - t0 - latency;
    return { offset, latency };
  } catch {
    return null;
  }
}

async function syncTime(): Promise<{ offset: number; latency: number } | null> {
  // Take multiple samples and pick the one with lowest latency (most accurate)
  const results: Array<{ offset: number; latency: number }> = [];
  for (let i = 0; i < SYNC_SAMPLES; i++) {
    const result = await measureOffset();
    if (result) results.push(result);
    // Brief pause between samples
    if (i < SYNC_SAMPLES - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  if (results.length === 0) return null;
  // Use the sample with lowest latency
  results.sort((a, b) => a.latency - b.latency);
  return results[0];
}

export function TimeProvider({ children }: { children: ReactNode }) {
  const offsetRef = useRef(0);
  const [synced, setSynced] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const getSourceTime = useCallback(() => {
    return Date.now() + offsetRef.current;
  }, []);

  const tick = useCallback(() => {
    setNow(getSourceTime());
  }, [getSourceTime]);

  const doSync = useCallback(async () => {
    const result = await syncTime();
    if (result) {
      offsetRef.current = result.offset;
      setOffset(result.offset);
      setSynced(true);
      // Immediately update time after sync
      setNow(Date.now() + result.offset);
    }
  }, []);

  useEffect(() => {
    // Sync immediately on mount
    doSync();
    // Re-sync periodically
    const syncId = setInterval(doSync, SYNC_INTERVAL_MS);
    // Tick every second
    const tickId = setInterval(tick, 1000);
    return () => {
      clearInterval(syncId);
      clearInterval(tickId);
    };
  }, [doSync, tick]);

  const value: TimeContextValue = {
    now,
    formatted: formatTime(now),
    synced,
    offset,
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
