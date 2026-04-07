import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRaces } from "./RaceContext";
import { useAuth } from "./AuthContext";
import { useTime } from "./TimeContext";
import type { Boat } from "./RaceContext";
import type { RaceBoatEntry, FinishObservation } from "./api";
import { addFinishObservation, getFinishObservations, deleteFinishObservation } from "./api";

// ---- Types ----

export type FinishTimeDisplay = "clock" | "elapsed";

interface StagedBoat {
  boatId: number | null; // null = unidentified MARK
  finishTime: number | null;
  lastFinishTime: number | null; // remembers time after reset
  id: string; // unique key for list stability
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Time formatting ----

function formatFinishTimeShort(ms: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatElapsedShort(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

import type { StartInfo } from "./api";

function formatFinishTime(
  finishTimeMs: number,
  mode: FinishTimeDisplay,
  boatClass: string | undefined,
  starts: StartInfo[]
): string {
  if (mode === "clock") return formatFinishTimeShort(finishTimeMs);
  // Elapsed mode: find the start time for this boat's class
  if (boatClass) {
    const start = starts.find((s) => s.classes.includes(boatClass));
    if (start?.startTime != null) {
      const elapsed = finishTimeMs - start.startTime;
      if (elapsed > 0) return formatElapsedShort(elapsed);
    }
  }
  // Fallback to clock if we can't compute elapsed
  return formatFinishTimeShort(finishTimeMs);
}

function SearchResults({
  query,
  boats,
  raceBoats,
  stagedIds,
  hideFinishedByMe,
  hideCertified,
  finishTimeDisplay,
  starts,
  myObservations,
  allObservations,
  onStage,
  onAdjustFinish,
  onUnfinish,
  onSetStatus,
}: {
  query: string;
  boats: Boat[];
  raceBoats: RaceBoatEntry[];
  stagedIds: Set<number>;
  hideFinishedByMe: boolean;
  hideCertified: boolean;
  finishTimeDisplay: FinishTimeDisplay;
  starts: StartInfo[];
  myObservations: FinishObservation[];
  allObservations: FinishObservation[];
  onStage: (boatId: number) => void;
  onAdjustFinish: (boatId: number, delta: number) => void;
  onUnfinish: (boatId: number) => void;
  onSetStatus: (boatId: number, status: string) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const myObsBoatIds = new Set(myObservations.map((o) => o.boat_id));
  const allObsByBoat = new Map<number, FinishObservation[]>();
  allObservations.forEach((o) => {
    const arr = allObsByBoat.get(o.boat_id) || [];
    arr.push(o);
    allObsByBoat.set(o.boat_id, arr);
  });

  const q = query.trim().toLowerCase();
  const results = raceBoats.filter((rb) => {
    const isCertified = rb.finishTime != null && rb.status === "finished";
    const isFinishedByMe = myObsBoatIds.has(rb.boatId);
    if (hideCertified && isCertified) return false;
    if (hideFinishedByMe && isFinishedByMe && !isCertified) return false;
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
        const isCertified = rb.finishTime != null && rb.status === "finished";
        const myObs = myObservations.find((o) => o.boat_id === rb.boatId);
        const boatObs = allObsByBoat.get(rb.boatId) || [];
        const observedByMe = !!myObs;
        const isDnfDns = rb.status === "DNF" || rb.status === "DNS" || rb.status === "DSQ" || rb.status === "OCS";
        const isEditing = editingId === rb.boatId;
        const showMenu = menuOpenId === rb.boatId;

        // Status text
        let statusText = rb.status;
        if (isCertified) {
          statusText = formatFinishTime(rb.finishTime as number, finishTimeDisplay, rb.class, starts) + " ✓";
        } else if (observedByMe) {
          statusText = formatFinishTime(myObs!.observed_time, finishTimeDisplay, rb.class, starts);
        } else if (alreadyStaged) {
          statusText = "Staged";
        }

        return (
          <div key={rb.boatId} className="finish-search-entry">
            <div className={`finish-search-item ${alreadyStaged ? "finish-search-item--staged" : ""} ${isCertified ? "finish-search-item--finished" : ""} ${observedByMe && !isCertified ? "finish-search-item--observed" : ""} ${isDnfDns ? "finish-search-item--dnf" : ""}`}>
              <button
                className="finish-search-item-main"
                onClick={() => {
                  if (isCertified || observedByMe || isDnfDns) {
                    setEditingId(isEditing ? null : rb.boatId);
                    setMenuOpenId(null);
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
                <div className="finish-search-item-right">
                  {boatObs.length > 0 && !isCertified && (
                    <span className="finish-obs-badge">{boatObs.length} obs</span>
                  )}
                  <span className="finish-search-item-status">
                    {statusText}
                  </span>
                </div>
              </button>
              <button
                className="finish-search-item-dots"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(showMenu ? null : rb.boatId);
                  setEditingId(null);
                }}
              >
                ⋮
              </button>
            </div>

            {/* Status dropdown menu */}
            {showMenu && (
              <div className="finish-status-menu">
                {rb.status !== "racing" && (
                  <button className="finish-status-menu-item" onClick={() => { onSetStatus(rb.boatId, "racing"); setMenuOpenId(null); }}>
                    Racing
                  </button>
                )}
                <button className="finish-status-menu-item finish-status-menu-item--danger" onClick={() => { onSetStatus(rb.boatId, "DNF"); setMenuOpenId(null); }}>
                  DNF
                </button>
                <button className="finish-status-menu-item finish-status-menu-item--danger" onClick={() => { onSetStatus(rb.boatId, "DNS"); setMenuOpenId(null); }}>
                  DNS
                </button>
                <button className="finish-status-menu-item finish-status-menu-item--danger" onClick={() => { onSetStatus(rb.boatId, "DSQ"); setMenuOpenId(null); }}>
                  DSQ
                </button>
              </div>
            )}

            {/* Edit row for observed (by me) boats */}
            {isEditing && observedByMe && !isCertified && (
              <div className="finish-edit-row">
                <div className="staged-time-display">
                  <button className="staged-time-adj" onClick={() => onAdjustFinish(rb.boatId, -1000)}>−1s</button>
                  <span className="staged-time">{formatFinishTime(myObs!.observed_time, finishTimeDisplay, rb.class, starts)}</span>
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

            {/* Edit row for certified boats */}
            {isEditing && isCertified && (
              <div className="finish-edit-row">
                <div className="staged-time-display">
                  <span className="staged-time">{formatFinishTime(rb.finishTime as number, finishTimeDisplay, rb.class, starts)}</span>
                </div>
                <span className="finish-certified-label">Certified</span>
              </div>
            )}

            {/* Edit row for DNF/DNS/DSQ boats */}
            {isEditing && isDnfDns && (
              <div className="finish-edit-row">
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: "auto", padding: "0 1rem" }}
                  onClick={() => { onSetStatus(rb.boatId, "racing"); setEditingId(null); }}
                >
                  Back to Racing
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
  finishTimeDisplay,
  starts,
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
  finishTimeDisplay: FinishTimeDisplay;
  starts: StartInfo[];
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
              {formatFinishTime(staged.lastFinishTime!, finishTimeDisplay, raceBoat?.class, starts)}
            </button>
          </div>
        )}
        {isFinished && (
          <div className="staged-time-display">
            <button className="staged-time-adj" onClick={() => onAdjustTime(-1000)}>−1s</button>
            <span className="staged-time">{formatFinishTime(staged.finishTime!, finishTimeDisplay, raceBoat?.class, starts)}</span>
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

// ---- Certify modal ----

function CertifyModal({
  raceBoats,
  boats,
  observations,
  starts,
  finishTimeDisplay,
  onCertify,
  onDismissObservation,
  onClose,
}: {
  raceBoats: RaceBoatEntry[];
  boats: Boat[];
  observations: FinishObservation[];
  starts: StartInfo[];
  finishTimeDisplay: FinishTimeDisplay;
  onCertify: (boatId: number, time: number) => void;
  onDismissObservation: (obsId: number) => void;
  onClose: () => void;
}) {
  // Group observations by boat, excluding already-certified boats
  const certifiedBoatIds = new Set(
    raceBoats.filter((rb) => rb.finishTime != null && rb.status === "finished").map((rb) => rb.boatId)
  );
  const boatGroups = new Map<number, FinishObservation[]>();
  observations.forEach((o) => {
    if (certifiedBoatIds.has(o.boat_id)) return;
    const arr = boatGroups.get(o.boat_id) || [];
    arr.push(o);
    boatGroups.set(o.boat_id, arr);
  });

  const sortedBoatIds = Array.from(boatGroups.keys()).sort((a, b) => {
    const aMin = Math.min(...(boatGroups.get(a) || []).map((o) => o.observed_time));
    const bMin = Math.min(...(boatGroups.get(b) || []).map((o) => o.observed_time));
    return aMin - bMin;
  });

  const getBoatName = (boatId: number) => {
    const boat = boats.find((b) => b.id === boatId);
    return boat?.name || `Boat #${boatId}`;
  };

  const getBoatClass = (boatId: number) => {
    const rb = raceBoats.find((r) => r.boatId === boatId);
    return rb?.class || "";
  };

  const certifyAll = () => {
    sortedBoatIds.forEach((boatId) => {
      const obs = boatGroups.get(boatId)!;
      const avg = Math.round(obs.reduce((s, o) => s + o.observed_time, 0) / obs.length);
      onCertify(boatId, avg);
    });
    onClose();
  };

  return createPortal(
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal certify-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Certify Finishes</span>
          <button className="settings-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {sortedBoatIds.length === 0 && (
            <div className="clubs-empty">No uncertified finishes to review.</div>
          )}

          {sortedBoatIds.map((boatId) => {
            const obs = boatGroups.get(boatId)!;
            const avg = Math.round(obs.reduce((s, o) => s + o.observed_time, 0) / obs.length);
            const boatClass = getBoatClass(boatId);

            return (
              <div key={boatId} className="certify-boat">
                <div className="certify-boat-header">
                  <span className="certify-boat-name">{getBoatName(boatId)}</span>
                  {boatClass && <span className="certify-boat-class">{boatClass}</span>}
                </div>

                <div className="certify-obs-list">
                  {obs.map((o) => (
                    <div key={o.id} className="certify-obs-row">
                      <span className="certify-obs-time">
                        {formatFinishTime(o.observed_time, finishTimeDisplay, boatClass, starts)}
                      </span>
                      <span className="certify-obs-by">{o.observer_name || "Unknown"}</span>
                      <button className="certify-obs-dismiss" onClick={() => onDismissObservation(o.id)}>×</button>
                    </div>
                  ))}
                </div>

                {obs.length > 1 && (
                  <div className="certify-avg">
                    Avg: {formatFinishTime(avg, finishTimeDisplay, boatClass, starts)}
                  </div>
                )}

                <div className="certify-actions">
                  {obs.length === 1 ? (
                    <button className="btn btn-primary btn-sm" onClick={() => onCertify(boatId, obs[0].observed_time)}>
                      Certify
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => onCertify(boatId, avg)}>
                        Use Average
                      </button>
                      {obs.map((o) => (
                        <button
                          key={o.id}
                          className="btn btn-secondary btn-sm"
                          onClick={() => onCertify(boatId, o.observed_time)}
                        >
                          Use {o.observer_name?.split(" ")[0] || "?"}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {sortedBoatIds.length > 0 && (
            <button className="btn btn-primary certify-all-btn" onClick={certifyAll}>
              Certify All ({sortedBoatIds.length}) — Use Averages
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- Main FinishTab ----

export default function FinishTab() {
  const { selectedRace, updateRaceData, boats } = useRaces();
  const { user, token } = useAuth();
  const auth = user && token ? { userId: user.id, token } : null;
  const { now } = useTime();
  const [search, setSearch] = useState("");
  const [hideFinishedByMe, setHideFinishedByMe] = useState(false);
  const [hideCertified, setHideCertified] = useState(false);
  const [finishTimeDisplay, setFinishTimeDisplay] = useState<FinishTimeDisplay>(
    (localStorage.getItem("racemate-finish-display") as FinishTimeDisplay) || "clock"
  );

  // Observation state
  const [myObservations, setMyObservations] = useState<FinishObservation[]>([]);
  const [allObservations, setAllObservations] = useState<FinishObservation[]>([]);
  const [certifyOpen, setCertifyOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Listen for settings changes
  useEffect(() => {
    const handler = () => {
      setFinishTimeDisplay(
        (localStorage.getItem("racemate-finish-display") as FinishTimeDisplay) || "clock"
      );
    };
    window.addEventListener("racemate-settings-changed", handler);
    return () => window.removeEventListener("racemate-settings-changed", handler);
  }, []);

  // Load my observations for this race on mount / race change
  useEffect(() => {
    if (!auth || !selectedRace) return;
    getFinishObservations(auth, selectedRace.id).then((res) => {
      const obs = res.observations || [];
      setAllObservations(obs);
      setMyObservations(obs.filter((o) => o.user_id === user?.id));
    }).catch(() => {});
  }, [selectedRace?.id, auth?.userId]);

  // Sync: fetch all observations for certification
  const handleSync = useCallback(async () => {
    if (!auth || !selectedRace) return;
    setSyncLoading(true);
    try {
      const res = await getFinishObservations(auth, selectedRace.id);
      const obs = res.observations || [];
      setAllObservations(obs);
      setMyObservations(obs.filter((o) => o.user_id === user?.id));
      setCertifyOpen(true);
    } catch {
      // ignore
    }
    setSyncLoading(false);
  }, [auth, selectedRace, user?.id]);
  const [staged, setStaged] = useState<StagedBoat[]>([]);
  const [stagingOpen, setStagingOpen] = useState(true);

  if (!selectedRace) {
    return (
      <div className="tab-placeholder">
        <p>Select a race in the Series tab</p>
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
    // Save lap data to race (laps are not observation-based)
    const updatedBoats = raceBoats.map((b) => {
      if (b.boatId !== boatId) return b;
      return { ...b, lapsCompleted, lapTimes };
    });
    updateRaceData(selectedRace.id, selectedRace.name, { ...selectedRace.info, boats: updatedBoats });

    // If final lap, create observation
    if (isFinished && finishTime != null && auth) {
      addFinishObservation(auth, selectedRace.id, boatId, finishTime).then((res) => {
        if (res.observation?.[0]) {
          const obs = res.observation[0];
          setMyObservations((prev) => {
            const filtered = prev.filter((o) => o.boat_id !== boatId);
            return [...filtered, obs];
          });
          setAllObservations((prev) => {
            const filtered = prev.filter((o) => o.boat_id !== boatId || o.user_id !== auth.userId);
            return [...filtered, obs];
          });
        }
      });
    }
  };

  const saveFinishTime = (boatId: number, time: number | null) => {
    if (!auth) return;
    if (time != null) {
      // Find existing observation to replace
      const existing = myObservations.find((o) => o.boat_id === boatId);
      if (existing) {
        // Delete old, create new
        deleteFinishObservation(auth, existing.id).then(() => {
          setAllObservations((prev) => prev.filter((o) => o.id !== existing.id));
          addFinishObservation(auth, selectedRace.id, boatId, time).then((res) => {
            if (res.observation?.[0]) {
              const obs = res.observation[0];
              setMyObservations((prev) => {
                const filtered = prev.filter((o) => o.boat_id !== boatId);
                return [...filtered, obs];
              });
              setAllObservations((prev) => [...prev, obs]);
            }
          });
        });
      } else {
        addFinishObservation(auth, selectedRace.id, boatId, time).then((res) => {
          if (res.observation?.[0]) {
            const obs = res.observation[0];
            setMyObservations((prev) => [...prev, obs]);
            setAllObservations((prev) => [...prev, obs]);
          }
        });
      }
    } else {
      // Unfinish — delete observation
      const existing = myObservations.find((o) => o.boat_id === boatId);
      if (existing) {
        deleteFinishObservation(auth, existing.id);
        setMyObservations((prev) => prev.filter((o) => o.boat_id !== boatId));
        setAllObservations((prev) => prev.filter((o) => o.id !== existing.id));
      }
    }
  };

  const getBoat = (id: number) => boats.find((b) => b.id === id);
  const getRaceBoat = (id: number) => raceBoats.find((rb) => rb.boatId === id);

  // Count boats with observations but not certified
  const certifiedBoatIds = new Set(raceBoats.filter((rb) => rb.finishTime != null && rb.status === "finished").map((rb) => rb.boatId));
  const uncertifiedBoatIds = new Set(allObservations.map((o) => o.boat_id).filter((id) => !certifiedBoatIds.has(id)));
  const uncertifiedCount = uncertifiedBoatIds.size;

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
                  finishTimeDisplay={finishTimeDisplay}
                  starts={selectedRace.info.starts || []}
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
        hideFinishedByMe={hideFinishedByMe}
        hideCertified={hideCertified}
        finishTimeDisplay={finishTimeDisplay}
        starts={selectedRace.info.starts || []}
        myObservations={myObservations}
        allObservations={allObservations}
        onStage={stageBoat}
        onAdjustFinish={(boatId, delta) => {
          const myObs = myObservations.find((o) => o.boat_id === boatId);
          if (myObs) {
            saveFinishTime(boatId, myObs.observed_time + delta);
          }
        }}
        onUnfinish={(boatId) => {
          saveFinishTime(boatId, null);
        }}
        onSetStatus={(boatId, status) => {
          // Also delete observation if setting DNF/DNS
          const myObs = myObservations.find((o) => o.boat_id === boatId);
          if (myObs && auth) {
            deleteFinishObservation(auth, myObs.id);
            setMyObservations((prev) => prev.filter((o) => o.boat_id !== boatId));
          }
          const updatedBoats = raceBoats.map((b) => {
            if (b.boatId !== boatId) return b;
            return { ...b, status, finishTime: null };
          });
          updateRaceData(selectedRace.id, selectedRace.name, { ...selectedRace.info, boats: updatedBoats });
        }}
      />

      {/* Fixed bottom bar */}
      <div className="finish-bottom-bar">
        <div className="finish-bottom-left">
          <span className="finish-racing-count">
            {raceBoats.filter((rb) => rb.status !== "DNF" && rb.status !== "DNS" && rb.status !== "DSQ" && rb.status !== "OCS" && rb.status !== "finished").length} racing
          </span>
          {uncertifiedCount > 0 && (
            <button
              className="finish-certify-btn"
              onClick={handleSync}
              disabled={syncLoading}
            >
              {syncLoading ? "..." : `Certify (${uncertifiedCount})`}
            </button>
          )}
        </div>
        <div className="finish-bottom-right">
          <label className="finish-hide-toggle">
            <input
              type="checkbox"
              checked={hideFinishedByMe}
              onChange={(e) => setHideFinishedByMe(e.target.checked)}
            />
            <span>Hide my finishes</span>
          </label>
          <label className="finish-hide-toggle">
            <input
              type="checkbox"
              checked={hideCertified}
              onChange={(e) => setHideCertified(e.target.checked)}
            />
            <span>Hide certified</span>
          </label>
        </div>
      </div>

      {/* Certify modal */}
      {certifyOpen && (
        <CertifyModal
          raceBoats={raceBoats}
          boats={boats}
          observations={allObservations}
          starts={selectedRace.info.starts || []}
          finishTimeDisplay={finishTimeDisplay}
          onCertify={(boatId, time) => {
            const updatedBoats = raceBoats.map((b) => {
              if (b.boatId !== boatId) return b;
              return { ...b, finishTime: time, status: "finished" };
            });
            updateRaceData(selectedRace.id, selectedRace.name, { ...selectedRace.info, boats: updatedBoats });
            // Remove observations for this boat
            if (auth) {
              const boatObs = allObservations.filter((o) => o.boat_id === boatId);
              boatObs.forEach((o) => deleteFinishObservation(auth, o.id));
              setAllObservations((prev) => prev.filter((o) => o.boat_id !== boatId));
              setMyObservations((prev) => prev.filter((o) => o.boat_id !== boatId));
            }
          }}
          onDismissObservation={(obsId) => {
            if (auth) {
              deleteFinishObservation(auth, obsId);
              setAllObservations((prev) => prev.filter((o) => o.id !== obsId));
              setMyObservations((prev) => prev.filter((o) => o.id !== obsId));
            }
          }}
          onClose={() => setCertifyOpen(false)}
        />
      )}
    </div>
  );
}
