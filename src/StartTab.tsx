import { useState, useEffect, useCallback } from "react";
import { useRaces } from "./RaceContext";
import { useTime } from "./TimeContext";
import type { StartInfo, SequenceStep, RaceBoatEntry } from "./api";
import type { Boat } from "./RaceContext";

// ---- Helpers ----

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function formatCountdown(ms: number): { text: string; dayPlus: boolean } {
  const neg = ms < 0;
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const dayPlus = h >= 24;
  const displayH = h % 24;

  let str: string;
  if (h > 0) {
    str = `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  } else {
    str = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return { text: neg ? `+${str}` : str, dayPlus: !neg && dayPlus };
}

function formatAbsoluteTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---- Create start form ----

// ---- Time picker with big up/down buttons ----

function TimePicker({
  hours,
  minutes,
  seconds,
  onChangeHours,
  onChangeMinutes,
  onChangeSeconds,
}: {
  hours: number;
  minutes: number;
  seconds: number;
  onChangeHours: (h: number) => void;
  onChangeMinutes: (m: number) => void;
  onChangeSeconds: (s: number) => void;
}) {
  const incH = () => onChangeHours((hours + 1) % 24);
  const decH = () => onChangeHours((hours + 23) % 24);
  const incM = () => onChangeMinutes((minutes + 1) % 60);
  const decM = () => onChangeMinutes((minutes + 59) % 60);
  const incS = () => onChangeSeconds((seconds + 1) % 60);
  const decS = () => onChangeSeconds((seconds + 59) % 60);
  const incM5 = () => onChangeMinutes((minutes + 5) % 60);
  const decM5 = () => onChangeMinutes((minutes + 55) % 60);

  const arrow = (dir: "up" | "down") => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {dir === "up"
        ? <polyline points="6 15 12 9 18 15" />
        : <polyline points="6 9 12 15 18 9" />
      }
    </svg>
  );

  return (
    <div className="time-picker">
      <div className="time-picker-col">
        <button className="time-picker-btn" onClick={incH}>{arrow("up")}</button>
        <span className="time-picker-digit">{String(hours).padStart(2, "0")}</span>
        <button className="time-picker-btn" onClick={decH}>{arrow("down")}</button>
      </div>
      <span className="time-picker-colon">:</span>
      <div className="time-picker-col">
        <button className="time-picker-btn" onClick={incM}>{arrow("up")}</button>
        <span className="time-picker-digit">{String(minutes).padStart(2, "0")}</span>
        <button className="time-picker-btn" onClick={decM}>{arrow("down")}</button>
      </div>
      <span className="time-picker-colon">:</span>
      <div className="time-picker-col">
        <button className="time-picker-btn" onClick={incS}>{arrow("up")}</button>
        <span className="time-picker-digit">{String(seconds).padStart(2, "0")}</span>
        <button className="time-picker-btn" onClick={decS}>{arrow("down")}</button>
      </div>
      <div className="time-picker-quick">
        <button className="time-picker-quick-btn" onClick={incM5}>+5m</button>
        <button className="time-picker-quick-btn" onClick={decM5}>−5m</button>
      </div>
    </div>
  );
}

// ---- Minute picker with big up/down ----

function MinutePicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const inc = () => onChange(value + 1);
  const dec = () => onChange(Math.max(1, value - 1));
  const inc5 = () => onChange(value + 5);
  const dec5 = () => onChange(Math.max(1, value - 5));

  const arrow = (dir: "up" | "down") => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {dir === "up"
        ? <polyline points="6 15 12 9 18 15" />
        : <polyline points="6 9 12 15 18 9" />
      }
    </svg>
  );

  return (
    <div className="minute-picker">
      <span className="start-time-label">{label}</span>
      <div className="time-picker-col">
        <button className="time-picker-btn" onClick={inc}>{arrow("up")}</button>
        <span className="time-picker-digit">{value}</span>
        <button className="time-picker-btn" onClick={dec}>{arrow("down")}</button>
      </div>
      <div className="time-picker-quick">
        <button className="time-picker-quick-btn" onClick={inc5}>+5</button>
        <button className="time-picker-quick-btn" onClick={dec5}>−5</button>
      </div>
    </div>
  );
}

// ---- Create start form ----

function CreateStartForm({
  existingStarts,
  availableClasses,
  onSave,
  onCancel,
}: {
  existingStarts: StartInfo[];
  availableClasses: string[];
  onSave: (start: StartInfo) => void;
  onCancel: () => void;
}) {
  const { now } = useTime();
  const lastStart = existingStarts.length > 0 ? existingStarts[existingStarts.length - 1] : null;

  // Pre-select all available classes
  const [selectedClasses, setSelectedClasses] = useState<string[]>(availableClasses);
  const [timeMode, setTimeMode] = useState<"absolute" | "relative">("absolute");

  // Absolute time state - default to next round 5 minutes
  const defaultDate = new Date(now + 5 * 60 * 1000);
  const roundedMin = Math.ceil(defaultDate.getMinutes() / 5) * 5;
  defaultDate.setMinutes(roundedMin, 0, 0);
  const [absHours, setAbsHours] = useState(defaultDate.getHours());
  const [absMinutes, setAbsMinutes] = useState(defaultDate.getMinutes() % 60);
  const [absSeconds, setAbsSeconds] = useState(0);

  const [relativeMinutes, setRelativeMinutes] = useState(5);
  const [copyPrevious, setCopyPrevious] = useState(false);
  const [offsetMinutes, setOffsetMinutes] = useState(5);

  const toggleClass = (cls: string) => {
    setSelectedClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const save = () => {
    let startTime: number | null = null;

    if (copyPrevious && lastStart?.startTime) {
      startTime = lastStart.startTime + offsetMinutes * 60 * 1000;
    } else if (timeMode === "relative") {
      startTime = now + relativeMinutes * 60 * 1000;
    } else {
      const d = new Date();
      d.setHours(absHours, absMinutes, absSeconds, 0);
      if (d.getTime() < now) d.setDate(d.getDate() + 1);
      startTime = d.getTime();
    }

    const classes = selectedClasses.length > 0 ? selectedClasses : ["Default"];
    const sequence: SequenceStep[] = copyPrevious && lastStart?.sequence
      ? [...lastStart.sequence]
      : [];

    onSave({
      id: generateId(),
      classes,
      startTime,
      sequence,
    });
  };

  return (
    <div className="races-form">
      <div className="edit-boat-title">New Start</div>

      <div className="start-classes-label">Classes in this start:</div>
      <div className="edit-class-picks">
        {availableClasses.map((cls) => (
          <button
            key={cls}
            className={`edit-class-chip ${selectedClasses.includes(cls) ? "edit-class-chip--active" : ""}`}
            onClick={() => toggleClass(cls)}
          >
            {cls}
          </button>
        ))}
      </div>

      {lastStart && (
        <label className="races-checkbox">
          <input
            type="checkbox"
            checked={copyPrevious}
            onChange={(e) => setCopyPrevious(e.target.checked)}
          />
          <span>Copy from previous start</span>
        </label>
      )}

      {copyPrevious && lastStart ? (
        <MinutePicker
          value={offsetMinutes}
          onChange={setOffsetMinutes}
          label="Minutes after previous:"
        />
      ) : (
        <>
          <div className="start-mode-toggle">
            <button
              className={`start-mode-btn ${timeMode === "absolute" ? "start-mode-btn--active" : ""}`}
              onClick={() => setTimeMode("absolute")}
            >
              Exact time
            </button>
            <button
              className={`start-mode-btn ${timeMode === "relative" ? "start-mode-btn--active" : ""}`}
              onClick={() => setTimeMode("relative")}
            >
              Minutes from now
            </button>
          </div>

          {timeMode === "absolute" ? (
            <TimePicker
              hours={absHours}
              minutes={absMinutes}
              seconds={absSeconds}
              onChangeHours={setAbsHours}
              onChangeMinutes={setAbsMinutes}
              onChangeSeconds={setAbsSeconds}
            />
          ) : (
            <MinutePicker
              value={relativeMinutes}
              onChange={setRelativeMinutes}
              label="Minutes from now:"
            />
          )}
        </>
      )}

      <div className="races-form-actions">
        <button className="btn btn-primary" onClick={save}>Create Start</button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Sequence editor ----

function SequenceEditor({
  sequence,
  onChange,
}: {
  sequence: SequenceStep[];
  onChange: (seq: SequenceStep[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [seqMinutes, setSeqMinutes] = useState(0);
  const [seqSeconds, setSeqSeconds] = useState(0);

  const add = () => {
    if (!label.trim()) return;
    const offset = seqMinutes * 60 + seqSeconds;
    onChange([...sequence, { offsetSeconds: offset, label: label.trim() }]
      .sort((a, b) => b.offsetSeconds - a.offsetSeconds));
    setLabel("");
    setSeqMinutes(0);
    setSeqSeconds(0);
  };

  const remove = (idx: number) => {
    onChange(sequence.filter((_, i) => i !== idx));
  };

  const arrow = (dir: "up" | "down") => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {dir === "up"
        ? <polyline points="6 15 12 9 18 15" />
        : <polyline points="6 9 12 15 18 9" />
      }
    </svg>
  );

  return (
    <div className="sequence-editor">
      <div className="sequence-title">Start Sequence</div>
      {sequence.length > 0 && (
        <div className="sequence-list">
          {sequence.map((step, i) => {
            const m = Math.floor(step.offsetSeconds / 60);
            const s = step.offsetSeconds % 60;
            return (
              <div key={i} className="sequence-item">
                <span className="sequence-item-time">
                  {m > 0 ? `${m}m` : ""}{s > 0 ? `${s}s` : ""}{m === 0 && s === 0 ? "0s" : ""} before
                </span>
                <span className="sequence-item-label">{step.label}</span>
                <button className="race-boat-row-remove" onClick={() => remove(i)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      <div className="sequence-add">
        <input className="login-input" placeholder="Action (e.g. Raise red flag)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="sequence-add-time">
          <span className="start-time-label">Time before start:</span>
        </div>
        <div className="sequence-spinner-row">
          <div className="time-picker-col">
            <button className="time-picker-btn time-picker-btn--sm" onClick={() => setSeqMinutes((v) => Math.min(v + 1, 99))}>{arrow("up")}</button>
            <span className="time-picker-digit time-picker-digit--sm">{String(seqMinutes).padStart(2, "0")}</span>
            <button className="time-picker-btn time-picker-btn--sm" onClick={() => setSeqMinutes((v) => Math.max(v - 1, 0))}>{arrow("down")}</button>
          </div>
          <span className="time-picker-colon time-picker-colon--sm">m</span>
          <div className="time-picker-col">
            <button className="time-picker-btn time-picker-btn--sm" onClick={() => setSeqSeconds((v) => (v + 1) % 60)}>{arrow("up")}</button>
            <span className="time-picker-digit time-picker-digit--sm">{String(seqSeconds).padStart(2, "0")}</span>
            <button className="time-picker-btn time-picker-btn--sm" onClick={() => setSeqSeconds((v) => (v + 59) % 60)}>{arrow("down")}</button>
          </div>
          <span className="time-picker-colon time-picker-colon--sm">s</span>
        </div>
        <button className="btn btn-primary" onClick={add} disabled={!label.trim()}>Save Step</button>
      </div>
      {sequence.length === 0 && (
        <p className="races-empty">No steps yet — add actions above</p>
      )}
    </div>
  );
}

// ---- Sequence notification popup ----

function SequenceNotification({
  step,
  timeUntil,
  onDismiss,
}: {
  step: SequenceStep;
  timeUntil: number;
  onDismiss: () => void;
}) {
  const isNow = timeUntil <= 0;
  const isWarning = timeUntil > 0 && timeUntil <= 5000;

  useEffect(() => {
    if (isNow) {
      const timer = setTimeout(onDismiss, 8000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isNow, onDismiss]);

  return (
    <div className={`seq-notification ${isNow ? "seq-notification--now" : ""} ${isWarning ? "seq-notification--warning" : ""}`}>
      <div className="seq-notification-label">{step.label}</div>
      <div className="seq-notification-time">
        {isNow ? "NOW" : `in ${Math.ceil(timeUntil / 1000)}s`}
      </div>
      <button className="seq-notification-dismiss" onClick={onDismiss}>✕</button>
    </div>
  );
}

// ---- Boat check-in list ----

function BoatCheckInList({
  boats,
  raceBoats,
  startClasses,
  onUpdateStatus,
  search,
}: {
  boats: Boat[];
  raceBoats: RaceBoatEntry[];
  startClasses: string[];
  onUpdateStatus: (boatId: number, status: string) => void;
  search: string;
}) {
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const boatsInStart = raceBoats.filter((rb) => startClasses.includes(rb.class));

  const filtered = boatsInStart.filter((rb) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const boat = boats.find((b) => b.id === rb.boatId);
    if (!boat) return false;
    return (
      boat.name.toLowerCase().includes(s) ||
      (boat.info.sailNumber || "").toLowerCase().includes(s) ||
      (boat.info.type || "").toLowerCase().includes(s) ||
      rb.class.toLowerCase().includes(s)
    );
  });

  const getBoat = (id: number) => boats.find((b) => b.id === id);

  const statusOptions = ["signed-up", "checked-in", "racing", "over-early", "OCS", "DNF", "DNS", "DSQ"];

  return (
    <div className="checkin-list">
      {filtered.map((rb) => {
        const boat = getBoat(rb.boatId);
        const isEditingStatus = editingStatusId === rb.boatId;
        return (
          <div key={rb.boatId} className="checkin-row">
            <div className="checkin-boat-info">
              <span className="checkin-boat-name">{boat?.name || `#${rb.boatId}`}</span>
              {boat?.info.sailNumber && (
                <span className="checkin-boat-sail">{boat.info.sailNumber}</span>
              )}
              <span className="checkin-boat-class">{rb.class}</span>
            </div>
            {rb.status === "signed-up" && (
              <button className="btn-check-in" onClick={() => onUpdateStatus(rb.boatId, "checked-in")}>
                Check In
              </button>
            )}
            {rb.status === "over-early" && (
              <button className="btn-check-in btn-clear" onClick={() => onUpdateStatus(rb.boatId, "racing")}>
                Cleared
              </button>
            )}
            {rb.status !== "signed-up" && rb.status !== "over-early" && !isEditingStatus && (
              <>
                <span className={`checkin-status checkin-status--${rb.status}`}>{rb.status}</span>
                <button
                  className="card-edit-btn card-edit-btn--sm"
                  onClick={() => setEditingStatusId(rb.boatId)}
                  aria-label="Edit status"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </>
            )}
            {isEditingStatus && (
              <div className="checkin-status-edit">
                {statusOptions.map((s) => (
                  <button
                    key={s}
                    className={`checkin-status-option ${s === rb.status ? "checkin-status-option--active" : ""}`}
                    onClick={() => { onUpdateStatus(rb.boatId, s); setEditingStatusId(null); }}
                  >
                    {s}
                  </button>
                ))}
                <button
                  className="checkin-status-option checkin-status-option--cancel"
                  onClick={() => setEditingStatusId(null)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
      {filtered.length === 0 && (
        <p className="races-empty">No boats{search.trim() ? " match search" : " in this start"}</p>
      )}
    </div>
  );
}

// ---- Post-start: OCS selection ----

function PostStartPanel({
  boats,
  raceBoats,
  startClasses,
  onUpdateStatus,
  onAllClear,
}: {
  boats: Boat[];
  raceBoats: RaceBoatEntry[];
  startClasses: string[];
  onUpdateStatus: (boatId: number, status: string) => void;
  onAllClear: () => void;
}) {
  const [ocsSearch, setOcsSearch] = useState("");
  const boatsInStart = raceBoats.filter((rb) => startClasses.includes(rb.class));
  const overEarlyBoats = boatsInStart.filter((rb) => rb.status === "over-early");
  const allRacing = boatsInStart.every((rb) => rb.status === "racing" || rb.status === "OCS" || rb.status === "DNF" || rb.status === "DNS" || rb.status === "DSQ");
  const getBoat = (id: number) => boats.find((b) => b.id === id);

  const eligibleBoats = boatsInStart.filter((rb) => rb.status === "checked-in" || rb.status === "over-early");
  const filteredBoats = eligibleBoats.filter((rb) => {
    if (!ocsSearch.trim()) return true;
    const s = ocsSearch.toLowerCase();
    const boat = getBoat(rb.boatId);
    if (!boat) return false;
    return (
      boat.name.toLowerCase().includes(s) ||
      (boat.info.sailNumber || "").toLowerCase().includes(s) ||
      rb.class.toLowerCase().includes(s)
    );
  });

  return (
    <div className="post-start">
      {!allRacing && (
        <>
          <button className="btn btn-primary" onClick={onAllClear}>
            All Clear — No Boats Over Early
          </button>
          <div className="post-start-divider">or select boats over the line early:</div>
          <input
            className="login-input"
            placeholder="Search boats..."
            value={ocsSearch}
            onChange={(e) => setOcsSearch(e.target.value)}
          />
          <div className="post-start-scroll">
            {filteredBoats.map((rb) => {
              const boat = getBoat(rb.boatId);
              const isOver = rb.status === "over-early";
              return (
                <div key={rb.boatId} className={`checkin-row ${isOver ? "checkin-row--over" : ""}`}>
                  <div className="checkin-boat-info">
                    <span className="checkin-boat-name">{boat?.name || `#${rb.boatId}`}</span>
                    {boat?.info.sailNumber && (
                      <span className="checkin-boat-sail">{boat.info.sailNumber}</span>
                    )}
                    <span className="checkin-boat-class">{rb.class}</span>
                  </div>
                  {isOver ? (
                    <button className="btn-check-in btn-clear" onClick={() => onUpdateStatus(rb.boatId, "racing")}>
                      Cleared
                    </button>
                  ) : (
                    <button className="btn-check-in btn-ocs" onClick={() => onUpdateStatus(rb.boatId, "over-early")}>
                      Over Early
                    </button>
                  )}
                </div>
              );
            })}
            {filteredBoats.length === 0 && (
              <p className="races-empty">No boats{ocsSearch.trim() ? " match search" : ""}</p>
            )}
          </div>
          {overEarlyBoats.length > 0 && (
            <button className="btn btn-secondary" onClick={() => {
              overEarlyBoats.forEach((rb) => onUpdateStatus(rb.boatId, "OCS"));
              boatsInStart.filter((rb) => rb.status === "checked-in").forEach((rb) => onUpdateStatus(rb.boatId, "racing"));
            }}>
              Confirm OCS &amp; Start Racing
            </button>
          )}
        </>
      )}
      {allRacing && (
        <div className="post-start-clear">All boats accounted for</div>
      )}
    </div>
  );
}

// ---- Single start card ----

function StartCard({
  start,
  startIndex,
  raceBoats,
  allBoats,
  allClasses,
  onUpdateStart,
  onUpdateBoatStatus,
  onRecall,
}: {
  start: StartInfo;
  startIndex: number;
  raceBoats: RaceBoatEntry[];
  allBoats: Boat[];
  allClasses: string[];
  onUpdateStart: (updated: StartInfo) => void;
  onUpdateBoatStatus: (boatId: number, status: string) => void;
  onRecall: (startId: string) => void;
}) {
  const { now } = useTime();
  const [expanded, setExpanded] = useState(true);
  const [showSequenceEditor, setShowSequenceEditor] = useState(false);
  const [showBoats, setShowBoats] = useState(false);
  const [boatSearch, setBoatSearch] = useState("");
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<number>>(new Set());
  const [editingStart, setEditingStart] = useState(false);
  const [editName, setEditName] = useState<string>("");
  const [editClasses, setEditClasses] = useState<string[]>(start.classes);
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editSeconds, setEditSeconds] = useState(0);

  const startEditing = () => {
    setEditName((start.name as string) || "");
    setEditClasses(start.classes);
    if (start.startTime) {
      const d = new Date(start.startTime);
      setEditHours(d.getHours());
      setEditMinutes(d.getMinutes());
      setEditSeconds(d.getSeconds());
    } else {
      const d = new Date(now + 5 * 60 * 1000);
      setEditHours(d.getHours());
      setEditMinutes(Math.ceil(d.getMinutes() / 5) * 5 % 60);
      setEditSeconds(0);
    }
    setEditingStart(true);
  };

  const saveEdit = () => {
    const d = new Date();
    d.setHours(editHours, editMinutes, editSeconds, 0);
    if (d.getTime() < now) d.setDate(d.getDate() + 1);
    const newTime = d.getTime();

    // If moving start time to the future and start had already occurred,
    // reset boats in this start back to checked-in so OCS flow triggers again
    const classes = editClasses.length > 0 ? editClasses : start.classes;
    if (newTime > now && start.startTime != null && start.startTime <= now) {
      const boatsInThisStart = raceBoats.filter((rb) => classes.includes(rb.class));
      boatsInThisStart.forEach((rb) => {
        if (rb.status === "racing" || rb.status === "over-early" || rb.status === "OCS") {
          onUpdateBoatStatus(rb.boatId, "checked-in");
        }
      });
      // Clear dismissed notifications so they fire again
      setDismissedNotifications(new Set());
    }

    onUpdateStart({
      ...start,
      name: editName.trim() || undefined,
      classes,
      startTime: newTime,
    });
    setEditingStart(false);
  };

  const startTime = start.startTime;
  const hasStarted = startTime != null && now >= startTime;
  const timeUntilStart = startTime != null ? startTime - now : null;

  // Determine start phase
  const boatsInStart = raceBoats.filter((rb) => start.classes.includes(rb.class));
  const allRacing = boatsInStart.length > 0 && boatsInStart.every(
    (rb) => rb.status === "racing" || rb.status === "OCS" || rb.status === "DNF" || rb.status === "DNS" || rb.status === "DSQ"
  );
  const phase: "countdown" | "starting" | "racing" = hasStarted
    ? (allRacing ? "racing" : "starting")
    : "countdown";

  // Sequence notifications
  const activeNotifications = (start.sequence || []).filter((step) => {
    if (dismissedNotifications.has(step.offsetSeconds)) return false;
    if (timeUntilStart == null) return false;
    const triggerAt = step.offsetSeconds * 1000 + 5000; // show 5s early
    return timeUntilStart <= triggerAt && timeUntilStart > -8000;
  });

  const dismissNotification = useCallback((offset: number) => {
    setDismissedNotifications((prev) => new Set(prev).add(offset));
  }, []);

  const handleAllClear = () => {
    boatsInStart.forEach((rb) => {
      if (rb.status === "checked-in" || rb.status === "signed-up") {
        onUpdateBoatStatus(rb.boatId, "racing");
      }
    });
  };

  return (
    <div className={`start-card ${phase === "starting" ? "start-card--attention" : ""}`}>
      {/* Notifications overlay */}
      {activeNotifications.length > 0 && (
        <div className="seq-notification-stack">
          {activeNotifications.map((step) => (
            <SequenceNotification
              key={step.offsetSeconds}
              step={step}
              timeUntil={timeUntilStart != null ? timeUntilStart - step.offsetSeconds * 1000 : 0}
              onDismiss={() => dismissNotification(step.offsetSeconds)}
            />
          ))}
        </div>
      )}

      <div className="start-card-header">
        <button className="race-card-header-toggle" onClick={() => setExpanded(!expanded)}>
          <div className="start-card-header-left">
            <span className="start-card-label">{(start.name as string) || `Start ${startIndex + 1}`}</span>
            <span className="start-card-classes">{start.classes.join(", ")}</span>
          </div>
          <div className="start-card-header-right">
            {startTime != null && (() => {
              const cd = formatCountdown(timeUntilStart!);
              return (
                <span className={`start-countdown ${hasStarted ? "start-countdown--elapsed" : ""}`}>
                  {cd.dayPlus && <span className="start-countdown-day">+1d </span>}
                  {cd.text}
                </span>
              );
            })()}
            <span className={`race-card-chevron ${expanded ? "race-card-chevron--open" : ""}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </span>
          </div>
        </button>
        {expanded && !editingStart && (
          <button className="card-edit-btn" onClick={startEditing} aria-label="Edit start">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="start-card-body">
          {/* Edit start (classes + time) */}
          {editingStart && (
            <div className="races-form">
              <input
                className="login-input"
                placeholder={`Start ${startIndex + 1}`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <div className="start-classes-label">Classes:</div>
              <div className="edit-class-picks">
                {allClasses.map((cls) => (
                  <button
                    key={cls}
                    className={`edit-class-chip ${editClasses.includes(cls) ? "edit-class-chip--active" : ""}`}
                    onClick={() => setEditClasses((prev) =>
                      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
                    )}
                  >
                    {cls}
                  </button>
                ))}
              </div>
              {allClasses.length === 0 && (
                <p className="races-empty">No classes — add boats with classes in the Races tab</p>
              )}
              <div className="start-classes-label">Start time:</div>
              <TimePicker
                hours={editHours}
                minutes={editMinutes}
                seconds={editSeconds}
                onChangeHours={setEditHours}
                onChangeMinutes={setEditMinutes}
                onChangeSeconds={setEditSeconds}
              />
              <div className="races-form-actions">
                <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                <button className="btn btn-secondary" onClick={() => setEditingStart(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Countdown display */}
          {startTime != null && phase === "countdown" && (() => {
            const cd = formatCountdown(timeUntilStart!);
            return (
              <div className="start-countdown-big">
                {cd.dayPlus && <div className="start-countdown-day-big">+1 day</div>}
                <div className="start-countdown-time">{cd.text}</div>
                <div className="start-countdown-abs">Start at {formatAbsoluteTime(startTime)}</div>
              </div>
            );
          })()}

          {startTime == null && (
            <p className="races-empty">No start time set</p>
          )}

          {/* Post-start: OCS panel */}
          {phase === "starting" && (
            <PostStartPanel
              boats={allBoats}
              raceBoats={raceBoats}
              startClasses={start.classes}
              onUpdateStatus={onUpdateBoatStatus}
              onAllClear={handleAllClear}
            />
          )}

          {phase === "racing" && (
            <div className="post-start-clear">Racing</div>
          )}

          {/* Recall button */}
          {phase === "countdown" && startTime != null && (
            <button className="btn btn-secondary btn-recall" onClick={() => onRecall(start.id)}>
              General Recall
            </button>
          )}

          {/* Sequence editor toggle */}
          {phase === "countdown" && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSequenceEditor(!showSequenceEditor)}
              >
                {showSequenceEditor ? "Hide Sequence" : `Sequence (${(start.sequence || []).length} steps)`}
              </button>
              {showSequenceEditor && (
                <SequenceEditor
                  sequence={start.sequence || []}
                  onChange={(seq) => onUpdateStart({ ...start, sequence: seq })}
                />
              )}
            </>
          )}

          {/* Boat list toggle */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowBoats(!showBoats)}
          >
            {showBoats ? "Hide Boats" : `Boats (${boatsInStart.length})`}
          </button>
          {showBoats && (
            <>
              <input
                className="login-input"
                placeholder="Search boats..."
                value={boatSearch}
                onChange={(e) => setBoatSearch(e.target.value)}
              />
              <BoatCheckInList
                boats={allBoats}
                raceBoats={raceBoats}
                startClasses={start.classes}
                onUpdateStatus={onUpdateBoatStatus}
                search={boatSearch}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Recall dialog ----

function RecallDialog({
  starts,
  recallStartId,
  onConfirm,
  onCancel,
}: {
  starts: StartInfo[];
  recallStartId: string;
  onConfirm: (pushAll: boolean, newDelayMinutes: number) => void;
  onCancel: () => void;
}) {
  const [pushAll, setPushAll] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState("5");

  const startIdx = starts.findIndex((s) => s.id === recallStartId);

  return (
    <div className="recall-dialog">
      <div className="edit-boat-title">General Recall — Start {startIdx + 1}</div>
      <div className="start-time-row">
        <span className="start-time-label">Delay (minutes):</span>
        <input
          className="login-input start-time-input"
          type="number"
          value={delayMinutes}
          onChange={(e) => setDelayMinutes(e.target.value)}
          inputMode="numeric"
        />
      </div>
      {starts.length > 1 && (
        <label className="races-checkbox">
          <input
            type="checkbox"
            checked={pushAll}
            onChange={(e) => setPushAll(e.target.checked)}
          />
          <span>Push all subsequent starts forward</span>
        </label>
      )}
      <div className="races-form-actions">
        <button className="btn btn-primary" onClick={() => onConfirm(pushAll, Number(delayMinutes) || 5)}>
          Confirm Recall
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Main StartTab ----

export default function StartTab() {
  const { selectedRace, updateRaceData, boats } = useRaces();
  const [creatingStart, setCreatingStart] = useState(false);
  const [recallStartId, setRecallStartId] = useState<string | null>(null);

  if (!selectedRace) {
    return (
      <div className="tab-placeholder">
        <p>Select a race in the Races tab</p>
      </div>
    );
  }

  const raceInfo = selectedRace.info;
  const starts = raceInfo.starts || [];
  const raceBoats = raceInfo.boats || [];

  // Get all classes in the race
  const allClasses = Array.from(new Set(raceBoats.map((b) => b.class)));
  // Classes not yet assigned to a start
  const assignedClasses = new Set(starts.flatMap((s) => s.classes));
  const unassignedClasses = allClasses.filter((c) => !assignedClasses.has(c));

  const updateStarts = (newStarts: StartInfo[]) => {
    // Sort by start time
    const sorted = [...newStarts].sort((a, b) => {
      if (a.startTime == null && b.startTime == null) return 0;
      if (a.startTime == null) return 1;
      if (b.startTime == null) return -1;
      return a.startTime - b.startTime;
    });
    updateRaceData(selectedRace.id, selectedRace.name, {
      ...raceInfo,
      starts: sorted,
    });
  };

  const addStart = (start: StartInfo) => {
    updateStarts([...starts, start]);
    setCreatingStart(false);
  };

  const updateStart = (updated: StartInfo) => {
    updateStarts(starts.map((s) => (s.id === updated.id ? updated : s)));
  };

  const updateBoatStatus = (boatId: number, status: string) => {
    const updatedBoats = raceBoats.map((b) =>
      b.boatId === boatId ? { ...b, status } : b
    );
    updateRaceData(selectedRace.id, selectedRace.name, {
      ...raceInfo,
      boats: updatedBoats,
    });
  };

  const handleRecall = (startId: string) => {
    setRecallStartId(startId);
  };

  const confirmRecall = (pushAll: boolean, delayMinutes: number) => {
    const delayMs = delayMinutes * 60 * 1000;
    const startIdx = starts.findIndex((s) => s.id === recallStartId);
    if (startIdx === -1) return;

    const newStarts = starts.map((s, i) => {
      if (i === startIdx) {
        // Reset boats in this start back to checked-in
        const boatsInStart = raceBoats.filter((rb) => s.classes.includes(rb.class));
        boatsInStart.forEach((rb) => {
          if (rb.status === "racing" || rb.status === "over-early") {
            updateBoatStatus(rb.boatId, "checked-in");
          }
        });
        return {
          ...s,
          startTime: s.startTime != null ? s.startTime + delayMs : null,
        };
      }
      if (pushAll && i > startIdx && s.startTime != null) {
        return { ...s, startTime: s.startTime + delayMs };
      }
      return s;
    });

    updateStarts(newStarts);
    setRecallStartId(null);
  };

  return (
    <div className="start-tab">
      {recallStartId && (
        <RecallDialog
          starts={starts}
          recallStartId={recallStartId}
          onConfirm={confirmRecall}
          onCancel={() => setRecallStartId(null)}
        />
      )}

      {starts.map((start, i) => (
        <StartCard
          key={start.id}
          start={start}
          startIndex={i}
          raceBoats={raceBoats}
          allBoats={boats}
          allClasses={allClasses}
          onUpdateStart={updateStart}
          onUpdateBoatStatus={updateBoatStatus}
          onRecall={handleRecall}
        />
      ))}

      {starts.length === 0 && !creatingStart && (
        <div className="races-empty-state">
          <p>No starts yet</p>
        </div>
      )}

      {creatingStart ? (
        <CreateStartForm
          existingStarts={starts}
          availableClasses={unassignedClasses.length > 0 ? unassignedClasses : allClasses}
          onSave={addStart}
          onCancel={() => setCreatingStart(false)}
        />
      ) : (
        <button className="btn btn-primary" onClick={() => setCreatingStart(true)}>
          + Add Start
        </button>
      )}
    </div>
  );
}
