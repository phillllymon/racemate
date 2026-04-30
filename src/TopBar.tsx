import { useState, useEffect, useRef } from "react";
import { useTime } from "./TimeContext";
import { useRaces } from "./RaceContext";
import FullscreenButton from "./FullscreenButton";
import TopBarMenu from "./TopBarMenu";
import type { StartInfo } from "./api";

interface TopBarProps {
  raceName: string | null;
  synced: boolean;
}

function formatCountdownCompact(ms: number): { text: string; days: number } {
  const neg = ms < 0;
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const days = Math.floor(h / 24);
  const displayH = h % 24;
  let str: string;
  if (h > 0) {
    str = `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  } else {
    str = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return { text: neg ? `+${str}` : `-${str}`, days };
}

function getNextStart(starts: StartInfo[], now: number): StartInfo | null {
  // Find the next start that hasn't happened yet (or most recent if all passed)
  const upcoming = starts
    .filter((s) => s.startTime != null && s.startTime > now)
    .sort((a, b) => a.startTime! - b.startTime!);
  if (upcoming.length > 0) return upcoming[0];
  return null;
}

function getLastStart(starts: StartInfo[]): StartInfo | null {
  const withTimes = starts.filter((s) => s.startTime != null).sort((a, b) => b.startTime! - a.startTime!);
  return withTimes.length > 0 ? withTimes[0] : null;
}

export default function TopBar({ raceName, synced }: TopBarProps) {
  const { formatted, synced: timeSynced, offset, now } = useTime();
  const { selectedRace } = useRaces();
  const [clockMode, setClockMode] = useState<"clock" | "countdown">("clock");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevNextStartRef = useRef<StartInfo | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const starts = (selectedRace?.info.starts || []) as StartInfo[];
  const nextStart = getNextStart(starts, now);
  const lastStart = getLastStart(starts);
  const hasUpcomingStarts = nextStart != null;

  // Detect when the last start fires — flash and revert to clock
  useEffect(() => {
    if (clockMode !== "countdown") return;
    const prev = prevNextStartRef.current;
    prevNextStartRef.current = nextStart;

    // If we had a next start and now we don't, the last start just fired
    if (prev != null && nextStart == null && lastStart?.startTime != null && now >= lastStart.startTime) {
      setFlash(true);
      setTimeout(() => {
        setFlash(false);
        setClockMode("clock");
      }, 3000);
    }
  }, [nextStart, lastStart, now, clockMode]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // Auto-revert to clock if race is deselected
  useEffect(() => {
    if (!selectedRace && clockMode === "countdown") {
      setClockMode("clock");
    }
  }, [selectedRace, clockMode]);

  // Build countdown display
  let countdownDisplay = "";
  let countdownLabel = "";
  if (clockMode === "countdown" && nextStart) {
    const cd = formatCountdownCompact(nextStart.startTime! - now);
    countdownDisplay = cd.days > 0 ? `${cd.days}d ${cd.text}` : cd.text;
    countdownLabel = nextStart.classes?.join(", ") || "Start";
  } else if (clockMode === "countdown" && !nextStart && lastStart?.startTime != null) {
    const cd = formatCountdownCompact(lastStart.startTime - now);
    countdownDisplay = cd.text;
    countdownLabel = "All started";
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <TopBarMenu />
        <div className="topbar-clock-wrap" ref={dropdownRef}>
          <button
            className={`topbar-clock ${flash ? "topbar-clock--flash" : ""}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {clockMode === "clock" ? (
              <span>{formatted}</span>
            ) : (
              <span className="topbar-countdown">
                <span className="topbar-countdown-time">{countdownDisplay}</span>
                <span className="topbar-countdown-label">{countdownLabel}</span>
              </span>
            )}
            <span className="topbar-clock-arrow">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
          {dropdownOpen && (
            <div className="topbar-clock-dropdown">
              <button
                className={`topbar-clock-option ${clockMode === "clock" ? "topbar-clock-option--active" : ""}`}
                onClick={() => { setClockMode("clock"); setDropdownOpen(false); }}
              >
                Clock
              </button>
              <button
                className={`topbar-clock-option ${clockMode === "countdown" ? "topbar-clock-option--active" : ""} ${!hasUpcomingStarts ? "topbar-clock-option--disabled" : ""}`}
                disabled={!hasUpcomingStarts}
                onClick={() => {
                  if (hasUpcomingStarts) {
                    setClockMode("countdown");
                    setDropdownOpen(false);
                  }
                }}
              >
                Countdown
                {!hasUpcomingStarts && <span className="topbar-clock-option-hint">No upcoming starts</span>}
              </button>
            </div>
          )}
        </div>
        <span
          className={`topbar-time-sync ${timeSynced ? "topbar-time-sync--ok" : "topbar-time-sync--pending"}`}
          title={timeSynced ? `Time synced (${offset > 0 ? "+" : ""}${offset}ms)` : "Time sync pending..."}
        >
          {timeSynced ? "⏱" : "⏳"}
        </span>
      </div>

      <div className="topbar-center">
        <span className="topbar-race">
          {raceName || "No race selected"}
        </span>
      </div>

      <div className="topbar-right">
        <span
          className={`topbar-sync ${synced ? "topbar-sync--ok" : "topbar-sync--pending"}`}
          title={synced ? "Synced" : "Syncing..."}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {synced ? (
              <polyline points="20 6 9 17 4 12" />
            ) : (
              <>
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </>
            )}
          </svg>
        </span>
        <FullscreenButton />
      </div>
    </div>
  );
}
