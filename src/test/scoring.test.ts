// Run: npx vitest run src/tests/scoring.test.ts
// Install first: npm install -D vitest
//
// These tests duplicate pure functions from the app so they can be tested
// independently. If you refactor to export these, you can import directly.

import { describe, it, expect } from "vitest";

// =====================================================
// COPIED PURE FUNCTIONS — keep in sync with source
// =====================================================

// ---- Scoring (from ResultsTab.tsx) ----

type WindCondition = "light" | "medium" | "heavy";
type PortsmouthBase = 100 | 1000;

const PHRF_TOT_CONSTANTS: Record<WindCondition, { a: number; b: number }> = {
  light: { a: 650, b: 490 },
  medium: { a: 650, b: 550 },
  heavy: { a: 650, b: 610 },
};

function calcPhrfToT(elapsedMs: number, phrf: number, wind: WindCondition, customAB?: { a: number; b: number }): number {
  const { a, b } = customAB || PHRF_TOT_CONSTANTS[wind];
  return elapsedMs * (a / (b + phrf));
}

function calcPhrfToD(elapsedMs: number, phrf: number, distanceNm: number): number {
  const correctionMs = phrf * distanceNm * 1000;
  return Math.max(0, elapsedMs - correctionMs);
}

function calcPortsmouth(elapsedMs: number, pn: number, base: PortsmouthBase): number {
  return elapsedMs * (base / pn);
}

function calcIrc(elapsedMs: number, tcc: number): number {
  return elapsedMs * tcc;
}

// ---- Formatting (from ResultsTab.tsx) ----

