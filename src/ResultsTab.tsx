import { useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useRaces } from "./RaceContext";
import type { Race, Boat } from "./RaceContext";
import type { RaceBoatEntry, StartInfo } from "./api";

// ---- Resizable split panel ----

function ResizableSplit({ left, right }: { left: ReactNode; right: ReactNode }) {
  const splitRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [fixedWidth, setFixedWidth] = useState<number | null>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const syncing = useRef(false);

  const getDefaultWidth = useCallback(() => {
    if (!splitRef.current) return 160;
    return Math.floor(splitRef.current.offsetWidth * 0.4);
  }, []);

  const onDragStart = useCallback((clientX: number) => {
    dragging.current = true;
    startX.current = clientX;
    startWidth.current = fixedWidth ?? getDefaultWidth();
    document.body.style.userSelect = "none";
  }, [fixedWidth, getDefaultWidth]);

  const onDragMove = useCallback((clientX: number) => {
    if (!dragging.current || !splitRef.current) return;
    const delta = clientX - startX.current;
    const totalWidth = splitRef.current.offsetWidth;
    const newWidth = Math.max(60, Math.min(totalWidth - 80, startWidth.current + delta));
    setFixedWidth(newWidth);
  }, []);

  const onDragEnd = useCallback(() => {
    dragging.current = false;
    document.body.style.userSelect = "";
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart(e.clientX);
    const onMove = (ev: MouseEvent) => onDragMove(ev.clientX);
    const onUp = () => { onDragEnd(); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onDragStart, onDragMove, onDragEnd]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    onDragStart(touch.clientX);
    const onMove = (ev: TouchEvent) => { ev.preventDefault(); onDragMove(ev.touches[0].clientX); };
    const onUp = () => { onDragEnd(); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }, [onDragStart, onDragMove, onDragEnd]);

  // Sync vertical scroll between left and right
  const syncScroll = useCallback((source: "left" | "right") => {
    if (syncing.current) return;
    syncing.current = true;
    const from = source === "left" ? leftRef.current : rightRef.current;
    const to = source === "left" ? rightRef.current : leftRef.current;
    if (from && to) to.scrollTop = from.scrollTop;
    syncing.current = false;
  }, []);

  const width = fixedWidth ?? getDefaultWidth();
  const isNarrow = width < 100;

  return (
    <div className="results-split" ref={splitRef}>
      <div
        ref={leftRef}
        className={`results-fixed ${isNarrow ? "results-fixed--narrow" : ""}`}
        style={{ width: `${width}px` }}
        onScroll={() => syncScroll("left")}
      >
        <div className="results-table">
          {left}
        </div>
      </div>
      <div
        className="results-drag-handle"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="results-drag-line" />
      </div>
      <div
        ref={rightRef}
        className="results-scroll"
        onScroll={() => syncScroll("right")}
      >
        <div className="results-table">
          {right}
        </div>
      </div>
    </div>
  );
}

// ---- Scoring types ----

type TimingMode = "absolute" | "corrected";
type CorrectionMethod = "phrf-tot" | "phrf-tod" | "portsmouth" | "irc";
type SeriesMethod = "points" | "total-time";
type WindCondition = "light" | "medium" | "heavy";

const PHRF_TOT_CONSTANTS: Record<WindCondition, { a: number; b: number }> = {
  light: { a: 650, b: 490 },
  medium: { a: 650, b: 550 },
  heavy: { a: 650, b: 610 },
};

interface ClassFactor {
  className: string;
  factor: number;
}

// Per-class course length per race: raceId -> className -> distance in nm
type ClassCourseLengths = Record<string, Record<string, number>>;

interface BoatResult {
  boatId: number;
  boatName: string;
  sailNumber: string;
  skipper: string;
  className: string;
  phrf: number | null;
  rating: number | string | null;
  elapsedMs: number | null;
  correctedMs: number | null;
  classRank: number | null;
  overallRank: number | null;
  status: string;
  lapsCompleted: number;
  totalLaps: number;
  lapTimes: number[];
  customFields: Record<string, string>;
}

interface RaceResults {
  raceId: number;
  raceName: string;
  boats: BoatResult[];
}

interface SeriesBoatResult {
  boatId: number;
  boatName: string;
  sailNumber: string;
  skipper: string;
  className: string;
  customFields: Record<string, string>;
  raceResults: Array<{
    raceId: number;
    classRank: number | null;
    overallRank: number | null;
    elapsedMs: number | null;
    correctedMs: number | null;
    dropped: boolean;
    status: string;
  }>;
  totalPoints: number | null;
  totalTimeMs: number | null;
  seriesClassRank: number | null;
  seriesOverallRank: number | null;
}

// ---- Calculation helpers ----

function getElapsedTime(
  boatEntry: RaceBoatEntry,
  starts: StartInfo[]
): number | null {
  if (boatEntry.finishTime == null) return null;
  const finishTime = boatEntry.finishTime as number;
  const start = starts.find((s) => s.classes.includes(boatEntry.class));
  if (!start || start.startTime == null) return null;
  const elapsed = finishTime - start.startTime;
  return elapsed > 0 ? elapsed : null;
}

function calcPhrfToT(elapsedMs: number, phrf: number, wind: WindCondition, customAB?: { a: number; b: number }): number {
  const { a, b } = customAB || PHRF_TOT_CONSTANTS[wind];
  return elapsedMs * (a / (b + phrf));
}

function getFleetAverageAB(raceBoats: RaceBoatEntry[], boats: Boat[], c: number): { a: number; b: number } {
  const ratings = raceBoats
    .map((rb) => {
      const boat = boats.find((b) => b.id === rb.boatId);
      return boat?.info.phrf != null ? Number(boat.info.phrf) : null;
    })
    .filter((r) => r != null) as number[];
  if (ratings.length === 0) return { a: c, b: c - 100 }; // fallback
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return { a: c, b: Math.round(c - avg) };
}

function calcPhrfToD(elapsedMs: number, phrf: number, distanceNm: number): number {
  // CT = ET - (PHRF × Distance) where PHRF is sec/nm and ET is in ms
  const correctionMs = phrf * distanceNm * 1000;
  return elapsedMs - correctionMs;
}

type PortsmouthBase = 100 | 1000;

function calcPortsmouth(elapsedMs: number, pn: number, base: PortsmouthBase): number {
  return elapsedMs * (base / pn);
}

function calcIrc(elapsedMs: number, tcc: number): number {
  return elapsedMs * tcc;
}

function formatElapsed(ms: number | null): string {
  if (ms == null) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function statusLabel(status: string): string {
  const upper = status.toUpperCase();
  if (["OCS", "DNF", "DNS", "DSQ"].includes(upper)) return upper;
  return "";
}

// ---- Calculate results for a single race ----

function calculateRaceResults(
  race: Race,
  boats: Boat[],
  timingMethod: string,
  classFactors: ClassFactor[],
  wind: WindCondition,
  classCourseLengths: Record<string, number>,
  portsmouthBase: PortsmouthBase,
  useFleetAvg: boolean
): RaceResults {
  const raceBoats = race.info.boats || [];
  const starts = race.info.starts || [];
  const classLaps = (race.info.classLaps || {}) as Record<string, number>;

  // Compute fleet average A/B if needed
  const fleetAB = useFleetAvg ? getFleetAverageAB(raceBoats, boats, 650) : undefined;

  const results: BoatResult[] = raceBoats.map((rb) => {
    const boat = boats.find((b) => b.id === rb.boatId);
    const phrf = boat?.info.phrf != null ? Number(boat.info.phrf) : null;
    const pn = boat?.info.portsmouthNumber != null ? Number(boat.info.portsmouthNumber) : null;
    const elapsedMs = getElapsedTime(rb, starts);
    const totalLaps = classLaps[rb.class] || 1;
    const lapsCompleted = (rb.lapsCompleted as number) || (rb.finishTime != null ? totalLaps : 0);
    const lapTimes = (rb.lapTimes as number[]) || [];

    // Apply class factor
    const factor = classFactors.find((cf) => cf.className === rb.class)?.factor ?? 1;
    const adjustedElapsed = elapsedMs != null ? elapsedMs * factor : null;

    let correctedMs: number | null = null;
    if (adjustedElapsed != null && timingMethod === "phrf-tot" && phrf != null) {
      correctedMs = calcPhrfToT(adjustedElapsed, phrf, wind, fleetAB);
    } else if (adjustedElapsed != null && timingMethod === "phrf-tod" && phrf != null) {
      const courseNm = classCourseLengths[rb.class] || 0;
      const totalDistance = courseNm * totalLaps;
      if (totalDistance > 0) {
        correctedMs = calcPhrfToD(adjustedElapsed, phrf, totalDistance);
      }
    } else if (adjustedElapsed != null && timingMethod === "portsmouth" && pn != null) {
      correctedMs = calcPortsmouth(adjustedElapsed, pn, portsmouthBase);
    } else if (adjustedElapsed != null && timingMethod === "irc") {
      const tcc = boat?.info.ircTcc != null ? Number(boat.info.ircTcc) : null;
      if (tcc != null) {
        correctedMs = calcIrc(adjustedElapsed, tcc);
      }
    } else if (adjustedElapsed != null && timingMethod === "absolute") {
      correctedMs = adjustedElapsed;
    }

    // Extract custom fields
    const coreKeys = new Set(["name", "sailNumber", "type", "skipper", "phrf", "portsmouthNumber", "ircTcc", "class"]);
    const cf: Record<string, string> = {};
    if (boat) {
      for (const [k, v] of Object.entries(boat.info)) {
        if (!coreKeys.has(k) && v != null) cf[k] = String(v);
      }
    }

    // Determine the rating value for the current method
    let rating: number | string | null = null;
    if (timingMethod === "phrf-tot" || timingMethod === "phrf-tod") rating = phrf;
    else if (timingMethod === "portsmouth") rating = pn;
    else if (timingMethod === "irc") rating = boat?.info.ircTcc != null ? Number(boat.info.ircTcc) : null;

    return {
      boatId: rb.boatId,
      boatName: boat?.name || `Boat #${rb.boatId}`,
      sailNumber: boat?.info.sailNumber || "",
      skipper: boat?.info.skipper || "",
      className: rb.class,
      phrf,
      rating,
      elapsedMs,
      correctedMs,
      classRank: null,
      overallRank: null,
      status: rb.status,
      lapsCompleted,
      totalLaps,
      lapTimes,
      customFields: cf,
    };
  });

  // Only rank boats that actually finished all laps
  const finished = results.filter((r) => r.correctedMs != null && r.lapsCompleted >= r.totalLaps);

  // Rank overall
  finished.sort((a, b) => a.correctedMs! - b.correctedMs!);
  finished.forEach((r, i) => { r.overallRank = i + 1; });

  // Rank by class
  const classes = Array.from(new Set(results.map((r) => r.className)));
  classes.forEach((cls) => {
    const classFinished = results.filter((r) => r.className === cls && r.correctedMs != null && r.lapsCompleted >= r.totalLaps);
    classFinished.sort((a, b) => a.correctedMs! - b.correctedMs!);
    classFinished.forEach((r, i) => { r.classRank = i + 1; });
  });

  // Penalty ranks for non-finishers
  const totalBoats = results.length;
  const classBoatCounts = new Map<string, number>();
  classes.forEach((cls) => {
    classBoatCounts.set(cls, results.filter((r) => r.className === cls).length);
  });

  results.forEach((r) => {
    if (r.overallRank == null) {
      const s = r.status.toUpperCase();
      if (["OCS", "DNF", "DNS", "DSQ", "FINISHED"].includes(s) || r.lapsCompleted < r.totalLaps) {
        r.overallRank = totalBoats + 1;
        r.classRank = (classBoatCounts.get(r.className) || 0) + 1;
      }
    }
  });

  return { raceId: race.id, raceName: race.name, boats: results };
}

// ---- Calculate series results ----

function calculateSeriesResults(
  seriesRaces: Race[],
  boats: Boat[],
  timingMethod: string,
  seriesMethod: SeriesMethod,
  drops: number,
  classFactors: ClassFactor[],
  raceWindMap: Record<number, WindCondition>,
  allClassCourseLengths: ClassCourseLengths,
  portsmouthBase: PortsmouthBase,
  dnfPenaltyFactor: number,
  useFleetAvg: boolean
): SeriesBoatResult[] {
  const allRaceResults = seriesRaces.map((race) =>
    calculateRaceResults(race, boats, timingMethod, classFactors, raceWindMap[race.id] || "medium", allClassCourseLengths[String(race.id)] || {}, portsmouthBase, useFleetAvg)
  );

  const boatIds = new Set<number>();
  allRaceResults.forEach((rr) => rr.boats.forEach((b) => boatIds.add(b.boatId)));

  // Pre-compute penalty values per race
  const racePenalties = allRaceResults.map((rr) => {
    const fleetSize = rr.boats.length;
    const penaltyRank = fleetSize + 1;
    const finishedTimes = rr.boats
      .map((b) => b.correctedMs)
      .filter((t) => t != null) as number[];
    const slowestTime = finishedTimes.length > 0 ? Math.max(...finishedTimes) : null;
    const penaltyTime = slowestTime != null ? Math.round(slowestTime * dnfPenaltyFactor) : null;
    return { raceId: rr.raceId, penaltyRank, penaltyTime };
  });

  const seriesResults: SeriesBoatResult[] = Array.from(boatIds).map((boatId) => {
    const boat = boats.find((b) => b.id === boatId);
    const firstResult = allRaceResults.flatMap((rr) => rr.boats).find((b) => b.boatId === boatId);

    const raceResults = allRaceResults.map((rr, raceIdx) => {
      const result = rr.boats.find((b) => b.boatId === boatId);
      const penalty = racePenalties[raceIdx];

      // If boat wasn't in this race or didn't finish, apply penalties
      const didFinish = result?.correctedMs != null;
      let overallRank = result?.overallRank ?? null;
      let correctedMs = result?.correctedMs ?? null;

      if (!didFinish) {
        // Points: fleet size + 1
        if (overallRank == null) overallRank = penalty.penaltyRank;
        // Time: 1.5× slowest finisher (if anyone finished)
        if (correctedMs == null && penalty.penaltyTime != null) correctedMs = penalty.penaltyTime;
      }

      return {
        raceId: rr.raceId,
        classRank: result?.classRank ?? null,
        overallRank,
        elapsedMs: result?.elapsedMs ?? null,
        correctedMs,
        dropped: false,
        status: result?.status ?? "DNS",
      };
    });

    if (drops > 0) {
      if (seriesMethod === "points") {
        const sortable = raceResults
          .map((r, i) => ({ index: i, rank: r.overallRank ?? Infinity }))
          .sort((a, b) => b.rank - a.rank);
        for (let d = 0; d < Math.min(drops, sortable.length); d++) {
          raceResults[sortable[d].index].dropped = true;
        }
      } else {
        const sortable = raceResults
          .map((r, i) => ({ index: i, time: r.correctedMs ?? Infinity }))
          .sort((a, b) => b.time - a.time);
        for (let d = 0; d < Math.min(drops, sortable.length); d++) {
          raceResults[sortable[d].index].dropped = true;
        }
      }
    }

    const counted = raceResults.filter((r) => !r.dropped);
    let totalPoints: number | null = null;
    let totalTimeMs: number | null = null;

    if (seriesMethod === "points") {
      const ranks = counted.map((r) => r.overallRank).filter((r) => r != null) as number[];
      totalPoints = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) : null;
    } else {
      const times = counted.map((r) => r.correctedMs).filter((t) => t != null) as number[];
      totalTimeMs = times.length > 0 ? times.reduce((a, b) => a + b, 0) : null;
    }

    return {
      boatId,
      boatName: boat?.name || firstResult?.boatName || `Boat #${boatId}`,
      sailNumber: boat?.info.sailNumber || firstResult?.sailNumber || "",
      skipper: boat?.info.skipper || firstResult?.skipper || "",
      className: firstResult?.className || "Default",
      customFields: firstResult?.customFields || {},
      raceResults,
      totalPoints,
      totalTimeMs,
      seriesClassRank: null,
      seriesOverallRank: null,
    };
  });

  // Rank series overall
  if (seriesMethod === "points") {
    const withPoints = seriesResults.filter((r) => r.totalPoints != null);
    withPoints.sort((a, b) => a.totalPoints! - b.totalPoints!);
    withPoints.forEach((r, i) => { r.seriesOverallRank = i + 1; });
  } else {
    const withTime = seriesResults.filter((r) => r.totalTimeMs != null);
    withTime.sort((a, b) => a.totalTimeMs! - b.totalTimeMs!);
    withTime.forEach((r, i) => { r.seriesOverallRank = i + 1; });
  }

  const classes = Array.from(new Set(seriesResults.map((r) => r.className)));
  classes.forEach((cls) => {
    const classBoats = seriesResults.filter((r) => r.className === cls);
    if (seriesMethod === "points") {
      const sorted = classBoats.filter((r) => r.totalPoints != null);
      sorted.sort((a, b) => a.totalPoints! - b.totalPoints!);
      sorted.forEach((r, i) => { r.seriesClassRank = i + 1; });
    } else {
      const sorted = classBoats.filter((r) => r.totalTimeMs != null);
      sorted.sort((a, b) => a.totalTimeMs! - b.totalTimeMs!);
      sorted.forEach((r, i) => { r.seriesClassRank = i + 1; });
    }
  });

  seriesResults.sort((a, b) => (a.seriesOverallRank ?? Infinity) - (b.seriesOverallRank ?? Infinity));
  return seriesResults;
}

// ---- CSV export ----

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Column definitions ----

type RaceColId = "elapsed" | "corrected" | "sailNum" | "class" | "skipper" | "rating" | "status";

interface ColDef {
  id: RaceColId;
  label: string;
  defaultOn: boolean;
}

function getRaceColumns(timingMethod: string): ColDef[] {
  const cols: ColDef[] = [
    { id: "sailNum", label: "Sail #", defaultOn: false },
    { id: "class", label: "Class", defaultOn: false },
    { id: "skipper", label: "Skipper", defaultOn: false },
    { id: "elapsed", label: "Elapsed", defaultOn: true },
    { id: "corrected", label: "Corrected", defaultOn: timingMethod !== "absolute" },
    { id: "status", label: "Status", defaultOn: false },
  ];

  if (timingMethod === "phrf-tot" || timingMethod === "phrf-tod") {
    cols.splice(5, 0, { id: "rating", label: "PHRF", defaultOn: false });
  } else if (timingMethod === "portsmouth") {
    cols.splice(5, 0, { id: "rating", label: "Portsmouth", defaultOn: false });
  } else if (timingMethod === "irc") {
    cols.splice(5, 0, { id: "rating", label: "IRC TCC", defaultOn: false });
  }
  // absolute: no rating column

  return cols;
}

function defaultVisibleCols(timingMethod: string): Set<RaceColId> {
  return new Set(getRaceColumns(timingMethod).filter((c) => c.defaultOn).map((c) => c.id));
}

// ---- Column toggle bar ----

function ColumnToggles({
  columns,
  visible,
  onToggle,
}: {
  columns: ColDef[];
  visible: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="results-col-toggles">
      {columns.map((col) => (
        <button
          key={col.id}
          className={`results-col-toggle ${visible.has(col.id) ? "results-col-toggle--on" : ""}`}
          onClick={() => onToggle(col.id)}
        >
          {col.label}
        </button>
      ))}
    </div>
  );
}

// ---- Race results view ----

function RaceResultsView({
  results,
  raceName,
  visibleCols,
  customCols,
  timingMethod,
  topN,
}: {
  results: RaceResults;
  raceName: string;
  visibleCols: Set<RaceColId>;
  customCols: string[];
  timingMethod: string;
  topN: number;
}) {
  const sorted = [...results.boats].sort(
    (a, b) => (a.overallRank ?? Infinity) - (b.overallRank ?? Infinity)
  );

  const show = (id: RaceColId) => visibleCols.has(id);

  return (
    <div className="results-table-wrap">
      <div className="results-table-header">
        <span className="results-table-title">{raceName}</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => downloadCSV(exportRaceCSVWithSummary(results, topN), `${raceName}_results.csv`)}
        >
          Export
        </button>
      </div>
      <ResizableSplit
        left={
          <>
          <div className="results-row results-row--header results-row--sticky">
            <span className="results-cell results-cell--name">Boat</span>
            <span className="results-cell results-cell--rank">#</span>
            <span className="results-cell results-cell--cls-rank">Cls</span>
          </div>
          {sorted.map((r) => {
            const st = statusLabel(r.status);
            return (
              <div key={r.boatId} className={`results-row ${r.overallRank === 1 ? "results-row--first" : ""}`}>
                <span className="results-cell results-cell--name">
                  <span>{r.boatName}</span>
                  {st && <span className="results-status-badge">{st}</span>}
                </span>
                <span className="results-cell results-cell--rank">{r.overallRank ?? "—"}</span>
                <span className="results-cell results-cell--cls-rank">{r.classRank ?? "—"}</span>
              </div>
            );
          })}
          </>
        }
        right={
          <>
          <div className="results-row results-row--header results-row--sticky">
            {show("sailNum") && <span className="results-cell results-cell--data">Sail #</span>}
            {show("class") && <span className="results-cell results-cell--data">Class</span>}
            {show("skipper") && <span className="results-cell results-cell--data">Skipper</span>}
            {show("elapsed") && <span className="results-cell results-cell--data">Elapsed</span>}
            {show("corrected") && <span className="results-cell results-cell--data">Corrected</span>}
            {show("rating") && <span className="results-cell results-cell--data">
              {timingMethod.startsWith("phrf") ? "PHRF" : timingMethod === "portsmouth" ? "PN" : timingMethod === "irc" ? "TCC" : "Rating"}
            </span>}
            {show("status") && <span className="results-cell results-cell--data">Status</span>}
            {customCols.map((col) => (
              <span key={col} className="results-cell results-cell--data">{col}</span>
            ))}
          </div>
          {sorted.map((r) => (
            <div key={r.boatId} className={`results-row ${r.overallRank === 1 ? "results-row--first" : ""}`}>
              {show("sailNum") && <span className="results-cell results-cell--data">{r.sailNumber || "—"}</span>}
              {show("class") && <span className="results-cell results-cell--data">{r.className}</span>}
              {show("skipper") && <span className="results-cell results-cell--data">{r.skipper || "—"}</span>}
              {show("elapsed") && <span className="results-cell results-cell--data results-cell--mono">{formatElapsed(r.elapsedMs)}</span>}
              {show("corrected") && <span className="results-cell results-cell--data results-cell--mono">{formatElapsed(r.correctedMs)}</span>}
              {show("rating") && <span className="results-cell results-cell--data">{r.rating ?? "—"}</span>}
              {show("status") && <span className="results-cell results-cell--data">{statusLabel(r.status) || "—"}</span>}
              {customCols.map((col) => (
                <span key={col} className="results-cell results-cell--data">{r.customFields[col] || "—"}</span>
              ))}
            </div>
          ))}
          </>
        }
      />
    </div>
  );
}

// ---- Series results view ----

function SeriesResultsView({
  results, races, seriesName, seriesMethod, visibleCols, customCols, timingMethod, topN,
}: {
  results: SeriesBoatResult[];
  races: Race[];
  seriesName: string;
  seriesMethod: SeriesMethod;
  visibleCols: Set<RaceColId>;
  customCols: string[];
  timingMethod: string;
  topN: number;
}) {
  const show = (id: RaceColId) => visibleCols.has(id);

  return (
    <div className="results-table-wrap">
      <div className="results-table-header">
        <span className="results-table-title">{seriesName} — Series</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => downloadCSV(exportSeriesCSVWithSummary(results, races, seriesMethod, topN), `${seriesName}_series.csv`)}
        >
          Export
        </button>
      </div>
      <ResizableSplit
        left={
          <>
          <div className="results-row results-row--header results-row--sticky">
            <span className="results-cell results-cell--name">Boat</span>
            <span className="results-cell results-cell--rank">#</span>
            <span className="results-cell results-cell--cls-rank">Cls</span>
          </div>
          {results.map((r) => (
            <div key={r.boatId} className={`results-row ${r.seriesOverallRank === 1 ? "results-row--first" : ""}`}>
              <span className="results-cell results-cell--name">
                <span>{r.boatName}</span>
              </span>
              <span className="results-cell results-cell--rank">{r.seriesOverallRank ?? "—"}</span>
              <span className="results-cell results-cell--cls-rank">{r.seriesClassRank ?? "—"}</span>
            </div>
          ))}
          </>
        }
        right={
          <>
          <div className="results-row results-row--header results-row--sticky">
            {show("sailNum") && <span className="results-cell results-cell--data">Sail #</span>}
            {show("class") && <span className="results-cell results-cell--data">Class</span>}
            {show("skipper") && <span className="results-cell results-cell--data">Skipper</span>}
            {customCols.map((col) => (
              <span key={col} className="results-cell results-cell--data">{col}</span>
            ))}
            <span className="results-cell results-cell--data">Total</span>
            {races.map((race) => {
              const label = race.name.length > 10 ? race.name.slice(0, 10) + "…" : race.name;
              return (
                <span key={race.id} className="results-cell results-cell--data">{label}</span>
              );
            })}
            {show("elapsed") && races.map((race) => (
              <span key={`el-${race.id}`} className="results-cell results-cell--data">
                {(race.name.length > 6 ? race.name.slice(0, 6) + "…" : race.name) + " ET"}
              </span>
            ))}
            {show("corrected") && races.map((race) => (
              <span key={`ct-${race.id}`} className="results-cell results-cell--data">
                {(race.name.length > 6 ? race.name.slice(0, 6) + "…" : race.name) + " CT"}
              </span>
            ))}
          </div>
          {results.map((r) => (
            <div key={r.boatId} className={`results-row ${r.seriesOverallRank === 1 ? "results-row--first" : ""}`}>
              {show("sailNum") && <span className="results-cell results-cell--data">{r.sailNumber || "—"}</span>}
              {show("class") && <span className="results-cell results-cell--data">{r.className}</span>}
              {show("skipper") && <span className="results-cell results-cell--data">{r.skipper || "—"}</span>}
              {customCols.map((col) => (
                <span key={col} className="results-cell results-cell--data">{r.customFields[col] || "—"}</span>
              ))}
              <span className="results-cell results-cell--data results-cell--mono">
                {seriesMethod === "points"
                  ? (r.totalPoints != null ? `${r.totalPoints} pts` : "—")
                  : formatElapsed(r.totalTimeMs)
                }
              </span>
              {r.raceResults.map((rr) => (
                <span
                  key={rr.raceId}
                  className={`results-cell results-cell--data results-cell--mono ${rr.dropped ? "results-cell--dropped" : ""}`}
                >
                  {rr.overallRank ?? "—"}
                </span>
              ))}
              {show("elapsed") && r.raceResults.map((rr) => (
                <span key={`el-${rr.raceId}`} className={`results-cell results-cell--data results-cell--mono ${rr.dropped ? "results-cell--dropped" : ""}`}>
                  {formatElapsed(rr.elapsedMs)}
                </span>
              ))}
              {show("corrected") && r.raceResults.map((rr) => (
                <span key={`ct-${rr.raceId}`} className={`results-cell results-cell--data results-cell--mono ${rr.dropped ? "results-cell--dropped" : ""}`}>
                  {formatElapsed(rr.correctedMs)}
                </span>
              ))}
            </div>
          ))}
          </>
        }
      />
    </div>
  );
}

// ---- PHRF warning ----

function PhrfWarning({ raceBoats, boats }: { raceBoats: RaceBoatEntry[]; boats: Boat[] }) {
  const missing = raceBoats.filter((rb) => {
    const boat = boats.find((b) => b.id === rb.boatId);
    return boat?.info.phrf == null;
  });
  if (missing.length === 0) return null;
  return (
    <div className="results-warning">
      <span className="results-warning-icon">⚠</span>
      <span>
        {missing.length} boat{missing.length !== 1 ? "s" : ""} missing PHRF rating.
        Add ratings in the Series tab.
      </span>
    </div>
  );
}

function PortsmouthWarning({ raceBoats, boats }: { raceBoats: RaceBoatEntry[]; boats: Boat[] }) {
  const missing = raceBoats.filter((rb) => {
    const boat = boats.find((b) => b.id === rb.boatId);
    return boat?.info.portsmouthNumber == null;
  });
  if (missing.length === 0) return null;
  return (
    <div className="results-warning">
      <span className="results-warning-icon">⚠</span>
      <span>
        {missing.length} boat{missing.length !== 1 ? "s" : ""} missing Portsmouth number.
        Add ratings in the Series tab.
      </span>
    </div>
  );
}

function IrcWarning({ raceBoats, boats }: { raceBoats: RaceBoatEntry[]; boats: Boat[] }) {
  const missing = raceBoats.filter((rb) => {
    const boat = boats.find((b) => b.id === rb.boatId);
    return boat?.info.ircTcc == null;
  });
  if (missing.length === 0) return null;
  return (
    <div className="results-warning">
      <span className="results-warning-icon">⚠</span>
      <span>
        {missing.length} boat{missing.length !== 1 ? "s" : ""} missing IRC TCC rating.
        Add ratings in the Series tab.
      </span>
    </div>
  );
}

// ---- Summary views ----

function RaceSummary({ results, topN }: { results: RaceResults; topN: number }) {
  const sorted = [...results.boats].sort(
    (a, b) => (a.overallRank ?? Infinity) - (b.overallRank ?? Infinity)
  );
  const topOverall = sorted.filter((r) => r.overallRank != null && r.overallRank <= topN);

  const classes = Array.from(new Set(results.boats.map((r) => r.className)));
  const topByClass = classes.map((cls) => {
    const classBoats = results.boats
      .filter((r) => r.className === cls && r.classRank != null && r.classRank <= topN)
      .sort((a, b) => a.classRank! - b.classRank!);
    return { className: cls, boats: classBoats };
  });

  return (
    <div className="results-summary">
      <div className="results-summary-section">
        <div className="results-summary-heading">Top {topN} Overall</div>
        {topOverall.length === 0 && <p className="races-empty">No finishers yet</p>}
        {topOverall.map((r) => (
          <div key={r.boatId} className="results-summary-row">
            <span className="results-summary-rank">{r.overallRank}</span>
            <span className="results-summary-name">{r.boatName}</span>
            <span className="results-summary-detail">{r.className}</span>
            <span className="results-summary-time">{formatElapsed(r.correctedMs)}</span>
          </div>
        ))}
      </div>

      {topByClass.map(({ className, boats }) => (
        <div key={className} className="results-summary-section">
          <div className="results-summary-heading">Top {topN} — {className}</div>
          {boats.length === 0 && <p className="races-empty">No finishers yet</p>}
          {boats.map((r) => (
            <div key={r.boatId} className="results-summary-row">
              <span className="results-summary-rank">{r.classRank}</span>
              <span className="results-summary-name">{r.boatName}</span>
              <span className="results-summary-time">{formatElapsed(r.correctedMs)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SeriesSummary({
  results,
  topN,
  seriesMethod,
}: {
  results: SeriesBoatResult[];
  topN: number;
  seriesMethod: SeriesMethod;
}) {
  const topOverall = results.filter((r) => r.seriesOverallRank != null && r.seriesOverallRank <= topN);

  const classes = Array.from(new Set(results.map((r) => r.className)));
  const topByClass = classes.map((cls) => {
    const classBoats = results
      .filter((r) => r.className === cls && r.seriesClassRank != null && r.seriesClassRank <= topN)
      .sort((a, b) => a.seriesClassRank! - b.seriesClassRank!);
    return { className: cls, boats: classBoats };
  });

  const formatTotal = (r: SeriesBoatResult) => {
    if (seriesMethod === "points") return r.totalPoints != null ? `${r.totalPoints} pts` : "—";
    return formatElapsed(r.totalTimeMs);
  };

  return (
    <div className="results-summary">
      <div className="results-summary-section">
        <div className="results-summary-heading">Top {topN} Overall</div>
        {topOverall.length === 0 && <p className="races-empty">No results yet</p>}
        {topOverall.map((r) => (
          <div key={r.boatId} className="results-summary-row">
            <span className="results-summary-rank">{r.seriesOverallRank}</span>
            <span className="results-summary-name">{r.boatName}</span>
            <span className="results-summary-detail">{r.className}</span>
            <span className="results-summary-time">{formatTotal(r)}</span>
          </div>
        ))}
      </div>

      {topByClass.map(({ className, boats }) => (
        <div key={className} className="results-summary-section">
          <div className="results-summary-heading">Top {topN} — {className}</div>
          {boats.length === 0 && <p className="races-empty">No results yet</p>}
          {boats.map((r) => (
            <div key={r.boatId} className="results-summary-row">
              <span className="results-summary-rank">{r.seriesClassRank}</span>
              <span className="results-summary-name">{r.boatName}</span>
              <span className="results-summary-time">{formatTotal(r)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- CSV with summary ----

function buildSummaryCSV(
  results: BoatResult[],
  topN: number,
  label: string,
  rankField: "overallRank" | "classRank"
): string[] {
  const lines: string[] = [];
  const top = results
    .filter((r) => r[rankField] != null && r[rankField]! <= topN)
    .sort((a, b) => a[rankField]! - b[rankField]!);
  lines.push(`\n${label}`);
  lines.push("Rank,Boat,Class,Corrected Time");
  top.forEach((r) => {
    lines.push(`${r[rankField]},${r.boatName},${r.className},${formatElapsed(r.correctedMs)}`);
  });
  return lines;
}

function exportRaceCSVWithSummary(results: RaceResults, topN: number): string {
  // Summary
  const lines: string[] = [`${results.raceName} — Summary`];
  const sorted = [...results.boats].sort((a, b) => (a.overallRank ?? Infinity) - (b.overallRank ?? Infinity));

  lines.push(...buildSummaryCSV(sorted, topN, `Top ${topN} Overall`, "overallRank"));

  const classes = Array.from(new Set(results.boats.map((r) => r.className)));
  classes.forEach((cls) => {
    const classBoats = results.boats.filter((r) => r.className === cls);
    lines.push(...buildSummaryCSV(classBoats, topN, `Top ${topN} — ${cls}`, "classRank"));
  });

  // Full results
  lines.push("");
  lines.push("Full Results");
  lines.push("Overall Rank,Class Rank,Boat,Sail #,Skipper,Class,Rating,Elapsed,Corrected,Status");
  sorted.forEach((r) => {
    lines.push([
      r.overallRank ?? "—",
      r.classRank ?? "—",
      r.boatName,
      r.sailNumber,
      r.skipper,
      r.className,
      r.rating ?? "—",
      formatElapsed(r.elapsedMs),
      formatElapsed(r.correctedMs),
      statusLabel(r.status),
    ].join(","));
  });

  return lines.join("\n");
}

function exportSeriesCSVWithSummary(
  results: SeriesBoatResult[],
  races: Race[],
  seriesMethod: SeriesMethod,
  topN: number
): string {
  const lines: string[] = ["Series Summary"];

  const formatTotal = (r: SeriesBoatResult) => {
    if (seriesMethod === "points") return r.totalPoints != null ? `${r.totalPoints} pts` : "—";
    return formatElapsed(r.totalTimeMs);
  };

  // Top N overall
  const topOverall = results.filter((r) => r.seriesOverallRank != null && r.seriesOverallRank <= topN);
  lines.push(`\nTop ${topN} Overall`);
  lines.push("Rank,Boat,Class,Total");
  topOverall.forEach((r) => {
    lines.push(`${r.seriesOverallRank},${r.boatName},${r.className},${formatTotal(r)}`);
  });

  // Top N per class
  const classes = Array.from(new Set(results.map((r) => r.className)));
  classes.forEach((cls) => {
    const classBoats = results
      .filter((r) => r.className === cls && r.seriesClassRank != null && r.seriesClassRank <= topN)
      .sort((a, b) => a.seriesClassRank! - b.seriesClassRank!);
    lines.push(`\nTop ${topN} — ${cls}`);
    lines.push("Rank,Boat,Total");
    classBoats.forEach((r) => {
      lines.push(`${r.seriesClassRank},${r.boatName},${formatTotal(r)}`);
    });
  });

  // Full results
  lines.push("");
  lines.push("Full Results");
  const raceHeaders = races.map((r) => `${r.name} Rank`).join(",");
  lines.push(`Series Rank,Class Rank,Boat,Sail #,Class,Total,${raceHeaders}`);
  results.forEach((r) => {
    const raceRanks = r.raceResults.map((rr) => {
      const rank = rr.overallRank ?? "—";
      return rr.dropped ? `(${rank})` : String(rank);
    }).join(",");
    lines.push([
      r.seriesOverallRank ?? "—",
      r.seriesClassRank ?? "—",
      r.boatName,
      r.sailNumber,
      r.className,
      formatTotal(r),
      raceRanks,
    ].join(","));
  });

  return lines.join("\n");
}

// ---- Main ResultsTab ----

export default function ResultsTab() {
  const { selectedRace, races, series, boats, updateSeriesData, updateRaceData } = useRaces();
  const [viewMode, setViewMode] = useState<"race" | "series">("race");
  const [timingMode, setTimingMode] = useState<TimingMode>("absolute");
  const [correctionMethod, setCorrectionMethod] = useState<CorrectionMethod>("phrf-tot");
  const [portsmouthBase, setPortsmouthBase] = useState<PortsmouthBase>(1000);
  const [useFleetAverage, setUseFleetAverage] = useState(false);
  const [seriesMethod, setSeriesMethod] = useState<SeriesMethod>("points");
  const [drops, setDrops] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [classFactors, setClassFactors] = useState<ClassFactor[]>([]);
  const [visibleCols, setVisibleCols] = useState<Set<RaceColId>>(() => defaultVisibleCols("phrf-tot"));
  const [customCols, setCustomCols] = useState<string[]>([]);
  const [newCustomCol, setNewCustomCol] = useState("");
  const [topN, setTopN] = useState(3);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [windPerRaceOpen, setWindPerRaceOpen] = useState(false);
  const [raceWindConditions, setRaceWindConditions] = useState<Record<number, WindCondition>>({});
  const [classCourseLengths, setClassCourseLengths] = useState<ClassCourseLengths>({});

  const getWindCondition = (raceId: number): WindCondition => {
    if (raceWindConditions[raceId]) return raceWindConditions[raceId];
    const race = races.find((r) => r.id === raceId);
    const stored = race?.info.windCondition as string | undefined;
    if (stored === "light" || stored === "medium" || stored === "heavy") return stored;
    return "medium";
  };
  const setWindForRace = (raceId: number, wind: WindCondition) => {
    setRaceWindConditions((prev) => ({ ...prev, [raceId]: wind }));
    // Also persist to race record
    const race = races.find((r) => r.id === raceId);
    if (race) {
      updateRaceData(raceId, race.name, { ...race.info, windCondition: wind });
    }
  };

  const getClassCourseLength = (raceId: number, cls: string): number => {
    const override = classCourseLengths[String(raceId)]?.[cls];
    if (override != null) return override;
    // Fall back to race's stored course length
    const race = races.find((r) => r.id === raceId);
    return race?.info.courseLength != null ? Number(race.info.courseLength) : 0;
  };
  const setClassCourseLength = (raceId: number, cls: string, nm: number) => {
    setClassCourseLengths((prev) => ({
      ...prev,
      [String(raceId)]: { ...(prev[String(raceId)] || {}), [cls]: nm },
    }));
  };

  const toggleCol = (id: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id as RaceColId)) next.delete(id as RaceColId);
      else next.add(id as RaceColId);
      return next;
    });
  };

  if (!selectedRace) {
    return (
      <div className="tab-placeholder">
        <p>Select a race in the Series tab</p>
      </div>
    );
  }

  const raceBoats = selectedRace.info.boats || [];
  const allClasses = Array.from(new Set(raceBoats.map((b) => b.class)));

  // Ensure classFactors has entries for all classes
  const effectiveFactors = allClasses.map((cls) => {
    const existing = classFactors.find((cf) => cf.className === cls);
    return existing || { className: cls, factor: 1 };
  });

  const updateFactor = (cls: string, factor: number) => {
    setClassFactors((prev) => {
      const existing = prev.find((cf) => cf.className === cls);
      if (existing) {
        return prev.map((cf) => cf.className === cls ? { ...cf, factor } : cf);
      }
      return [...prev, { className: cls, factor }];
    });
  };

  const parentSeries = series.find((s) =>
    s.info.raceIds.includes(selectedRace.id)
  );
  const seriesRaces = parentSeries
    ? parentSeries.info.raceIds
        .map((id) => races.find((r) => r.id === id))
        .filter(Boolean) as Race[]
    : [selectedRace];

  const dnfPenaltyFactor = (parentSeries?.info as any)?.dnfPenaltyFactor ?? 1.5;
  const setDnfPenaltyFactor = (factor: number) => {
    if (!parentSeries) return;
    updateSeriesData(parentSeries.id, parentSeries.name, {
      ...parentSeries.info,
      dnfPenaltyFactor: factor,
    });
  };

  // Derive effective timing method for calculations
  const timingMethod = timingMode === "absolute" ? "absolute" : correctionMethod;

  // Build effective class course lengths for current race
  const currentRaceCourseLengths: Record<string, number> = {};
  allClasses.forEach((cls) => {
    currentRaceCourseLengths[cls] = getClassCourseLength(selectedRace.id, cls);
  });

  const raceResults = calculateRaceResults(selectedRace, boats, timingMethod, effectiveFactors, getWindCondition(selectedRace.id), currentRaceCourseLengths, portsmouthBase, useFleetAverage);

  // Build course lengths for all series races
  const allSeriesCourseLengths: ClassCourseLengths = {};
  seriesRaces.forEach((race) => {
    const raceClasses = Array.from(new Set((race.info.boats || []).map((b) => b.class)));
    const lengths: Record<string, number> = {};
    raceClasses.forEach((cls) => {
      lengths[cls] = getClassCourseLength(race.id, cls);
    });
    allSeriesCourseLengths[String(race.id)] = lengths;
  });

  const seriesResults = parentSeries && seriesRaces.length > 1
    ? calculateSeriesResults(seriesRaces, boats, timingMethod, seriesMethod, drops, effectiveFactors, raceWindConditions, allSeriesCourseLengths, portsmouthBase, dnfPenaltyFactor, useFleetAverage)
    : null;

  const hasMultipleRaces = parentSeries && seriesRaces.length > 1;

  return (
    <div className="results-tab">
      {/* View toggle - always visible */}
      {hasMultipleRaces && (
        <div className="start-mode-toggle">
          <button
            className={`start-mode-btn ${viewMode === "race" ? "start-mode-btn--active" : ""}`}
            onClick={() => setViewMode("race")}
          >
            This Race
          </button>
          <button
            className={`start-mode-btn ${viewMode === "series" ? "start-mode-btn--active" : ""}`}
            onClick={() => setViewMode("series")}
          >
            Series
          </button>
        </div>
      )}

      {/* Collapsible settings */}
      <div className="results-settings">
        <button className="results-settings-header" onClick={() => setSettingsOpen(!settingsOpen)}>
          <span className="results-settings-title">Scoring Settings</span>
          <span className={`race-card-chevron ${settingsOpen ? "race-card-chevron--open" : ""}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        </button>

        {settingsOpen && (
          <div className="results-settings-body">
            <div className="results-config-section">
              <div className="start-classes-label">Timing:</div>
              <div className="start-mode-toggle">
                <button
                  className={`start-mode-btn ${timingMode === "absolute" ? "start-mode-btn--active" : ""}`}
                  onClick={() => setTimingMode("absolute")}
                >
                  Absolute Time
                </button>
                <button
                  className={`start-mode-btn ${timingMode === "corrected" ? "start-mode-btn--active" : ""}`}
                  onClick={() => setTimingMode("corrected")}
                >
                  Corrected Time
                </button>
              </div>
            </div>

            {timingMode === "corrected" && (
              <>
                <div className="results-config-section">
                  <div className="start-classes-label">Correction method:</div>
                  <div className="results-method-select">
                    <button
                      className={`results-method-option ${correctionMethod === "phrf-tot" ? "results-method-option--active" : ""}`}
                      onClick={() => setCorrectionMethod("phrf-tot")}
                    >
                      PHRF Time-on-Time
                    </button>
                    <button
                      className={`results-method-option ${correctionMethod === "phrf-tod" ? "results-method-option--active" : ""}`}
                      onClick={() => setCorrectionMethod("phrf-tod")}
                    >
                      PHRF Time-on-Distance
                    </button>
                    <button
                      className={`results-method-option ${correctionMethod === "portsmouth" ? "results-method-option--active" : ""}`}
                      onClick={() => setCorrectionMethod("portsmouth")}
                    >
                      Portsmouth Yardstick
                    </button>
                    <button
                      className={`results-method-option ${correctionMethod === "irc" ? "results-method-option--active" : ""}`}
                      onClick={() => setCorrectionMethod("irc")}
                    >
                      IRC
                    </button>
                  </div>
                </div>

                {/* PHRF Time-on-Time settings */}
                {correctionMethod === "phrf-tot" && (
                  <>
                    <div className="results-config-section">
                      <label className="races-checkbox">
                        <input
                          type="checkbox"
                          checked={useFleetAverage}
                          onChange={(e) => setUseFleetAverage(e.target.checked)}
                        />
                        <span>Use fleet average for B constant</span>
                      </label>
                    </div>

                    {useFleetAverage ? (
                      <div className="results-fleet-avg-info">
                        Fleet avg PHRF: {(() => {
                          const ratings = raceBoats
                            .map((rb) => {
                              const boat = boats.find((b) => b.id === rb.boatId);
                              return boat?.info.phrf != null ? Number(boat.info.phrf) : null;
                            })
                            .filter((r) => r != null) as number[];
                          if (ratings.length === 0) return "—";
                          const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
                          return `${avg.toFixed(0)} → B = ${Math.round(650 - avg)}`;
                        })()}
                      </div>
                    ) : (
                      <>
                        {viewMode === "race" && (
                      <div className="results-config-section">
                        <div className="start-classes-label">Wind conditions:</div>
                        <div className="start-mode-toggle start-mode-toggle--3">
                          {(["light", "medium", "heavy"] as WindCondition[]).map((w) => (
                            <button
                              key={w}
                              className={`start-mode-btn ${getWindCondition(selectedRace.id) === w ? "start-mode-btn--active" : ""}`}
                              onClick={() => setWindForRace(selectedRace.id, w)}
                            >
                              {w.charAt(0).toUpperCase() + w.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewMode === "series" && hasMultipleRaces && (
                      <div className="results-config-section">
                        <button className="results-wind-toggle" onClick={() => setWindPerRaceOpen(!windPerRaceOpen)}>
                          <span className="start-classes-label">Wind conditions per race</span>
                          <span className={`race-card-chevron ${windPerRaceOpen ? "race-card-chevron--open" : ""}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 6 15 12 9 18" />
                            </svg>
                          </span>
                        </button>
                        {windPerRaceOpen && seriesRaces.map((race) => (
                          <div key={race.id} className="results-wind-race-row">
                            <span className="results-wind-race-name">{race.name}</span>
                            <div className="start-mode-toggle start-mode-toggle--3 start-mode-toggle--sm">
                              {(["light", "medium", "heavy"] as WindCondition[]).map((w) => (
                                <button
                                  key={w}
                                  className={`start-mode-btn ${getWindCondition(race.id) === w ? "start-mode-btn--active" : ""}`}
                                  onClick={() => setWindForRace(race.id, w)}
                                >
                                  {w.charAt(0).toUpperCase() + w.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    </>
                    )}
                    <PhrfWarning raceBoats={raceBoats} boats={boats} />
                  </>
                )}

                {/* PHRF Time-on-Distance settings */}
                {correctionMethod === "phrf-tod" && (
                  <>
                    {viewMode === "race" && (
                      <div className="results-config-section">
                        <div className="start-classes-label">Course length per class (nm):</div>
                        {allClasses.map((cls) => {
                          const classLaps = (selectedRace.info.classLaps || {}) as Record<string, number>;
                          const laps = classLaps[cls] || 1;
                          const courseNm = getClassCourseLength(selectedRace.id, cls);
                          const totalDist = courseNm * laps;
                          return (
                            <div key={cls} className="results-wind-race-row">
                              <span className="results-wind-race-name">{cls}</span>
                              <input
                                className="login-input results-course-input"
                                placeholder=""
                                inputMode="decimal"
                                value={courseNm || ""}
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  setClassCourseLength(selectedRace.id, cls, val ? Number(val) : 0);
                                }}
                              />
                              <span className="results-course-unit">nm</span>
                              {laps > 1 && (
                                <span className="results-course-total">×{laps} = {totalDist.toFixed(1)} nm</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {viewMode === "series" && hasMultipleRaces && (
                      <div className="results-config-section">
                        <button className="results-wind-toggle" onClick={() => setWindPerRaceOpen(!windPerRaceOpen)}>
                          <span className="start-classes-label">Course lengths per race</span>
                          <span className={`race-card-chevron ${windPerRaceOpen ? "race-card-chevron--open" : ""}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 6 15 12 9 18" />
                            </svg>
                          </span>
                        </button>
                        {windPerRaceOpen && seriesRaces.map((race) => {
                          const raceClasses = Array.from(new Set((race.info.boats || []).map((b) => b.class)));
                          const classLaps = (race.info.classLaps || {}) as Record<string, number>;
                          return (
                            <div key={race.id} className="results-tod-race-group">
                              <div className="results-tod-race-label">{race.name}</div>
                              {raceClasses.map((cls) => {
                                const laps = classLaps[cls] || 1;
                                const courseNm = getClassCourseLength(race.id, cls);
                                const totalDist = courseNm * laps;
                                return (
                                  <div key={cls} className="results-wind-race-row">
                                    <span className="results-wind-race-name">{cls}</span>
                                    <input
                                      className="login-input results-course-input"
                                      placeholder=""
                                      inputMode="decimal"
                                      value={courseNm || ""}
                                      onChange={(e) => {
                                        const val = e.target.value.trim();
                                        setClassCourseLength(race.id, cls, val ? Number(val) : 0);
                                      }}
                                    />
                                    <span className="results-course-unit">nm</span>
                                    {laps > 1 && (
                                      <span className="results-course-total">×{laps} = {totalDist.toFixed(1)} nm</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <PhrfWarning raceBoats={raceBoats} boats={boats} />
                  </>
                )}

                {/* Portsmouth settings */}
                {correctionMethod === "portsmouth" && (
                  <>
                    <div className="results-config-section">
                      <div className="start-classes-label">Reference number:</div>
                      <div className="start-mode-toggle">
                        <button
                          className={`start-mode-btn ${portsmouthBase === 1000 ? "start-mode-btn--active" : ""}`}
                          onClick={() => setPortsmouthBase(1000)}
                        >
                          1000
                        </button>
                        <button
                          className={`start-mode-btn ${portsmouthBase === 100 ? "start-mode-btn--active" : ""}`}
                          onClick={() => setPortsmouthBase(100)}
                        >
                          100
                        </button>
                      </div>
                    </div>
                    <PortsmouthWarning raceBoats={raceBoats} boats={boats} />
                  </>
                )}

                {/* IRC settings */}
                {correctionMethod === "irc" && (
                  <IrcWarning raceBoats={raceBoats} boats={boats} />
                )}
              </>
            )}

            {hasMultipleRaces && viewMode === "series" && (
              <>
                <div className="results-config-section">
                  <div className="start-classes-label">Series scoring:</div>
                  <div className="start-mode-toggle">
                    <button
                      className={`start-mode-btn ${seriesMethod === "points" ? "start-mode-btn--active" : ""}`}
                      onClick={() => setSeriesMethod("points")}
                    >
                      Points
                    </button>
                    <button
                      className={`start-mode-btn ${seriesMethod === "total-time" ? "start-mode-btn--active" : ""}`}
                      onClick={() => setSeriesMethod("total-time")}
                    >
                      Total Time
                    </button>
                  </div>
                </div>

                <div className="results-config-section">
                  <div className="start-classes-label">
                    Drop worst {drops} race{drops !== 1 ? "s" : ""}:
                  </div>
                  <div className="results-drops">
                    <button
                      className="staged-time-adj"
                      onClick={() => setDrops(Math.max(0, drops - 1))}
                    >
                      −
                    </button>
                    <span className="results-drops-value">{drops}</span>
                    <button
                      className="staged-time-adj"
                      onClick={() => setDrops(Math.min(drops + 1, seriesRaces.length - 1))}
                    >
                      +
                    </button>
                  </div>
                </div>

                {seriesMethod === "total-time" && (
                  <div className="results-config-section">
                    <div className="start-classes-label">
                      DNF penalty: {dnfPenaltyFactor.toFixed(1)}× slowest finisher
                    </div>
                    <div className="results-drops">
                      <button
                        className="staged-time-adj"
                        onClick={() => setDnfPenaltyFactor(Math.max(1, Math.round((dnfPenaltyFactor - 0.1) * 10) / 10))}
                      >
                        −
                      </button>
                      <span className="results-drops-value">{dnfPenaltyFactor.toFixed(1)}</span>
                      <button
                        className="staged-time-adj"
                        onClick={() => setDnfPenaltyFactor(Math.round((dnfPenaltyFactor + 0.1) * 10) / 10)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {allClasses.length > 0 && (
              <div className="results-config-section">
                <div className="start-classes-label">Class time factors:</div>
                <div className="results-factors">
                  {effectiveFactors.map((cf) => (
                    <div key={cf.className} className="results-factor-row">
                      <span className="results-factor-class">{cf.className}</span>
                      <div className="results-factor-controls">
                        <button
                          className="staged-time-adj"
                          onClick={() => updateFactor(cf.className, Math.max(0.01, Math.round((cf.factor - 0.05) * 100) / 100))}
                        >
                          −
                        </button>
                        <span className="results-factor-value">{cf.factor.toFixed(2)}</span>
                        <button
                          className="staged-time-adj"
                          onClick={() => updateFactor(cf.className, Math.round((cf.factor + 0.05) * 100) / 100)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="results-config-section">
              <div className="start-classes-label">Show top:</div>
              <div className="results-drops">
                <button
                  className="staged-time-adj"
                  onClick={() => setTopN(Math.max(1, topN - 1))}
                >
                  −
                </button>
                <span className="results-drops-value">{topN}</span>
                <button
                  className="staged-time-adj"
                  onClick={() => setTopN(topN + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="results-summary-wrap">
        <button className="results-summary-toggle" onClick={() => setSummaryOpen(!summaryOpen)}>
          <span className="results-summary-toggle-title">Top {topN} Summary</span>
          <span className={`race-card-chevron ${summaryOpen ? "race-card-chevron--open" : ""}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        </button>
        {summaryOpen && (
          <>
            {viewMode === "race" && (
              <RaceSummary results={raceResults} topN={topN} />
            )}
            {viewMode === "series" && seriesResults && (
              <SeriesSummary results={seriesResults} topN={topN} seriesMethod={seriesMethod} />
            )}
          </>
        )}
      </div>

      {/* Column toggles */}
      <ColumnToggles
        columns={getRaceColumns(timingMethod)}
        visible={visibleCols}
        onToggle={toggleCol}
      />

      {/* Custom columns */}
      <div className="custom-cols-section">
        {customCols.map((col) => (
          <button
            key={col}
            className="results-col-toggle results-col-toggle--on"
            onClick={() => setCustomCols((prev) => prev.filter((c) => c !== col))}
          >
            {col} ×
          </button>
        ))}
        <div className="custom-col-add">
          <input
            className="login-input custom-col-input"
            placeholder="Custom column name..."
            value={newCustomCol}
            onChange={(e) => setNewCustomCol(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newCustomCol.trim()) {
                const name = newCustomCol.trim();
                if (!customCols.includes(name)) setCustomCols((prev) => [...prev, name]);
                setNewCustomCol("");
              }
            }}
          />
          <button
            className="btn btn-secondary btn-sm"
            disabled={!newCustomCol.trim()}
            onClick={() => {
              const name = newCustomCol.trim();
              if (name && !customCols.includes(name)) setCustomCols((prev) => [...prev, name]);
              setNewCustomCol("");
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Results display */}
      {viewMode === "race" && (
        <RaceResultsView results={raceResults} raceName={selectedRace.name} visibleCols={visibleCols} customCols={customCols} timingMethod={timingMethod} topN={topN} />
      )}

      {viewMode === "series" && seriesResults && parentSeries && (
        <SeriesResultsView
          results={seriesResults}
          races={seriesRaces}
          seriesName={parentSeries.name}
          seriesMethod={seriesMethod}
          visibleCols={visibleCols}
          customCols={customCols}
          timingMethod={timingMethod}
          topN={topN}
        />
      )}
    </div>
  );
}
