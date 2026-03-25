import { useState } from "react";
import { useRaces } from "./RaceContext";
import type { Race, Boat } from "./RaceContext";
import type { RaceBoatEntry, StartInfo } from "./api";

// ---- Scoring types ----

type TimingMethod = "absolute" | "phrf-tot";
type SeriesMethod = "points" | "total-time";

interface ClassFactor {
  className: string;
  factor: number;
}

interface BoatResult {
  boatId: number;
  boatName: string;
  sailNumber: string;
  className: string;
  phrf: number | null;
  elapsedMs: number | null;
  correctedMs: number | null;
  classRank: number | null;
  overallRank: number | null;
  status: string;
  lapsCompleted: number;
  totalLaps: number;
  lapTimes: number[];
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
  className: string;
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

function calcPhrfToT(elapsedMs: number, phrf: number): number {
  return elapsedMs * (650 / (550 + phrf));
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
  timingMethod: TimingMethod,
  classFactors: ClassFactor[]
): RaceResults {
  const raceBoats = race.info.boats || [];
  const starts = race.info.starts || [];
  const classLaps = (race.info.classLaps || {}) as Record<string, number>;

  const results: BoatResult[] = raceBoats.map((rb) => {
    const boat = boats.find((b) => b.id === rb.boatId);
    const phrf = boat?.info.phrf != null ? Number(boat.info.phrf) : null;
    const elapsedMs = getElapsedTime(rb, starts);
    const totalLaps = classLaps[rb.class] || 1;
    const lapsCompleted = (rb.lapsCompleted as number) || (rb.finishTime != null ? totalLaps : 0);
    const lapTimes = (rb.lapTimes as number[]) || [];

    // Apply class factor
    const factor = classFactors.find((cf) => cf.className === rb.class)?.factor ?? 1;
    const adjustedElapsed = elapsedMs != null ? elapsedMs * factor : null;

    let correctedMs: number | null = null;
    if (adjustedElapsed != null && timingMethod === "phrf-tot" && phrf != null) {
      correctedMs = calcPhrfToT(adjustedElapsed, phrf);
    } else if (adjustedElapsed != null && timingMethod === "absolute") {
      correctedMs = adjustedElapsed;
    }

    return {
      boatId: rb.boatId,
      boatName: boat?.name || `Boat #${rb.boatId}`,
      sailNumber: boat?.info.sailNumber || "",
      className: rb.class,
      phrf,
      elapsedMs,
      correctedMs,
      classRank: null,
      overallRank: null,
      status: rb.status,
      lapsCompleted,
      totalLaps,
      lapTimes,
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
  timingMethod: TimingMethod,
  seriesMethod: SeriesMethod,
  drops: number,
  classFactors: ClassFactor[]
): SeriesBoatResult[] {
  const allRaceResults = seriesRaces.map((race) =>
    calculateRaceResults(race, boats, timingMethod, classFactors)
  );

  const boatIds = new Set<number>();
  allRaceResults.forEach((rr) => rr.boats.forEach((b) => boatIds.add(b.boatId)));

  const seriesResults: SeriesBoatResult[] = Array.from(boatIds).map((boatId) => {
    const boat = boats.find((b) => b.id === boatId);
    const firstResult = allRaceResults.flatMap((rr) => rr.boats).find((b) => b.boatId === boatId);

    const raceResults = allRaceResults.map((rr) => {
      const result = rr.boats.find((b) => b.boatId === boatId);
      return {
        raceId: rr.raceId,
        classRank: result?.classRank ?? null,
        overallRank: result?.overallRank ?? null,
        elapsedMs: result?.elapsedMs ?? null,
        correctedMs: result?.correctedMs ?? null,
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
      className: firstResult?.className || "Default",
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

function exportRaceCSV(results: RaceResults): string {
  const header = "Overall Rank,Class Rank,Boat,Sail #,Class,Elapsed,Corrected,Status";
  const rows = results.boats
    .sort((a, b) => (a.overallRank ?? Infinity) - (b.overallRank ?? Infinity))
    .map((r) => [
      r.overallRank ?? "—",
      r.classRank ?? "—",
      r.boatName,
      r.sailNumber,
      r.className,
      formatElapsed(r.elapsedMs),
      formatElapsed(r.correctedMs),
      statusLabel(r.status),
    ].join(","));
  return [header, ...rows].join("\n");
}

function exportSeriesCSV(results: SeriesBoatResult[], races: Race[]): string {
  const raceHeaders = races.map((r) => `${r.name} Rank`).join(",");
  const header = `Series Rank,Class Rank,Boat,Sail #,Class,Total,${raceHeaders}`;
  const rows = results.map((r) => {
    const raceRanks = r.raceResults.map((rr) => {
      const rank = rr.overallRank ?? "—";
      return rr.dropped ? `(${rank})` : String(rank);
    }).join(",");
    const total = r.totalPoints != null
      ? `${r.totalPoints} pts`
      : formatElapsed(r.totalTimeMs);
    return [
      r.seriesOverallRank ?? "—",
      r.seriesClassRank ?? "—",
      r.boatName,
      r.sailNumber,
      r.className,
      total,
      raceRanks,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

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

type RaceColId = "elapsed" | "corrected" | "sailNum" | "class" | "phrf" | "status";

interface ColDef {
  id: RaceColId;
  label: string;
  defaultOn: boolean;
}

const RACE_COLUMNS: ColDef[] = [
  { id: "sailNum", label: "Sail #", defaultOn: false },
  { id: "class", label: "Class", defaultOn: false },
  { id: "elapsed", label: "Elapsed", defaultOn: true },
  { id: "corrected", label: "Corrected", defaultOn: true },
  { id: "phrf", label: "PHRF", defaultOn: false },
  { id: "status", label: "Status", defaultOn: false },
];

function defaultVisibleCols(): Set<RaceColId> {
  return new Set(RACE_COLUMNS.filter((c) => c.defaultOn).map((c) => c.id));
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
}: {
  results: RaceResults;
  raceName: string;
  visibleCols: Set<RaceColId>;
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
          onClick={() => downloadCSV(exportRaceCSV(results), `${raceName}_results.csv`)}
        >
          Export
        </button>
      </div>
      <div className="results-split">
        {/* Fixed left: ranks + boat name */}
        <div className="results-fixed">
          <div className="results-row results-row--header">
            <span className="results-cell results-cell--rank">#</span>
            <span className="results-cell results-cell--cls-rank">Cls</span>
            <span className="results-cell results-cell--name">Boat</span>
          </div>
          {sorted.map((r) => {
            const st = statusLabel(r.status);
            return (
              <div key={r.boatId} className={`results-row ${r.overallRank === 1 ? "results-row--first" : ""}`}>
                <span className="results-cell results-cell--rank">{r.overallRank ?? "—"}</span>
                <span className="results-cell results-cell--cls-rank">{r.classRank ?? "—"}</span>
                <span className="results-cell results-cell--name">
                  <span>{r.boatName}</span>
                  {st && <span className="results-status-badge">{st}</span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scrollable right: data columns */}
        <div className="results-scroll">
          <div className="results-row results-row--header">
            {show("sailNum") && <span className="results-cell results-cell--data">Sail #</span>}
            {show("class") && <span className="results-cell results-cell--data">Class</span>}
            {show("elapsed") && <span className="results-cell results-cell--data">Elapsed</span>}
            {show("corrected") && <span className="results-cell results-cell--data">Corrected</span>}
            {show("phrf") && <span className="results-cell results-cell--data">PHRF</span>}
            {show("status") && <span className="results-cell results-cell--data">Status</span>}
          </div>
          {sorted.map((r) => (
            <div key={r.boatId} className={`results-row ${r.overallRank === 1 ? "results-row--first" : ""}`}>
              {show("sailNum") && <span className="results-cell results-cell--data">{r.sailNumber || "—"}</span>}
              {show("class") && <span className="results-cell results-cell--data">{r.className}</span>}
              {show("elapsed") && <span className="results-cell results-cell--data results-cell--mono">{formatElapsed(r.elapsedMs)}</span>}
              {show("corrected") && <span className="results-cell results-cell--data results-cell--mono">{formatElapsed(r.correctedMs)}</span>}
              {show("phrf") && <span className="results-cell results-cell--data">{r.phrf ?? "—"}</span>}
              {show("status") && <span className="results-cell results-cell--data">{statusLabel(r.status) || "—"}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Series results view ----

function SeriesResultsView({
  results, races, seriesName, seriesMethod, visibleCols,
}: {
  results: SeriesBoatResult[];
  races: Race[];
  seriesName: string;
  seriesMethod: SeriesMethod;
  visibleCols: Set<RaceColId>;
}) {
  const show = (id: RaceColId) => visibleCols.has(id);

  return (
    <div className="results-table-wrap">
      <div className="results-table-header">
        <span className="results-table-title">{seriesName} — Series</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => downloadCSV(exportSeriesCSV(results, races), `${seriesName}_series.csv`)}
        >
          Export
        </button>
      </div>
      <div className="results-split">
        {/* Fixed left */}
        <div className="results-fixed">
          <div className="results-row results-row--header">
            <span className="results-cell results-cell--rank">#</span>
            <span className="results-cell results-cell--cls-rank">Cls</span>
            <span className="results-cell results-cell--name">Boat</span>
          </div>
          {results.map((r) => (
            <div key={r.boatId} className={`results-row ${r.seriesOverallRank === 1 ? "results-row--first" : ""}`}>
              <span className="results-cell results-cell--rank">{r.seriesOverallRank ?? "—"}</span>
              <span className="results-cell results-cell--cls-rank">{r.seriesClassRank ?? "—"}</span>
              <span className="results-cell results-cell--name">
                <span>{r.boatName}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable right */}
        <div className="results-scroll">
          <div className="results-row results-row--header">
            {show("sailNum") && <span className="results-cell results-cell--data">Sail #</span>}
            {show("class") && <span className="results-cell results-cell--data">Class</span>}
            <span className="results-cell results-cell--data">Total</span>
            {races.map((race) => (
              <span key={race.id} className="results-cell results-cell--data">
                {race.name.length > 10 ? race.name.slice(0, 10) + "…" : race.name}
              </span>
            ))}
          </div>
          {results.map((r) => (
            <div key={r.boatId} className={`results-row ${r.seriesOverallRank === 1 ? "results-row--first" : ""}`}>
              {show("sailNum") && <span className="results-cell results-cell--data">{r.sailNumber || "—"}</span>}
              {show("class") && <span className="results-cell results-cell--data">{r.className}</span>}
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
            </div>
          ))}
        </div>
      </div>
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
        Add ratings in the Races tab.
      </span>
    </div>
  );
}

// ---- Main ResultsTab ----

export default function ResultsTab() {
  const { selectedRace, races, series, boats } = useRaces();
  const [viewMode, setViewMode] = useState<"race" | "series">("race");
  const [timingMethod, setTimingMethod] = useState<TimingMethod>("absolute");
  const [seriesMethod, setSeriesMethod] = useState<SeriesMethod>("points");
  const [drops, setDrops] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [classFactors, setClassFactors] = useState<ClassFactor[]>([]);
  const [visibleCols, setVisibleCols] = useState<Set<RaceColId>>(defaultVisibleCols);

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
        <p>Select a race in the Races tab</p>
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

  const raceResults = calculateRaceResults(selectedRace, boats, timingMethod, effectiveFactors);

  const seriesResults = parentSeries && seriesRaces.length > 1
    ? calculateSeriesResults(seriesRaces, boats, timingMethod, seriesMethod, drops, effectiveFactors)
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
              <div className="start-classes-label">Timing method:</div>
              <div className="start-mode-toggle">
                <button
                  className={`start-mode-btn ${timingMethod === "absolute" ? "start-mode-btn--active" : ""}`}
                  onClick={() => setTimingMethod("absolute")}
                >
                  Absolute
                </button>
                <button
                  className={`start-mode-btn ${timingMethod === "phrf-tot" ? "start-mode-btn--active" : ""}`}
                  onClick={() => setTimingMethod("phrf-tot")}
                >
                  PHRF
                </button>
              </div>
            </div>

            {timingMethod === "phrf-tot" && (
              <PhrfWarning raceBoats={raceBoats} boats={boats} />
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
              </>
            )}

            {/* Class time adjustment factors */}
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
          </div>
        )}
      </div>

      {/* Column toggles */}
      <ColumnToggles
        columns={RACE_COLUMNS}
        visible={visibleCols}
        onToggle={toggleCol}
      />

      {/* Results display */}
      {viewMode === "race" && (
        <RaceResultsView results={raceResults} raceName={selectedRace.name} visibleCols={visibleCols} />
      )}

      {viewMode === "series" && seriesResults && parentSeries && (
        <SeriesResultsView
          results={seriesResults}
          races={seriesRaces}
          seriesName={parentSeries.name}
          seriesMethod={seriesMethod}
          visibleCols={visibleCols}
        />
      )}
    </div>
  );
}
