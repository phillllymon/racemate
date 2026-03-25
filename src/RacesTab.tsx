import { useState } from "react";
import { useRaces } from "./RaceContext";
import type { Race, Series, Boat } from "./RaceContext";
import type { BoatInfo, RaceBoatEntry } from "./api";

// ---- Edit boat overlay ----

function EditBoatForm({
  boat,
  raceId,
  raceEntry,
  onDone,
}: {
  boat: Boat;
  raceId: number;
  raceEntry: RaceBoatEntry;
  onDone: () => void;
}) {
  const { updateRaceData, updateBoatData, races } = useRaces();
  const race = races.find((r) => r.id === raceId)!;

  const [name, setName] = useState(boat.info.name || boat.name);
  const [sailNumber, setSailNumber] = useState(boat.info.sailNumber || "");
  const [boatClass, setBoatClass] = useState(raceEntry.class || "");
  const [boatType, setBoatType] = useState(boat.info.type || "");
  const [skipper, setSkipper] = useState(boat.info.skipper || "");
  const [phrf, setPhrf] = useState(boat.info.phrf != null ? String(boat.info.phrf) : "");

  // Get existing classes in this race for quick-pick
  const existingClasses = Array.from(
    new Set((race.info.boats || []).map((b) => b.class).filter(Boolean))
  );

  const save = () => {
    // Update the boat's class in the race entry
    const updatedBoats = (race.info.boats || []).map((b) => {
      if (b.boatId !== boat.id) return b;
      return { ...b, class: boatClass.trim() || "Default" };
    });
    updateRaceData(raceId, race.name, { ...race.info, boats: updatedBoats });

    // Update the boat record in the database
    const updatedInfo: BoatInfo = {
      ...boat.info,
      name: name.trim() || boat.name,
    };
    if (sailNumber.trim()) updatedInfo.sailNumber = sailNumber.trim();
    else delete updatedInfo.sailNumber;
    if (boatType.trim()) updatedInfo.type = boatType.trim();
    else delete updatedInfo.type;
    if (skipper.trim()) updatedInfo.skipper = skipper.trim();
    else delete updatedInfo.skipper;
    if (boatClass.trim()) updatedInfo.class = boatClass.trim();
    else delete updatedInfo.class;
    if (phrf.trim() && !isNaN(Number(phrf))) updatedInfo.phrf = Number(phrf);
    else delete updatedInfo.phrf;

    updateBoatData(boat.id, name.trim() || boat.name, updatedInfo);
    onDone();
  };

  return (
    <div className="races-form">
      <div className="edit-boat-title">Edit: {boat.name}</div>
      <input className="login-input" placeholder="Boat name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="login-input" placeholder="Sail number" value={sailNumber} onChange={(e) => setSailNumber(e.target.value)} />
      <input className="login-input" placeholder="Skipper" value={skipper} onChange={(e) => setSkipper(e.target.value)} />
      <input className="login-input" placeholder="Boat type" value={boatType} onChange={(e) => setBoatType(e.target.value)} />
      <input className="login-input" placeholder="PHRF rating" value={phrf} onChange={(e) => setPhrf(e.target.value)} inputMode="numeric" />

      <div className="edit-class-section">
        <input className="login-input" placeholder="Class" value={boatClass} onChange={(e) => setBoatClass(e.target.value)} />
        {existingClasses.length > 0 && (
          <div className="edit-class-picks">
            {existingClasses.map((cls) => (
              <button
                key={cls}
                className={`edit-class-chip ${cls === boatClass ? "edit-class-chip--active" : ""}`}
                onClick={() => setBoatClass(cls)}
              >
                {cls}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="races-form-actions">
        <button className="btn btn-primary" onClick={save}>Save</button>
        <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Create series form ----

function CreateSeriesForm({ onDone }: { onDone: () => void }) {
  const { createSeries } = useRaces();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await createSeries(name.trim());
    setName("");
    setBusy(false);
    onDone();
  };

  return (
    <div className="races-form">
      <input
        className="login-input"
        placeholder="Series name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="races-form-actions">
        <button className="btn btn-primary" onClick={submit} disabled={busy || !name.trim()}>
          {busy ? "..." : "Create Series"}
        </button>
        <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Create race form ----

function CreateRaceForm({ seriesId, onDone }: { seriesId: number | null; onDone: () => void }) {
  const { createRace } = useRaces();
  const [name, setName] = useState("");
  const [autoCheckIn, setAutoCheckIn] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await createRace(name.trim(), seriesId, { autoCheckIn });
    setName("");
    setBusy(false);
    onDone();
  };

  return (
    <div className="races-form">
      <input
        className="login-input"
        placeholder="Race name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className="races-checkbox">
        <input
          type="checkbox"
          checked={autoCheckIn}
          onChange={(e) => setAutoCheckIn(e.target.checked)}
        />
        <span>Auto check-in boats</span>
      </label>
      <div className="races-form-actions">
        <button className="btn btn-primary" onClick={submit} disabled={busy || !name.trim()}>
          {busy ? "..." : "Create Race"}
        </button>
        <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Add boat form ----

function AddBoatForm({ raceId, onDone }: { raceId: number; onDone: () => void }) {
  const { races, boats, createBoat, updateRaceData } = useRaces();
  const race = races.find((r) => r.id === raceId)!;

  const [mode, setMode] = useState<"choose" | "new" | "existing">("choose");
  const [name, setName] = useState("");
  const [sailNumber, setSailNumber] = useState("");
  const [boatClass, setBoatClass] = useState("");
  const [boatType, setBoatType] = useState("");
  const [phrf, setPhrf] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const existingBoatIds = (race.info.boats || []).map((b) => b.boatId);

  const filteredExisting = boats.filter((b) => {
    if (existingBoatIds.includes(b.id)) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const info = b.info;
    return (
      b.name.toLowerCase().includes(s) ||
      (info.sailNumber || "").toLowerCase().includes(s) ||
      (info.type || "").toLowerCase().includes(s) ||
      (info.class || "").toLowerCase().includes(s) ||
      (info.skipper || "").toLowerCase().includes(s)
    );
  });

  const addBoatToRace = (boatId: number, cls: string) => {
    const entry: RaceBoatEntry = {
      boatId,
      class: cls || "Default",
      status: race.info.autoCheckIn ? "checked-in" : "signed-up",
    };
    const updatedInfo = {
      ...race.info,
      boats: [...(race.info.boats || []), entry],
    };
    updateRaceData(raceId, race.name, updatedInfo);
  };

  const submitNew = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const info: BoatInfo = { name: name.trim() };
    if (sailNumber.trim()) info.sailNumber = sailNumber.trim();
    if (boatType.trim()) info.type = boatType.trim();
    if (boatClass.trim()) info.class = boatClass.trim();
    if (phrf.trim()) info.phrf = Number(phrf);

    const boat = await createBoat(name.trim(), info);
    addBoatToRace(boat.id, boatClass.trim() || "Default");

    // Clear form and go back to list automatically
    setName("");
    setSailNumber("");
    setBoatClass("");
    setBoatType("");
    setPhrf("");
    setBusy(false);
    onDone();
  };

  const addExisting = (boat: { id: number; info: BoatInfo }) => {
    addBoatToRace(boat.id, boat.info.class || "Default");
    // Stay in existing mode so user can keep adding
  };

  if (mode === "choose") {
    return (
      <div className="races-form">
        <button className="btn btn-primary" onClick={() => setMode("new")}>
          Add New Boat
        </button>
        {boats.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setMode("existing")}>
            Add from Database
          </button>
        )}
        <button className="btn btn-secondary" onClick={onDone}>Done</button>
      </div>
    );
  }

  if (mode === "existing") {
    return (
      <div className="races-form">
        <input
          className="login-input"
          placeholder="Search boats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="races-boat-list">
          {filteredExisting.length === 0 && (
            <p className="races-empty">No matching boats found</p>
          )}
          {filteredExisting.map((boat) => (
            <button
              key={boat.id}
              className="races-boat-item"
              onClick={() => addExisting(boat)}
            >
              <span className="races-boat-name">{boat.name}</span>
              <span className="races-boat-detail">
                {[boat.info.sailNumber, boat.info.type, boat.info.class]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </div>
        <div className="races-form-actions">
          <button className="btn btn-secondary" onClick={() => setMode("choose")}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="races-form">
      <input className="login-input" placeholder="Boat name *" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="login-input" placeholder="Sail number" value={sailNumber} onChange={(e) => setSailNumber(e.target.value)} />
      <input className="login-input" placeholder="Class" value={boatClass} onChange={(e) => setBoatClass(e.target.value)} />
      <input className="login-input" placeholder="Boat type" value={boatType} onChange={(e) => setBoatType(e.target.value)} />
      <input className="login-input" placeholder="PHRF rating" value={phrf} onChange={(e) => setPhrf(e.target.value)} inputMode="numeric" />
      <div className="races-form-actions">
        <button className="btn btn-primary" onClick={submitNew} disabled={busy || !name.trim()}>
          {busy ? "..." : "Add Boat"}
        </button>
        <button className="btn btn-secondary" onClick={() => setMode("choose")}>Back</button>
      </div>
    </div>
  );
}

// ---- Race card ----

function RaceCard({ race, onSelect }: { race: Race; onSelect: () => void }) {
  const { selectedRaceId, selectRace, updateRaceData, boats } = useRaces();
  const [expanded, setExpanded] = useState(false);
  const [addingBoat, setAddingBoat] = useState(false);
  const [editingBoatId, setEditingBoatId] = useState<number | null>(null);
  const [editingRace, setEditingRace] = useState(false);
  const [editName, setEditName] = useState(race.name);
  const [editAutoCheckIn, setEditAutoCheckIn] = useState(race.info.autoCheckIn ?? true);
  const [editClassLaps, setEditClassLaps] = useState<Record<string, number>>({});
  const isSelected = selectedRaceId === race.id;
  const raceBoats = race.info.boats || [];

  // Group by class
  const byClass = new Map<string, RaceBoatEntry[]>();
  raceBoats.forEach((entry) => {
    const cls = entry.class || "Default";
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls)!.push(entry);
  });

  const getBoat = (boatId: number): Boat | undefined => {
    return boats.find((bt) => bt.id === boatId);
  };

  const removeBoat = (boatId: number) => {
    const updatedInfo = {
      ...race.info,
      boats: raceBoats.filter((b) => b.boatId !== boatId),
    };
    updateRaceData(race.id, race.name, updatedInfo);
    if (editingBoatId === boatId) setEditingBoatId(null);
  };

  const saveRaceEdit = () => {
    updateRaceData(race.id, editName.trim() || race.name, {
      ...race.info,
      name: editName.trim() || race.name,
      autoCheckIn: editAutoCheckIn,
      classLaps: editClassLaps,
    });
    setEditingRace(false);
  };

  const startEditingRace = () => {
    setEditName(race.name);
    setEditAutoCheckIn(race.info.autoCheckIn ?? true);
    const existing = (race.info.classLaps || {}) as Record<string, number>;
    const laps: Record<string, number> = {};
    Array.from(byClass.keys()).forEach((cls) => {
      laps[cls] = existing[cls] || 1;
    });
    setEditClassLaps(laps);
    setEditingRace(true);
  };

  const editingBoat = editingBoatId != null ? getBoat(editingBoatId) : undefined;
  const editingEntry = editingBoatId != null
    ? raceBoats.find((b) => b.boatId === editingBoatId)
    : undefined;

  return (
    <div className={`race-card ${isSelected ? "race-card--selected" : ""}`}>
      <div className="race-card-header">
        <button className="race-card-header-toggle" onClick={() => setExpanded(!expanded)}>
          <span className="race-card-name">{race.name}</span>
          <span className="race-card-count">{raceBoats.length} boat{raceBoats.length !== 1 ? "s" : ""}</span>
          <span className={`race-card-chevron ${expanded ? "race-card-chevron--open" : ""}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        </button>
        {expanded && !editingRace && (
          <button className="card-edit-btn" onClick={startEditingRace} aria-label="Edit race">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="race-card-body">
          {!isSelected && (
            <button className="btn btn-primary" onClick={() => { selectRace(race.id); onSelect(); }}>
              Select This Race
            </button>
          )}
          {isSelected && (
            <div className="race-card-selected-badge">● Active Race</div>
          )}

          {editingRace ? (
            <div className="races-form">
              <div className="edit-boat-title">Edit Race</div>
              <input
                className="login-input"
                placeholder="Race name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <label className="races-checkbox">
                <input
                  type="checkbox"
                  checked={editAutoCheckIn}
                  onChange={(e) => setEditAutoCheckIn(e.target.checked)}
                />
                <span>Auto check-in boats</span>
              </label>
              {Object.keys(editClassLaps).length > 0 && (
                <div className="edit-laps-section">
                  <div className="start-classes-label">Laps per class:</div>
                  {Object.entries(editClassLaps).map(([cls, laps]) => (
                    <div key={cls} className="results-factor-row">
                      <span className="results-factor-class">{cls}</span>
                      <div className="results-factor-controls">
                        <button
                          className="staged-time-adj"
                          onClick={() => setEditClassLaps((prev) => ({ ...prev, [cls]: Math.max(1, laps - 1) }))}
                        >
                          −
                        </button>
                        <span className="results-factor-value">{laps}</span>
                        <button
                          className="staged-time-adj"
                          onClick={() => setEditClassLaps((prev) => ({ ...prev, [cls]: laps + 1 }))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="races-form-actions">
                <button className="btn btn-primary" onClick={saveRaceEdit}>Save</button>
                <button className="btn btn-secondary" onClick={() => setEditingRace(false)}>Cancel</button>
              </div>
            </div>
          ) : editingBoat && editingEntry ? (
            <EditBoatForm
              boat={editingBoat}
              raceId={race.id}
              raceEntry={editingEntry}
              onDone={() => setEditingBoatId(null)}
            />
          ) : (
            <>
              {Array.from(byClass.entries()).map(([cls, entries]) => (
                <div key={cls} className="race-class-group">
                  <div className="race-class-header">{cls}</div>
                  {entries.map((entry) => {
                    const boat = getBoat(entry.boatId);
                    return (
                      <div key={entry.boatId} className="race-boat-row">
                        <button
                          className="race-boat-row-info"
                          onClick={() => setEditingBoatId(entry.boatId)}
                        >
                          <span className="race-boat-row-name">
                            {boat ? boat.name : `Boat #${entry.boatId}`}
                          </span>
                          {boat?.info.sailNumber && (
                            <span className="race-boat-row-sail">{boat.info.sailNumber}</span>
                          )}
                        </button>
                        <span className="race-boat-row-status">{entry.status}</span>
                        <button
                          className="race-boat-row-remove"
                          onClick={() => removeBoat(entry.boatId)}
                          aria-label="Remove boat from race"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}

              {raceBoats.length === 0 && !addingBoat && (
                <p className="races-empty">No boats yet</p>
              )}

              {addingBoat ? (
                <AddBoatForm raceId={race.id} onDone={() => setAddingBoat(false)} />
              ) : (
                <button className="btn btn-secondary" onClick={() => setAddingBoat(true)}>
                  + Add Boats
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Series card ----

function SeriesCard({ s }: { s: Series }) {
  const { races, selectRace, updateSeriesData } = useRaces();
  const [expanded, setExpanded] = useState(false);
  const [addingRace, setAddingRace] = useState(false);
  const [editingSeries, setEditingSeries] = useState(false);
  const [editName, setEditName] = useState(s.name);

  const seriesRaces = s.info.raceIds
    .map((id) => races.find((r) => r.id === id))
    .filter(Boolean) as Race[];

  const saveSeriesEdit = () => {
    const newName = editName.trim() || s.name;
    updateSeriesData(s.id, newName, { ...s.info, name: newName });
    setEditingSeries(false);
  };

  const startEditingSeries = () => {
    setEditName(s.name);
    setEditingSeries(true);
  };

  return (
    <div className="series-card">
      <div className="series-card-header">
        <button className="race-card-header-toggle" onClick={() => setExpanded(!expanded)}>
          <span className="series-card-name">{s.name}</span>
          <span className="series-card-count">{seriesRaces.length} race{seriesRaces.length !== 1 ? "s" : ""}</span>
          <span className={`race-card-chevron ${expanded ? "race-card-chevron--open" : ""}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        </button>
        {expanded && !editingSeries && (
          <button className="card-edit-btn" onClick={startEditingSeries} aria-label="Edit series">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="series-card-body">
          {editingSeries ? (
            <div className="races-form">
              <div className="edit-boat-title">Edit Series</div>
              <input
                className="login-input"
                placeholder="Series name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <div className="races-form-actions">
                <button className="btn btn-primary" onClick={saveSeriesEdit}>Save</button>
                <button className="btn btn-secondary" onClick={() => setEditingSeries(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {seriesRaces.map((race) => (
                <RaceCard key={race.id} race={race} onSelect={() => selectRace(race.id)} />
              ))}

              {seriesRaces.length === 0 && !addingRace && (
                <p className="races-empty">No races in this series yet</p>
              )}

              {addingRace ? (
                <CreateRaceForm seriesId={s.id} onDone={() => setAddingRace(false)} />
              ) : (
                <button className="btn btn-secondary" onClick={() => setAddingRace(true)}>
                  + Add Race
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main tab ----

export default function RacesTab() {
  const { series, loading } = useRaces();
  const [showForm, setShowForm] = useState<"none" | "series" | "race">("none");

  if (loading) {
    return <div className="tab-placeholder"><p>Loading...</p></div>;
  }

  return (
    <div className="races-tab">
      <div className="races-actions">
        <button className="btn btn-primary" onClick={() => setShowForm("series")}>
          New Series
        </button>
        <button className="btn btn-secondary" onClick={() => setShowForm("race")}>
          Quick Race
        </button>
      </div>

      {showForm === "series" && (
        <CreateSeriesForm onDone={() => setShowForm("none")} />
      )}
      {showForm === "race" && (
        <CreateRaceForm seriesId={null} onDone={() => setShowForm("none")} />
      )}

      {series.length === 0 && showForm === "none" && (
        <div className="races-empty-state">
          <p>No races yet</p>
          <p className="races-empty-hint">Create a series or a quick race to get started</p>
        </div>
      )}

      {series.map((s) => (
        <SeriesCard key={s.id} s={s} />
      ))}
    </div>
  );
}