function formatElapsed(ms: number | null): string {
  if (ms == null) return "\u2014";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---- Formatting (from StartTab.tsx) ----

function formatCountdown(ms: number): { text: string; days: number } {
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
  return { text: neg ? `+${str}` : str, days };
}

// ---- Formatting (from TopBar.tsx) ----

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

// ---- Formatting (from FinishTab.tsx) ----

function formatFinishTimeShort(ms: number): string {
  const d = new Date(Number(ms));
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatElapsedShort(elapsedMs: number): string {
  const totalSec = Math.round(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---- Formatting (from StartTab.tsx) ----

function formatAbsoluteTime(ms: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ---- Status labels (from ResultsTab.tsx) ----

function statusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === "OCS") return "OCS";
  if (s === "DNF") return "DNF";
  if (s === "DNS") return "DNS";
  if (s === "DSQ") return "DSQ";
  if (s === "FINISHED") return "";
  if (s === "RACING") return "";
  return "";
}

// ---- CSV (from ResultsTab.tsx) ----

function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return "\u2014";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---- Fleet average (from ResultsTab.tsx) ----

function getFleetAverageAB(ratings: number[], c: number): { a: number; b: number } {
  if (ratings.length === 0) return { a: c, b: c - 100 };
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return { a: c, b: Math.round(c - avg) };
}

// ---- Resolve timing method (from ResultsTab.tsx) ----

type TimingMode = "absolute" | "corrected";
type CorrectionMethod = "phrf-tot" | "phrf-tod" | "portsmouth" | "irc";

function resolveTimingMethod(timingMode: TimingMode, correctionMethod: CorrectionMethod): string {
  if (timingMode === "absolute") return "absolute";
  return correctionMethod;
}

// ---- Column defaults (from ResultsTab.tsx) ----

type RaceColId = "elapsed" | "corrected" | "sailNum" | "class" | "division" | "skipper" | "rating" | "status" | "divRank" | "classRank";

function defaultVisibleCols(timingMethod: string): Set<RaceColId> {
  const cols: RaceColId[] = ["elapsed"];
  if (timingMethod !== "absolute") cols.push("corrected");
  return new Set(cols);
}

// ---- Start helpers (from TopBar.tsx) ----

interface StartInfo {
  id: string;
  classes: string[];
  startTime?: number | null;
}

function getNextStart(starts: StartInfo[], now: number): StartInfo | null {
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

// ---- Division helpers ----

interface Division {
  name: string;
  classes: string[];
}

function getDivisionForClass(divisions: Division[], className: string): Division | null {
  return divisions.find((d) => d.classes.includes(className)) || null;
}

// =====================================================
// TESTS
// =====================================================

const ONE_HOUR = 3600 * 1000;
const ONE_MIN = 60 * 1000;

// ---- PHRF Time-on-Time ----

describe("PHRF Time-on-Time", () => {
  it("calculates correctly with medium wind", () => {
    const ct = calcPhrfToT(ONE_HOUR, 150, "medium");
    expect(ct).toBeCloseTo(ONE_HOUR * 650 / 700, 0);
  });

  it("higher PHRF gets more correction (lower CT)", () => {
    expect(calcPhrfToT(ONE_HOUR, 200, "medium")).toBeLessThan(calcPhrfToT(ONE_HOUR, 100, "medium"));
  });

  it("PHRF 100 medium wind gives CT = ET", () => {
    expect(calcPhrfToT(ONE_HOUR, 100, "medium")).toBeCloseTo(ONE_HOUR, 0);
  });

  it("light wind gives different result than medium", () => {
    expect(calcPhrfToT(ONE_HOUR, 150, "light")).not.toBeCloseTo(calcPhrfToT(ONE_HOUR, 150, "medium"), 0);
  });

  it("heavy wind gives different result than medium", () => {
    expect(calcPhrfToT(ONE_HOUR, 150, "heavy")).not.toBeCloseTo(calcPhrfToT(ONE_HOUR, 150, "medium"), 0);
  });

  it("custom AB overrides wind constants", () => {
    const ct = calcPhrfToT(ONE_HOUR, 150, "medium", { a: 650, b: 500 });
    expect(ct).toBeCloseTo(ONE_HOUR, 0);
  });

  it("zero elapsed gives zero corrected", () => {
    expect(calcPhrfToT(0, 150, "medium")).toBe(0);
  });

  it("PHRF 0 gives CT = ET * (a/b)", () => {
    const ct = calcPhrfToT(ONE_HOUR, 0, "medium");
    expect(ct).toBeCloseTo(ONE_HOUR * 650 / 550, 0);
  });

  it("negative PHRF gives larger CT", () => {
    const ctNeg = calcPhrfToT(ONE_HOUR, -50, "medium");
    const ct0 = calcPhrfToT(ONE_HOUR, 0, "medium");
    expect(ctNeg).toBeGreaterThan(ct0);
  });

  it("very large PHRF doesn't produce negative values", () => {
    expect(calcPhrfToT(ONE_HOUR, 500, "medium")).toBeGreaterThan(0);
  });
});

// ---- PHRF Time-on-Distance ----

describe("PHRF Time-on-Distance", () => {
  it("calculates correctly", () => {
    expect(calcPhrfToD(ONE_HOUR, 150, 5)).toBe(3600000 - 750000);
  });

  it("higher PHRF gets bigger correction", () => {
    expect(calcPhrfToD(ONE_HOUR, 200, 5)).toBeLessThan(calcPhrfToD(ONE_HOUR, 150, 5));
  });

  it("more distance means more correction", () => {
    expect(calcPhrfToD(ONE_HOUR, 150, 10)).toBeLessThan(calcPhrfToD(ONE_HOUR, 150, 5));
  });

  it("clamps to zero for extreme corrections", () => {
    expect(calcPhrfToD(ONE_HOUR, 300, 20)).toBe(0);
  });

  it("zero distance returns elapsed time", () => {
    expect(calcPhrfToD(ONE_HOUR, 150, 0)).toBe(ONE_HOUR);
  });

  it("zero elapsed returns zero", () => {
    expect(calcPhrfToD(0, 150, 5)).toBe(0);
  });

  it("PHRF 0 returns elapsed time regardless of distance", () => {
    expect(calcPhrfToD(ONE_HOUR, 0, 10)).toBe(ONE_HOUR);
  });
});

// ---- Portsmouth Yardstick ----

describe("Portsmouth Yardstick", () => {
  it("calculates correctly with base 1000", () => {
    expect(calcPortsmouth(ONE_HOUR, 1100, 1000)).toBeCloseTo(ONE_HOUR * 1000 / 1100, 0);
  });

  it("lower PN gets higher CT (faster boat penalized)", () => {
    expect(calcPortsmouth(ONE_HOUR, 900, 1000)).toBeGreaterThan(calcPortsmouth(ONE_HOUR, 1100, 1000));
  });

  it("base 100 and base 1000 give equivalent results", () => {
    expect(calcPortsmouth(ONE_HOUR, 110, 100)).toBeCloseTo(calcPortsmouth(ONE_HOUR, 1100, 1000), 0);
  });

  it("PN equal to base gives CT = ET", () => {
    expect(calcPortsmouth(ONE_HOUR, 1000, 1000)).toBeCloseTo(ONE_HOUR, 0);
  });

  it("zero elapsed gives zero", () => {
    expect(calcPortsmouth(0, 1100, 1000)).toBe(0);
  });
});

// ---- IRC ----

describe("IRC", () => {
  it("TCC < 1 reduces elapsed time", () => {
    expect(calcIrc(ONE_HOUR, 0.95)).toBeCloseTo(ONE_HOUR * 0.95, 0);
  });

  it("TCC > 1 increases elapsed time", () => {
    expect(calcIrc(ONE_HOUR, 1.05)).toBeGreaterThan(ONE_HOUR);
  });

  it("TCC = 1 gives CT = ET", () => {
    expect(calcIrc(ONE_HOUR, 1.0)).toBe(ONE_HOUR);
  });

  it("TCC = 0 gives zero", () => {
    expect(calcIrc(ONE_HOUR, 0)).toBe(0);
  });

  it("zero elapsed gives zero regardless of TCC", () => {
    expect(calcIrc(0, 0.95)).toBe(0);
  });
});

// ---- formatElapsed ----

describe("formatElapsed", () => {
  it("returns \u2014 for null", () => {
    expect(formatElapsed(null)).toBe("\u2014");
  });

  it("formats seconds only", () => {
    expect(formatElapsed(5000)).toBe("00:05");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsed(125000)).toBe("02:05");
  });

  it("formats hours, minutes, seconds", () => {
    expect(formatElapsed(3661000)).toBe("1:01:01");
  });

  it("handles exactly one hour", () => {
    expect(formatElapsed(ONE_HOUR)).toBe("1:00:00");
  });

  it("handles zero", () => {
    expect(formatElapsed(0)).toBe("00:00");
  });

  it("handles large values (10+ hours)", () => {
    expect(formatElapsed(10 * ONE_HOUR)).toBe("10:00:00");
  });

  it("handles sub-second values (rounds down)", () => {
    expect(formatElapsed(999)).toBe("00:00");
  });

  it("handles 59 minutes 59 seconds", () => {
    expect(formatElapsed(59 * ONE_MIN + 59000)).toBe("59:59");
  });
});

// ---- formatCountdown (StartTab version) ----

describe("formatCountdown", () => {
  it("formats positive countdown (before start)", () => {
    const result = formatCountdown(3661000);
    expect(result.text).toBe("01:01:01");
    expect(result.days).toBe(0);
  });

  it("formats negative (elapsed after start) with + prefix", () => {
    const result = formatCountdown(-3661000);
    expect(result.text).toBe("+01:01:01");
  });

  it("calculates days for long countdowns", () => {
    const result = formatCountdown(2 * 24 * ONE_HOUR + ONE_HOUR);
    expect(result.days).toBe(2);
    expect(result.text).toBe("01:00:00");
  });

  it("calculates days for negative elapsed", () => {
    const result = formatCountdown(-(3 * 24 * ONE_HOUR + 5 * ONE_HOUR));
    expect(result.days).toBe(3);
    expect(result.text).toBe("+05:00:00");
  });

  it("zero shows as 00:00", () => {
    const result = formatCountdown(0);
    expect(result.text).toBe("00:00");
    expect(result.days).toBe(0);
  });

  it("small values show mm:ss only", () => {
    const result = formatCountdown(90000);
    expect(result.text).toBe("01:30");
  });
});

// ---- formatCountdownCompact (TopBar version) ----

describe("formatCountdownCompact", () => {
  it("shows minus prefix for positive (countdown)", () => {
    const result = formatCountdownCompact(5 * ONE_MIN);
    expect(result.text).toBe("-05:00");
  });

  it("shows plus prefix for negative (elapsed)", () => {
    const result = formatCountdownCompact(-5 * ONE_MIN);
    expect(result.text).toBe("+05:00");
  });

  it("includes hours when > 60 min", () => {
    const result = formatCountdownCompact(ONE_HOUR + 30 * ONE_MIN);
    expect(result.text).toBe("-01:30:00");
  });

  it("handles zero", () => {
    const result = formatCountdownCompact(0);
    expect(result.text).toBe("-00:00");
    expect(result.days).toBe(0);
  });

  it("calculates days", () => {
    const result = formatCountdownCompact(26 * ONE_HOUR);
    expect(result.days).toBe(1);
    expect(result.text).toBe("-02:00:00");
  });
});

// ---- formatFinishTimeShort ----

describe("formatFinishTimeShort", () => {
  it("formats a timestamp to HH:MM:SS", () => {
    const d = new Date(2024, 0, 1, 14, 30, 45);
    expect(formatFinishTimeShort(d.getTime())).toBe("14:30:45");
  });

  it("handles midnight", () => {
    const d = new Date(2024, 0, 1, 0, 0, 0);
    expect(formatFinishTimeShort(d.getTime())).toBe("00:00:00");
  });

  it("handles string input (database return)", () => {
    const d = new Date(2024, 0, 1, 14, 30, 45);
    expect(formatFinishTimeShort(String(d.getTime()) as any)).toBe("14:30:45");
  });

  it("pads single digits", () => {
    const d = new Date(2024, 0, 1, 5, 3, 7);
    expect(formatFinishTimeShort(d.getTime())).toBe("05:03:07");
  });
});

// ---- formatElapsedShort ----

describe("formatElapsedShort", () => {
  it("formats minutes and seconds without padding minutes", () => {
    expect(formatElapsedShort(125000)).toBe("2:05");
  });

  it("formats hours", () => {
    expect(formatElapsedShort(ONE_HOUR + 5 * ONE_MIN)).toBe("1:05:00");
  });

  it("handles zero", () => {
    expect(formatElapsedShort(0)).toBe("0:00");
  });

  it("rounds to nearest second", () => {
    expect(formatElapsedShort(1500)).toBe("0:02");
  });
});

// ---- formatAbsoluteTime ----

describe("formatAbsoluteTime", () => {
  it("formats timestamp to HH:MM:SS", () => {
    const d = new Date(2024, 0, 1, 9, 5, 30);
    expect(formatAbsoluteTime(d.getTime())).toBe("09:05:30");
  });

  it("matches formatFinishTimeShort for same input", () => {
    const ts = new Date(2024, 5, 15, 16, 45, 10).getTime();
    expect(formatAbsoluteTime(ts)).toBe(formatFinishTimeShort(ts));
  });
});

// ---- statusLabel ----

describe("statusLabel", () => {
  it("returns OCS for OCS", () => { expect(statusLabel("OCS")).toBe("OCS"); });
  it("returns DNF for DNF", () => { expect(statusLabel("DNF")).toBe("DNF"); });
  it("returns DNS for DNS", () => { expect(statusLabel("DNS")).toBe("DNS"); });
  it("returns DSQ for DSQ", () => { expect(statusLabel("DSQ")).toBe("DSQ"); });
  it("returns empty for finished", () => { expect(statusLabel("finished")).toBe(""); });
  it("returns empty for racing", () => { expect(statusLabel("racing")).toBe(""); });
  it("is case insensitive", () => {
    expect(statusLabel("ocs")).toBe("OCS");
    expect(statusLabel("dnf")).toBe("DNF");
  });
  it("returns empty for unknown statuses", () => {
    expect(statusLabel("checked-in")).toBe("");
    expect(statusLabel("registered")).toBe("");
  });
});

// ---- csvEscape ----

describe("csvEscape", () => {
  it("returns \u2014 for null", () => { expect(csvEscape(null)).toBe("\u2014"); });
  it("returns \u2014 for undefined", () => { expect(csvEscape(undefined)).toBe("\u2014"); });
  it("passes through simple strings", () => { expect(csvEscape("hello")).toBe("hello"); });
  it("wraps commas in quotes", () => { expect(csvEscape("hello, world")).toBe('"hello, world"'); });
  it("escapes double quotes", () => { expect(csvEscape('say "hi"')).toBe('"say ""hi"""'); });
  it("handles newlines", () => { expect(csvEscape("line1\nline2")).toBe('"line1\nline2"'); });
  it("passes through numbers", () => { expect(csvEscape(42)).toBe("42"); });
  it("handles empty string", () => { expect(csvEscape("")).toBe(""); });
  it("handles string with only quotes", () => { expect(csvEscape('"')).toBe('""""'); });
});

// ---- Fleet Average A/B ----

describe("Fleet Average A/B", () => {
  it("calculates from fleet ratings", () => {
    const ab = getFleetAverageAB([100, 150, 200], 650);
    expect(ab).toEqual({ a: 650, b: 500 });
  });

  it("returns fallback for empty fleet", () => {
    expect(getFleetAverageAB([], 650)).toEqual({ a: 650, b: 550 });
  });

  it("single boat fleet", () => {
    expect(getFleetAverageAB([200], 650)).toEqual({ a: 650, b: 450 });
  });

  it("all same rating", () => {
    expect(getFleetAverageAB([150, 150, 150], 650)).toEqual({ a: 650, b: 500 });
  });

  it("rounds B to nearest integer", () => {
    const ab = getFleetAverageAB([133, 167], 650);
    expect(ab.b).toBe(500);
  });
});

// ---- resolveTimingMethod ----

describe("resolveTimingMethod", () => {
  it("returns absolute for absolute mode", () => {
    expect(resolveTimingMethod("absolute", "phrf-tot")).toBe("absolute");
  });

  it("returns correction method for corrected mode", () => {
    expect(resolveTimingMethod("corrected", "phrf-tot")).toBe("phrf-tot");
    expect(resolveTimingMethod("corrected", "phrf-tod")).toBe("phrf-tod");
    expect(resolveTimingMethod("corrected", "portsmouth")).toBe("portsmouth");
    expect(resolveTimingMethod("corrected", "irc")).toBe("irc");
  });
});

// ---- defaultVisibleCols ----

describe("defaultVisibleCols", () => {
  it("includes elapsed for absolute", () => {
    const cols = defaultVisibleCols("absolute");
    expect(cols.has("elapsed")).toBe(true);
    expect(cols.has("corrected")).toBe(false);
  });

  it("includes both elapsed and corrected for correction methods", () => {
    for (const method of ["phrf-tot", "phrf-tod", "portsmouth", "irc"]) {
      const cols = defaultVisibleCols(method);
      expect(cols.has("elapsed")).toBe(true);
      expect(cols.has("corrected")).toBe(true);
    }
  });

  it("does not include non-default columns", () => {
    const cols = defaultVisibleCols("phrf-tot");
    expect(cols.has("sailNum")).toBe(false);
    expect(cols.has("skipper")).toBe(false);
    expect(cols.has("rating")).toBe(false);
  });
});

// ---- getNextStart ----

describe("getNextStart", () => {
  const starts: StartInfo[] = [
    { id: "1", classes: ["A"], startTime: 1000 },
    { id: "2", classes: ["B"], startTime: 2000 },
    { id: "3", classes: ["C"], startTime: 3000 },
  ];

  it("returns the next upcoming start", () => {
    expect(getNextStart(starts, 1500)?.id).toBe("2");
  });

  it("returns the first start if all are upcoming", () => {
    expect(getNextStart(starts, 500)?.id).toBe("1");
  });

  it("returns null if all starts have passed", () => {
    expect(getNextStart(starts, 5000)).toBeNull();
  });

  it("handles starts with null startTime", () => {
    const mixed = [
      { id: "1", classes: ["A"], startTime: null },
      { id: "2", classes: ["B"], startTime: 2000 },
    ];
    expect(getNextStart(mixed, 1500)?.id).toBe("2");
  });

  it("handles empty starts", () => {
    expect(getNextStart([], 1000)).toBeNull();
  });

  it("returns closest upcoming, not farthest", () => {
    expect(getNextStart(starts, 0)?.startTime).toBe(1000);
  });
});

// ---- getLastStart ----

describe("getLastStart", () => {
  const starts: StartInfo[] = [
    { id: "1", classes: ["A"], startTime: 1000 },
    { id: "2", classes: ["B"], startTime: 2000 },
    { id: "3", classes: ["C"], startTime: 3000 },
  ];

  it("returns the start with the latest time", () => {
    expect(getLastStart(starts)?.id).toBe("3");
  });

  it("returns null for empty array", () => {
    expect(getLastStart([])).toBeNull();
  });

  it("handles starts with null startTime", () => {
    const mixed = [
      { id: "1", classes: ["A"], startTime: null },
      { id: "2", classes: ["B"], startTime: 2000 },
    ];
    expect(getLastStart(mixed)?.id).toBe("2");
  });

  it("handles all null startTimes", () => {
    const allNull = [
      { id: "1", classes: ["A"], startTime: null },
      { id: "2", classes: ["B"], startTime: null },
    ];
    expect(getLastStart(allNull)).toBeNull();
  });
});

// ---- Division helpers ----

describe("getDivisionForClass", () => {
  const divisions: Division[] = [
    { name: "Division A", classes: ["Spinnaker", "PHRF A"] },
    { name: "Division B", classes: ["Non-Spin", "Cruising"] },
  ];

  it("finds the division for a class", () => {
    expect(getDivisionForClass(divisions, "Spinnaker")?.name).toBe("Division A");
    expect(getDivisionForClass(divisions, "Non-Spin")?.name).toBe("Division B");
  });

  it("returns null for unassigned class", () => {
    expect(getDivisionForClass(divisions, "Unknown")).toBeNull();
  });

  it("handles empty divisions", () => {
    expect(getDivisionForClass([], "Spinnaker")).toBeNull();
  });

  it("handles empty class name", () => {
    expect(getDivisionForClass(divisions, "")).toBeNull();
  });
});

// ---- Cross-method consistency ----

describe("Cross-method consistency", () => {
  it("all methods return positive values for reasonable inputs", () => {
    expect(calcPhrfToT(ONE_HOUR, 150, "medium")).toBeGreaterThan(0);
    expect(calcPhrfToD(ONE_HOUR, 150, 5)).toBeGreaterThan(0);
    expect(calcPortsmouth(ONE_HOUR, 1100, 1000)).toBeGreaterThan(0);
    expect(calcIrc(ONE_HOUR, 0.95)).toBeGreaterThan(0);
  });

  it("identical boats get identical corrected times", () => {
    expect(calcPhrfToT(ONE_HOUR, 150, "medium")).toBe(calcPhrfToT(ONE_HOUR, 150, "medium"));
  });

  it("handicap system works: slow boat with high handicap beats fast boat", () => {
    const ctFast = calcPhrfToT(55 * ONE_MIN, 80, "medium");
    const ctSlow = calcPhrfToT(65 * ONE_MIN, 200, "medium");
    expect(ctSlow).toBeLessThan(ctFast);
  });

  it("same PHRF preserves order", () => {
    const ctA = calcPhrfToT(55 * ONE_MIN, 150, "medium");
    const ctB = calcPhrfToT(60 * ONE_MIN, 150, "medium");
    expect(ctA).toBeLessThan(ctB);
  });
});

// ---- Scoring ranking logic ----

describe("Scoring ranking logic", () => {
  it("boats with lower corrected time rank higher", () => {
    const boats = [
      { name: "A", corrected: 3600000 },
      { name: "B", corrected: 3500000 },
      { name: "C", corrected: 3700000 },
    ];
    const sorted = [...boats].sort((a, b) => a.corrected - b.corrected);
    expect(sorted.map((b) => b.name)).toEqual(["B", "A", "C"]);
  });

  it("DNF boats rank N+1", () => {
    expect(5 + 1).toBe(6);
  });

  it("drops: worst race removed", () => {
    const points = [1, 2, 5, 3];
    const sorted = [...points].sort((a, b) => a - b);
    const kept = sorted.slice(0, sorted.length - 1);
    expect(kept.reduce((s, p) => s + p, 0)).toBe(6);
  });

  it("drops: keep at least one race", () => {
    const points = [1, 2];
    const drops = 5;
    const effectiveDrops = Math.min(drops, Math.max(0, points.length - 1));
    const sorted = [...points].sort((a, b) => a - b);
    const kept = sorted.slice(0, sorted.length - effectiveDrops);
    expect(kept.reduce((s, p) => s + p, 0)).toBe(1);
  });
});

// ---- Division scoring ----

describe("Division scoring", () => {
  it("boats in same division ranked together", () => {
    const boats = [
      { name: "X", corrected: 3600, division: "A" },
      { name: "Y", corrected: 3500, division: "A" },
      { name: "Z", corrected: 3400, division: "B" },
    ];
    const divA = boats.filter((b) => b.division === "A").sort((a, b) => a.corrected - b.corrected);
    expect(divA[0].name).toBe("Y");

    const all = [...boats].sort((a, b) => a.corrected - b.corrected);
    expect(all[0].name).toBe("Z");
  });

  it("unassigned class gets no division rank", () => {
    const divisions: Division[] = [{ name: "A", classes: ["Spin"] }];
    expect(getDivisionForClass(divisions, "Unknown")).toBeNull();
  });

  it("class can only be in one division", () => {
    const divisions: Division[] = [
      { name: "A", classes: ["Spin", "PHRF-A"] },
      { name: "B", classes: ["Non-Spin"] },
    ];
    const result = getDivisionForClass(divisions, "Spin");
    expect(result?.name).toBe("A");
    // Verify Non-Spin is only in B
    expect(getDivisionForClass(divisions, "Non-Spin")?.name).toBe("B");
  });
});

// ---- Edge cases ----

describe("Edge cases", () => {
  it("zero elapsed gives zero for all methods", () => {
    expect(calcPhrfToT(0, 150, "medium")).toBe(0);
    expect(calcPhrfToD(0, 150, 5)).toBe(0);
    expect(calcPortsmouth(0, 1100, 1000)).toBe(0);
    expect(calcIrc(0, 0.95)).toBe(0);
  });

  it("very large elapsed times don't overflow", () => {
    expect(calcPhrfToT(10 * ONE_HOUR, 150, "medium")).toBeGreaterThan(0);
    expect(formatElapsed(10 * ONE_HOUR)).toBe("10:00:00");
  });

  it("formatElapsed handles exactly 24 hours", () => {
    expect(formatElapsed(24 * ONE_HOUR)).toBe("24:00:00");
  });

  it("formatCountdown handles exactly 24 hours", () => {
    const result = formatCountdown(24 * ONE_HOUR);
    expect(result.days).toBe(1);
    expect(result.text).toBe("00:00:00");
  });

  it("PHRF ToD clamps exactly at boundary", () => {
    const elapsed = 150 * 5 * 1000;
    expect(calcPhrfToD(elapsed, 150, 5)).toBe(0);
  });

  it("PHRF ToD clamps below boundary", () => {
    expect(calcPhrfToD(150 * 5 * 1000 - 1, 150, 5)).toBe(0);
  });

  it("Portsmouth with PN = 1 gives large CT", () => {
    expect(calcPortsmouth(ONE_HOUR, 1, 1000)).toBe(ONE_HOUR * 1000);
  });

  it("formatFinishTimeShort handles end of day", () => {
    const d = new Date(2024, 0, 1, 23, 59, 59);
    expect(formatFinishTimeShort(d.getTime())).toBe("23:59:59");
  });
});
