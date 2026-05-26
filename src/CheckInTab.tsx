import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRaces } from "./RaceContext";
import type { Boat } from "./RaceContext";
import type { BoatInfo, RaceBoatEntry } from "./api";
import SearchBar from "./SearchBar";

// ---- Rapid Register form ----

function RapidRegister({
  classes,
  onSubmit,
}: {
  classes: string[];
  onSubmit: (name: string, sailNumber: string, className: string) => void;
}) {
  const [name, setName] = useState("");
  const [sailNumber, setSailNumber] = useState("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const canSubmit = !!selectedClass && (name.trim() !== "" || sailNumber.trim() !== "");

  const handleSubmit = () => {
    if (!canSubmit || !selectedClass) return;
    onSubmit(name, sailNumber, selectedClass);
    setName("");
    setSailNumber("");
    nameRef.current?.focus();
  };

  const appendDigit = (d: string) => setSailNumber((prev) => prev + d);
  const backspace = () => setSailNumber((prev) => prev.slice(0, -1));

  const useGrid = classes.length > 5;

  return (
    <div className="rapid-register">
      <button className="btn btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
        Submit
      </button>

      <div className={`rapid-classes ${useGrid ? "rapid-classes--grid" : "rapid-classes--row"}`}>
        {classes.map((cls) => (
          <button
            key={cls}
            className={`rapid-class-btn ${selectedClass === cls ? "rapid-class-btn--active" : ""}`}
            onClick={() => setSelectedClass(selectedClass === cls ? null : cls)}
          >
            {cls}
          </button>
        ))}
      </div>

      <input
        ref={nameRef}
        className="login-input"
        placeholder="Boat name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        autoFocus
      />

      <div className="rapid-sail-row">
        <input
          className="login-input rapid-sail-input"
          placeholder="Sail number / note"
          value={sailNumber}
          onChange={(e) => setSailNumber(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        />
        <button
          className="rapid-backspace"
          onClick={backspace}
          disabled={sailNumber.length === 0}
          tabIndex={-1}
        >
          ←
        </button>
      </div>

      <div className="rapid-numpad">
        {["1","2","3","4","5","6","7","8","9","0"].map((d) => (
          <button key={d} className="rapid-numpad-btn" onClick={() => appendDigit(d)} tabIndex={-1}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Edit boat modal ----

function EditBoatModal({
  boat,
  entry,
  classes,
  onSave,
  onDelete,
  onClose,
}: {
  boat: Boat;
  entry: RaceBoatEntry;
  classes: string[];
  onSave: (name: string, sailNumber: string, className: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(boat.name);
  const [sailNumber, setSailNumber] = useState(boat.info.sailNumber || "");
  const [selectedClass, setSelectedClass] = useState(entry.class);

  const canSave = name.trim() !== "" || sailNumber.trim() !== "";
  const useGrid = classes.length > 5;

  const modal = (
    <div className="edit-boat-overlay" onClick={onClose}>
      <div className="edit-boat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-title">Edit Boat</div>
        <input
          className="login-input"
          placeholder="Boat name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <input
          className="login-input"
          placeholder="Sail number / note"
          value={sailNumber}
          onChange={(e) => setSailNumber(e.target.value)}
        />
        {classes.length > 0 && (
          <div className={`rapid-classes ${useGrid ? "rapid-classes--grid" : "rapid-classes--row"}`}>
            {classes.map((cls) => (
              <button
                key={cls}
                className={`rapid-class-btn ${selectedClass === cls ? "rapid-class-btn--active" : ""}`}
                onClick={() => setSelectedClass(cls)}
              >
                {cls}
              </button>
            ))}
          </div>
        )}
        <div className="races-form-actions">
          <button
            className="btn btn-primary"
            disabled={!canSave}
            onClick={() => onSave(name, sailNumber, selectedClass)}
          >
            Save
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
        <button className="btn rapid-delete-btn" onClick={onDelete}>
          Delete from Race
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ---- Main component ----

export default function CheckInTab() {
  const {
    selectedRace,
    updateBoatInRace,
    updateBoatsInRace,
    boats,
    createBoat,
    addBoatToRace,
    updateBoatData,
  } = useRaces();

  const [search, setSearch] = useState("");
  const [hideCheckedIn, setHideCheckedIn] = useState(false);
  const [checkedInOpen, setCheckedInOpen] = useState(false);
  const [rapidMode, setRapidMode] = useState(false);
  const [rapidListOpen, setRapidListOpen] = useState(true);
  const [rapidSearch, setRapidSearch] = useState("");
  const [editingEntry, setEditingEntry] = useState<{ entry: RaceBoatEntry; boat: Boat } | null>(null);

  if (!selectedRace) {
    return (
      <div className="tab-placeholder">
        <p>Select a race in the Series tab</p>
      </div>
    );
  }

  const raceBoats: RaceBoatEntry[] = (selectedRace.info.boats || []) as RaceBoatEntry[];
  const getBoat = (id: number): Boat | undefined => boats.find((b) => b.id === id);

  const persistedEmpty = (selectedRace.info.emptyClasses as string[] | undefined) || [];
  const allClasses = Array.from(new Set([
    ...persistedEmpty,
    ...raceBoats.map((rb) => rb.class).filter(Boolean),
  ]));

  const isCheckedIn = (rb: RaceBoatEntry) => rb.status === "checked-in" || rb.status === "racing";

  const checkIn = (boatId: number) => {
    updateBoatInRace(selectedRace.id, boatId, (b) => ({ ...b, status: "checked-in" }));
  };

  const uncheckIn = (boatId: number) => {
    updateBoatInRace(selectedRace.id, boatId, (b) => ({ ...b, status: "registered" }));
  };

  const handleRapidSubmit = (name: string, sailNumber: string, className: string) => {
    const raceId = selectedRace.id;
    const boatName = name.trim() || sailNumber.trim();
    const info: BoatInfo = { name: boatName };
    if (sailNumber.trim()) info.sailNumber = sailNumber.trim();

    const starts = selectedRace.info.starts || [];
    const now = Date.now();
    const classHasStarted = starts.some(
      (s) => s.classes.includes(className) && s.startTime != null && Number(s.startTime) <= now
    );
    const status = classHasStarted ? "racing" : "checked-in";

    createBoat(boatName, info).then((newBoat) => {
      addBoatToRace(raceId, { boatId: newBoat.id, class: className, status });
    });
  };

  const handleEditSave = (name: string, sailNumber: string, className: string) => {
    if (!editingEntry) return;
    const { boat, entry } = editingEntry;
    const boatName = name.trim() || sailNumber.trim();
    const updatedInfo: BoatInfo = { ...boat.info, name: boatName };
    if (sailNumber.trim()) {
      updatedInfo.sailNumber = sailNumber.trim();
    } else {
      delete updatedInfo.sailNumber;
    }
    updateBoatData(boat.id, boatName, updatedInfo);
    if (className !== entry.class) {
      updateBoatInRace(selectedRace.id, boat.id, (b) => ({ ...b, class: className }));
    }
    setEditingEntry(null);
  };

  const handleDeleteFromRace = () => {
    if (!editingEntry) return;
    const boatId = editingEntry.boat.id;
    updateBoatsInRace(selectedRace.id, (boats) => boats.filter((b) => b.boatId !== boatId));
    setEditingEntry(null);
  };

  const openEdit = (rb: RaceBoatEntry) => {
    const boat = getBoat(rb.boatId);
    if (boat) setEditingEntry({ entry: rb, boat });
  };

  // ---- Rapid mode ----

  if (rapidMode) {
    const reversedBoats = [...raceBoats].reverse();
    const filteredBoats = rapidSearch.trim()
      ? reversedBoats.filter((rb) => {
          const boat = getBoat(rb.boatId);
          const q = rapidSearch.toLowerCase();
          return (
            (boat?.name || "").toLowerCase().includes(q) ||
            (boat?.info.sailNumber || "").toLowerCase().includes(q) ||
            (rb.class || "").toLowerCase().includes(q)
          );
        })
      : reversedBoats;

    return (
      <div className="checkin-tab checkin-tab--rapid">
        {editingEntry && (
          <EditBoatModal
            boat={editingEntry.boat}
            entry={editingEntry.entry}
            classes={allClasses}
            onSave={handleEditSave}
            onDelete={handleDeleteFromRace}
            onClose={() => setEditingEntry(null)}
          />
        )}
        <div className="rapid-mode-header">
          <button className="rapid-back-btn" onClick={() => setRapidMode(false)}>← Back</button>
          <span className="rapid-mode-title">Rapid Register</span>
          <span className="rapid-mode-count">{raceBoats.length} registered</span>
        </div>
        <RapidRegister classes={allClasses} onSubmit={handleRapidSubmit} />
        <div className="rapid-boat-section">
          <button className="checkin-done-header" onClick={() => setRapidListOpen(!rapidListOpen)}>
            <span className="checkin-done-title">Registered ({raceBoats.length})</span>
            <span className={`race-card-chevron ${rapidListOpen ? "race-card-chevron--open" : ""}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </span>
          </button>
          {rapidListOpen && (
            <>
              <SearchBar value={rapidSearch} onChange={setRapidSearch} placeholder="Search boats..." />
              <div className="rapid-boat-list">
                {filteredBoats.map((rb) => {
                  const boat = getBoat(rb.boatId);
                  return (
                    <div key={rb.boatId} className="rapid-boat-item" onClick={() => openEdit(rb)}>
                      <div className="rapid-boat-item-info">
                        <span className="rapid-boat-item-name">{boat?.name || `Boat #${rb.boatId}`}</span>
                        {boat?.info.sailNumber && (
                          <span className="rapid-boat-item-sail">{boat.info.sailNumber}</span>
                        )}
                      </div>
                      <span className="rapid-boat-item-class">{rb.class}</span>
                    </div>
                  );
                })}
                {raceBoats.length === 0 && (
                  <p className="races-empty">No boats registered yet</p>
                )}
                {raceBoats.length > 0 && filteredBoats.length === 0 && (
                  <p className="races-empty">No matching boats</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- Normal mode ----

  const matchesSearch = (rb: RaceBoatEntry): boolean => {
    if (!search.trim()) return true;
    const boat = getBoat(rb.boatId);
    if (!boat) return false;
    const q = search.toLowerCase();
    return (
      boat.name.toLowerCase().includes(q) ||
      (boat.info.sailNumber || "").toLowerCase().includes(q) ||
      (boat.info.skipper || "").toLowerCase().includes(q) ||
      (boat.info.type || "").toLowerCase().includes(q) ||
      (rb.class || "").toLowerCase().includes(q)
    );
  };

  const checkedIn = raceBoats.filter((rb) => isCheckedIn(rb));
  const searchResults = raceBoats
    .filter(matchesSearch)
    .filter((rb) => (hideCheckedIn ? !isCheckedIn(rb) : true));
  const displayCheckedIn = checkedIn.filter(matchesSearch);

  return (
    <div className="checkin-tab">
      {editingEntry && (
        <EditBoatModal
          boat={editingEntry.boat}
          entry={editingEntry.entry}
          classes={allClasses}
          onSave={handleEditSave}
          onDelete={handleDeleteFromRace}
          onClose={() => setEditingEntry(null)}
        />
      )}

      <SearchBar value={search} onChange={setSearch} placeholder="Search boats..." />

      <div className="checkin-stats">
        <span className="checkin-stats-count">
          {checkedIn.length} / {raceBoats.length} checked in
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label className="finish-hide-toggle">
            <input
              type="checkbox"
              checked={hideCheckedIn}
              onChange={(e) => setHideCheckedIn(e.target.checked)}
            />
            <span>Hide checked in</span>
          </label>
          <button className="rapid-mode-toggle-btn" onClick={() => setRapidMode(true)}>
            Rapid Register
          </button>
        </div>
      </div>

      <div className="checkin-list">
        {searchResults.length === 0 && raceBoats.length > 0 && (
          <p className="races-empty">
            {search.trim() ? "No matching boats" : "All boats are checked in"}
          </p>
        )}
        {searchResults.map((rb) => {
          const boat = getBoat(rb.boatId);
          const checked = isCheckedIn(rb);
          return (
            <div key={rb.boatId} className="finish-search-entry">
              <div className={`finish-search-item ${checked ? "finish-search-item--finished" : ""}`}>
                <div className="finish-search-item-main" onClick={() => openEdit(rb)}>
                  <div className="finish-search-item-info">
                    <span className="checkin-boat-name">{boat?.name || `Boat #${rb.boatId}`}</span>
                    {boat?.info.sailNumber && (
                      <span className="checkin-boat-sail">{boat.info.sailNumber}</span>
                    )}
                    <span className="checkin-boat-class">{rb.class}</span>
                  </div>
                  {checked && (
                    <span className="finish-search-item-status" style={{ color: "#4ade80" }}>✓</span>
                  )}
                </div>
                {checked ? (
                  <button className="checkin-action-btn checkin-action-btn--undo" onClick={() => uncheckIn(rb.boatId)}>
                    Undo
                  </button>
                ) : (
                  <button className="checkin-action-btn checkin-action-btn--in" onClick={() => checkIn(rb.boatId)}>
                    Check In
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="checkin-done-section">
        <button className="checkin-done-header" onClick={() => setCheckedInOpen(!checkedInOpen)}>
          <span className="checkin-done-title">Checked In ({checkedIn.length})</span>
          <span className={`race-card-chevron ${checkedInOpen ? "race-card-chevron--open" : ""}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        </button>
        {checkedInOpen && (
          <div className="checkin-done-list">
            {displayCheckedIn.length === 0 && checkedIn.length > 0 && hideCheckedIn && (
              <p className="races-empty">Hidden — uncheck "Hide checked in" to view</p>
            )}
            {displayCheckedIn.length === 0 && checkedIn.length === 0 && (
              <p className="races-empty">No boats checked in yet</p>
            )}
            {displayCheckedIn.map((rb) => {
              const boat = getBoat(rb.boatId);
              return (
                <div key={rb.boatId} className="finish-search-entry">
                  <div className="finish-search-item finish-search-item--finished">
                    <div className="finish-search-item-main" onClick={() => openEdit(rb)}>
                      <div className="finish-search-item-info">
                        <span className="checkin-boat-name">{boat?.name || `Boat #${rb.boatId}`}</span>
                        {boat?.info.sailNumber && (
                          <span className="checkin-boat-sail">{boat.info.sailNumber}</span>
                        )}
                        <span className="checkin-boat-class">{rb.class}</span>
                      </div>
                      <span className="finish-search-item-status" style={{ color: "#4ade80" }}>✓</span>
                    </div>
                    <button
                      className="checkin-action-btn checkin-action-btn--undo"
                      onClick={() => uncheckIn(rb.boatId)}
                    >
                      Undo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
