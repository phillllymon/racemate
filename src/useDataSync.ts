import { useEffect, useRef, useCallback } from "react";

const DEFAULT_INTERVAL = 15000; // 15 seconds

/**
 * useDataSync — periodically calls a refresh function while the component is mounted.
 * 
 * Fetches immediately on mount (or when deps change), then polls at the configured interval.
 * Designed to be swappable to a push-based system (WebSockets, Pusher, etc.) later — 
 * components just call useDataSync and don't care about the transport.
 * 
 * @param fetchFn - async function to call for fresh data
 * @param deps - dependency array; re-fetches immediately when these change
 * @param enabled - whether syncing is active (e.g., only when tab is visible)
 * @param intervalMs - polling interval in ms (reads from localStorage override if set)
 */
export function useDataSync(
  fetchFn: () => Promise<void> | void,
  deps: unknown[],
  enabled: boolean = true,
  intervalMs?: number
) {
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const getInterval = useCallback(() => {
    if (intervalMs != null) return intervalMs;
    const stored = localStorage.getItem("racemate-sync-interval");
    if (stored) {
      const parsed = Number(stored);
      if (!isNaN(parsed) && parsed > 0) return parsed;
      if (stored === "off" || stored === "0") return 0;
    }
    return DEFAULT_INTERVAL;
  }, [intervalMs]);

  useEffect(() => {
    if (!enabled) return;

    // Fetch immediately
    fetchRef.current();

    // Set up polling
    const interval = getInterval();
    if (interval <= 0) return; // polling disabled

    const timer = setInterval(() => {
      fetchRef.current();
    }, interval);

    return () => clearInterval(timer);
  }, [...deps, enabled, getInterval]);
}

/**
 * Returns the current sync interval setting for display in UI.
 */
export function getSyncInterval(): number {
  const stored = localStorage.getItem("racemate-sync-interval");
  if (stored) {
    const parsed = Number(stored);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_INTERVAL;
}

export function setSyncInterval(ms: number) {
  localStorage.setItem("racemate-sync-interval", String(ms));
  window.dispatchEvent(new Event("racemate-settings-changed"));
}
