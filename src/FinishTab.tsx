import { useState } from "react";
import { useRaces } from "./RaceContext";
import { useTime } from "./TimeContext";
import type { Boat } from "./RaceContext";
import type { RaceBoatEntry } from "./api";

// ---- Types ----

interface StagedBoat {
  boatId: number | null; // null = unidentified MARK
  finishTime: number | null;
  lastFinishTime: number | null; // remembers time after reset
  id: string; // unique key for list stability
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Search results ----

function formatFinishTimeShort(ms: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function SearchResults({
  query,
  boats,
  raceBoats,
  stagedIds,
  onStage,
  onAdjustFinish,
  onUnfinish,
}: {
  query: string;
  boats: Boat[];
  raceBoats: RaceBoatEntry[];
  stagedIds: Set<number>;
  onStage: (boatId: number) => void;
  onAdjustFinish: (boatId: number, delta: number) => void;
  onUnfinish: (boatId: number) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  const q = query.trim().toLowerCase();
  const results = raceBoats.filter((rb) => {
    if (!q) return true;
    const boat = boats.find((b) => b.id === rb.boatId);
    if (!boat) return false;
    return (
      boat.name.toLowerCase().includes(q) ||
      (boat.info.sailNumber || "").toLowerCase().includes(q) ||
      (boat.info.type || "").toLowerCase().includes(q) ||
      (boat.info.skipper || "").toLowerCase().includes(q) ||
      rb.class.toLowerCase().includes(q)
    );
  });

  if (results.length === 0 && q) {
    return <p className="races-empty">No boats match "{query}"</p>;
  }

  if (results.length === 0) {
    return <p className="races-empty">No boats in this race</p>;
  }

  return (
    <div className="finish-search-results">
      {results.map((rb) => {
        const boat = boats.find((b) => b.id === rb.boatId);
        const alreadyStaged = stagedIds.has(rb.boatId);
        const alreadyFinished = rb.finishTime != null;
        const isEditing = editingId === rb.boatId;

        return (
          <div key={rb.boatId} className="finish-search-entry">
            <button
              className={`finish-search-item ${alreadyStaged ? "finish-search-item--staged" : ""} ${alreadyFinished ? "finish-search-item--finished" : ""}`}
              onClick={() => {
                if (alreadyFinished) {
                  setEditingId(isEditing ? null : rb.boatId);
                } else if (!alreadyStaged) {
                  onStage(rb.boatId);
                }
              }}
            >
              <div className="finish-search-item-info">
                <span className="checkin-boat-name">{boat?.name || `#${rb.boatId}`}</span>
                {boat?.info.sailNumber && (
                  <span className="checkin-boat-sail">{boat.info.sailNumber}</span>
                )}
                <span className="checkin-boat-class">{rb.class}</span>
              </div>
              <span className="finish-search-item-status">
                {alreadyFinished
                  ? formatFinishTimeShort(rb.finishTime as number)
                  : alreadyStaged ? "Staged" : rb.status}
              </span>
            </button>

            {isEditing && alreadyFinished && (
              <div className="finish-edit-row">
                <div className="staged-time-display">
                  <button className="staged-time-adj" onClick={() => onAdjustFinish(rb.boatId, -1000)}>−1s</button>
                  <span className="staged-time">{formatFinishTimeShort(rb.finishTime as number)}</span>
                  <button className="staged-time-adj" onClick={() => onAdjustFinish(rb.boatId, 1000)}>+1s</button>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { onUnfinish(rb.boatId); setEditingId(null); }}
                >
                  Unfinish
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Staged boat row ----

function StagedBoatRow({
  staged,
  boat,
  raceBoat,
  lapInfo,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onFinish,
  onAdjustTime,
  onResetFinish,
  onRefinish,
  onDismiss,
  onAssignBoat,
  allBoats,
  raceBoats,
}: {
  staged: StagedBoat;
  boat: Boat | undefined;
  raceBoat: RaceBoatEntry | undefined;
  lapInfo: { totalLaps: number; lapsCompleted: number } | null;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onFinish: () => void;
  onAdjustTime: (delta: number) => void;
  onResetFinish: () => void;
  onRefinish: () => void;
  onDismiss: () => void;
  onAssignBoat: (boatId: number) => void;
  allBoats: Boat[];
  raceBoats: RaceBoatEntry[];
}) {
  const [flash, setFlash] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [showAssign, setShowAssign] = useState(false);

  const isFinished = staged.finishTime != null;
  const isUnidentified = staged.boatId == null;
  const hasLastFinish = !isFinished && staged.lastFinishTime != null;
  const isMultiLap = lapInfo != null && lapInfo.totalLaps > 1;
  const isIntermediateLap = isMultiLap && lapInfo.lapsCompleted > 0 && lapInfo.lapsCompleted < lapInfo.totalLaps && !isFinished;

  const handleFinish = () => {
    onFinish();
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  };

  const assignResults = isUnidentified && showAssign && assignSearch.trim()
    ? raceBoats.filter((rb) => {
        const b = allBoats.find((bt) => bt.id === rb.boatId);
        if (!b) return false;
        const q = assignSearch.toLowerCase();
        return (
          b.name.toLowerCase().includes(q) ||
          (b.info.sailNumber || "").toLowerCase().includes(q) ||
          rb.class.toLowerCase().includes(q)
        );
      })
    : [];

  // Button label changes based on lap state
  const finishLabel = isMultiLap && lapInfo.lapsCompleted < lapInfo.totalLaps - 1
    ? `Lap ${lapInfo.lapsCompleted + 1}`
    : "Finish";

  return (
    <div className={`staged-row ${isFinished ? "staged-row--finished" : ""} ${isIntermediateLap ? "staged-row--lapped" : ""} ${flash ? "staged-row--flash" : ""}`}>
      <div className="staged-row-main">
        {/* Reorder buttons */}
        <div className="staged-arrows">
          <button className="staged-arrow-btn" onClick={onMoveUp} disabled={isFirst} aria-label="Move up">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 15 12 9 18 15" />
            </svg>
          </button>
          <button className="staged-arrow-btn" onClick={onMoveDown} disabled={isLast} aria-label="Move down">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Boat info */}
        <div className="staged-boat-info">
          {isUnidentified ? (
            <span className="staged-mark-label">MARK — unidentified</span>
          ) : (
            <>
              <span className="checkin-boat-name">{boat?.name || `#${staged.boatId}`}</span>
              {boat?.info.sailNumber && (
                <span className="checkin-boat-sail">{boat.info.sailNumber}</span>
              )}
              {raceBoat && (
                <span className="checkin-boat-class">{raceBoat.class}</span>
              )}
              {isMultiLap && (
                <span className="staged-lap-badge">
                  L{lapInfo.lapsCompleted}/{lapInfo.totalLaps}
                </span>
              )}
            </>
          )}
        </div>

        {/* Finish button, refinish, or time display */}
        {!isFinished && !hasLastFinish && (
          <button className="staged-finish-btn" onClick={handleFinish}>
            {finishLabel}
          </button>
        )}
        {hasLastFinish && (
          <div className="staged-refinish">
            <button className="staged-finish-btn" onClick={handleFinish}>
              {finishLabel}
            </button>
            <button className="staged-refinish-btn" onClick={onRefinish}>
              {formatFinishTimeShort(staged.lastFinishTime!)}
            </button>
          </div>
        )}
        {isFinished && (
          <div className="staged-time-display">
            <button className="staged-time-adj" onClick={() => onAdjustTime(-1000)}>−1s</button>
            <span className="staged-time">{formatFinishTimeShort(staged.finishTime!)}</span>
            <button className="staged-time-adj" onClick={() => onAdjustTime(1000)}>+1s</button>
          </div>
        )}

        {/* Actions */}
        <div className="staged-actions">
          {isFinished && (
            <button className="staged-action-btn" onClick={onResetFinish} aria-label="Reset finish">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 2v6h-6" />
              </svg>
            </button>
          )}
          {isUnidentified && (
            <button className="staged-action-btn" onClick={() => setShowAssign(!showAssign)} aria-label="Assign boat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </button>
          )}
          <button className="staged-action-btn staged-action-dismiss" onClick={onDismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      </div>

      {/* Assign boat to MARK entry */}
      {isUnidentified && showAssign && (
        <div className="staged-assign">
          <input
            className="login-input"
            placeholder="Search to assign boat..."
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
          />
          {assignResults.map((rb) => {
            const b = allBoats.find((bt) => bt.id === rb.boatId);
            return (
              <button
                key={rb.boatId}
                className="finish-search-item"
                onClick={() => { onAssignBoat(rb.boatId); setShowAssign(false); setAssignSearch(""); }}
              >
                <div className="finish-search-item-info">
                  <span className="checkin-boat-name">{b?.name || `#${rb.boatId}`}</span>
                  {b?.info.sailNumber && <span className="checkin-boat-sail">{b.info.sailNumber}</span>}
                  <span className="checkin-boat-class">{rb.class}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Main FinishTab ----

export default function FinishTab() {
  const { selectedRace, updateRaceData, boats } = useRaces();
  const { now } = useTime();
  const [search, setSearch] = useState("");
  const [staged, setStaged] = useState<StagedBoat[]>([]);
  const [stagingOpen, setStagingOpen] = useState(true);

  if (!selectedRace) {
    return (
      <div className="tab-placeholder">
        <p>Select a race in the Races tab</p>
      </div>
    );
  }

  const raceBoats = selectedRace.info.boats || [];
  const classLaps = (selectedRace.info.classLaps || {}) as Record<string, number>;
  const stagedBoatIds = new Set(staged.filter((s) => s.boatId != null).map((s) => s.boatId as number));

  const getBoatLapInfo = (boatId: number) => {
    const rb = raceBoats.find((b) => b.boatId === boatId);
    if (!rb) return { totalLaps: 1, lapsCompleted: 0, lapTimes: [] as number[] };
    const totalLaps = classLaps[rb.class] || 1;
    const lapsCompleted = (rb.lapsCompleted as number) || 0;
    const lapTimes = (rb.lapTimes as number[]) || [];
    return { totalLaps, lapsCompleted, lapTimes };
  };

  const stageBoat = (boatId: number) => {
    if (stagedBoatIds.has(boatId)) return;
    setStaged((prev) => [...prev, { boatId, finishTime: null, lastFinishTime: null, id: generateId() }]);
    setSearch("");
  };

  const markUnknown = () => {
    setStaged((prev) => [...prev, { boatId: null, finishTime: now, lastFinishTime: null, id: generateId() }]);
  };

  const moveStaged = (index: number, direction: -1 | 1) => {
    setStaged((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const finishBoat = (stagedId: string) => {
    const finishTime = now;
    const entry = staged.find((s) => s.id === stagedId);
    if (!entry?.boatId) {
      // MARK entry
      setStaged((prev) =>
        prev.map((s) => (s.id === stagedId ? { ...s, finishTime } : s))
      );
      return;
    }

    const { totalLaps, lapsCompleted, lapTimes } = getBoatLapInfo(entry.boatId);
    const newLapsCompleted = lapsCompleted + 1;
    const newLapTimes = [...lapTimes, finishTime];

    if (newLapsCompleted >= totalLaps) {
      // Final lap - record as finished
      setStaged((prev) =>
        prev.map((s) => (s.id === stagedId ? { ...s, finishTime } : s))
      );
      saveLapFinish(entry.boatId, finishTime, newLapsCompleted, newLapTimes, true);
    } else {
      // Intermediate lap - save lap data, keep boat in staging unfinished
      // Force a re-render by updating a harmless field so the component picks up new lapInfo
      setStaged((prev) =>
        prev.map((s) => (s.id === stagedId ? { ...s, lastFinishTime: finishTime } : s))
      );
      saveLapFinish(entry.boatId, null, newLapsCompleted, newLapTimes, false);
    }
  };

  const adjustTime = (stagedId: string, delta: number) => {
    setStaged((prev) =>
      prev.map((s) => {
        if (s.id !== stagedId || s.finishTime == null) return s;
        return { ...s, finishTime: s.finishTime + delta };
      })
    );
    const entry = staged.find((s) => s.id === stagedId);
    if (entry?.boatId != null && entry.finishTime != null) {
      saveFinishTime(entry.boatId, entry.finishTime + delta);
    }
  };

  const resetFinish = (stagedId: string) => {
    const entry = staged.find((s) => s.id === stagedId);
    setStaged((prev) =>
      prev.map((s) => (s.id === stagedId ? { ...s, finishTime: null, lastFinishTime: s.finishTime } : s))
    );
    if (entry?.boatId != null) {
      saveFinishTime(entry.boatId, null);
    }
  };

  const refinish = (stagedId: string) => {
    const entry = staged.find((s) => s.id === stagedId);
    if (!entry?.lastFinishTime) return;
    setStaged((prev) =>
      prev.map((s) => (s.id === stagedId ? { ...s, finishTime: s.lastFinishTime, lastFinishTime: null } : s))
    );
    if (entry.boatId != null) {
      saveFinishTime(entry.boatId, entry.lastFinishTime);
    }
  };

  const dismissStaged = (stagedId: string) => {
    setStaged((prev) => prev.filter((s) => s.id !== stagedId));
  };

  const assignBoatToMark = (stagedId: string, boatId: number) => {
    const entry = staged.find((s) => s.id === stagedId);
    setStaged((prev) =>
      prev.map((s) => (s.id === stagedId ? { ...s, boatId } : s))
    );
    if (entry?.finishTime != null) {
      saveFinishTime(boatId, entry.finishTime);
    }
  };

  const saveLapFinish = (boatId: number, finishTime: number | null, lapsCompleted: number, lapTimes: number[], isFinished: boolean) => {
    const updatedBoats = raceBoats.map((b) => {
      if (b.boatId !== boatId) return b;
      return { ...b, finishTime, lapsCompleted, lapTimes, status: isFinished ? "finished" : "racing" };
    });
    updateRaceData(selectedRace.id, selectedRace.name, { ...selectedRace.info, boats: updatedBoats });
  };

  const saveFinishTime = (boatId: number, time: number | null) => {
    const updatedBoats = raceBoats.map((b) => {
      if (b.boatId !== boatId) return b;
      return { ...b, finishTime: time, status: time != null ? "finished" : "racing" };
    });
    updateRaceData(selectedRace.id, selectedRace.name, { ...selectedRace.info, boats: updatedBoats });
  };

  const getBoat = (id: number) => boats.find((b) => b.id === id);
  const getRaceBoat = (id: number) => raceBoats.find((rb) => rb.boatId === id);

  return (
    <div className="finish-tab">
      {/* MARK button */}
      <button className="btn finish-mark-btn" onClick={markUnknown}>
        MARK
      </button>

      {/* Staging area */}
      <div className="finish-staging">
        <button className="finish-staging-header" onClick={() => setStagingOpen(!stagingOpen)}>
          <span className="finish-staging-title">Staging ({staged.length})</span>
          <span className={`race-card-chevron ${stagingOpen ? "race-card-chevron--open" : ""}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        </button>

        {stagingOpen && (
          <div className="finish-staging-list">
            {staged.length === 0 && (
              <p className="races-empty">No boats staged — search below to add</p>
            )}
            {staged.map((s, i) => {
              const li = s.boatId != null ? getBoatLapInfo(s.boatId) : null;
              return (
                <StagedBoatRow
                  key={s.id}
                  staged={s}
                  boat={s.boatId != null ? getBoat(s.boatId) : undefined}
                  raceBoat={s.boatId != null ? getRaceBoat(s.boatId) : undefined}
                  lapInfo={li}
                  isFirst={i === 0}
                  isLast={i === staged.length - 1}
                  onMoveUp={() => moveStaged(i, -1)}
                  onMoveDown={() => moveStaged(i, 1)}
                  onFinish={() => finishBoat(s.id)}
                  onAdjustTime={(delta) => adjustTime(s.id, delta)}
                  onResetFinish={() => resetFinish(s.id)}
                  onRefinish={() => refinish(s.id)}
                  onDismiss={() => dismissStaged(s.id)}
                  onAssignBoat={(boatId) => assignBoatToMark(s.id, boatId)}
                  allBoats={boats}
                  raceBoats={raceBoats}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Search */}
      <input
        className="login-input finish-search-input"
        placeholder="Search boats to stage..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <SearchResults
        query={search}
        boats={boats}
        raceBoats={raceBoats}
        stagedIds={stagedBoatIds}
        onStage={stageBoat}
        onAdjustFinish={(boatId, delta) => {
          const rb = raceBoats.find((b) => b.boatId === boatId);
          if (rb?.finishTime != null) {
            saveFinishTime(boatId, (rb.finishTime as number) + delta);
          }
        }}
        onUnfinish={(boatId) => {
          saveFinishTime(boatId, null);
        }}
      />
    </div>
  );
}
