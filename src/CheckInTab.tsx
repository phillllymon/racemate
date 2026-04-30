import { useState } from "react";
import { useRaces } from "./RaceContext";
import type { Boat } from "./RaceContext";
import type { RaceBoatEntry } from "./api";
import SearchBar from "./SearchBar";

export default function CheckInTab() {
  const { selectedRace, updateBoatInRace, boats } = useRaces();
  const [search, setSearch] = useState("");
  const [hideCheckedIn, setHideCheckedIn] = useState(false);
  const [checkedInOpen, setCheckedInOpen] = useState(false);

  if (!selectedRace) {
    return (
      <div className="tab-placeholder">
        <p>Select a race in the Series tab</p>
      </div>
    );
  }

  const raceBoats: RaceBoatEntry[] = (selectedRace.info.boats || []) as RaceBoatEntry[];
  const getBoat = (id: number): Boat | undefined => boats.find((b) => b.id === id);

  const isCheckedIn = (rb: RaceBoatEntry) => rb.status === "checked-in" || rb.status === "racing";

  const checkIn = (boatId: number) => {
    updateBoatInRace(selectedRace.id, boatId, (b) => ({ ...b, status: "checked-in" }));
  };

  const uncheckIn = (boatId: number) => {
    updateBoatInRace(selectedRace.id, boatId, (b) => ({ ...b, status: "registered" }));
  };

  // Filter boats by search query
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

  // Search results: all boats matching search, minus checked-in if hidden
  const searchResults = raceBoats
    .filter(matchesSearch)
    .filter((rb) => hideCheckedIn ? !isCheckedIn(rb) : true);

  // Checked-in section: always all checked-in boats (search-filtered)
  const displayCheckedIn = checkedIn.filter(matchesSearch);

  return (
    <div className="checkin-tab">
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search boats..."
      />

      {/* Stats bar */}
      <div className="checkin-stats">
        <span className="checkin-stats-count">
          {checkedIn.length} / {raceBoats.length} checked in
        </span>
        <label className="finish-hide-toggle">
          <input
            type="checkbox"
            checked={hideCheckedIn}
            onChange={(e) => setHideCheckedIn(e.target.checked)}
          />
          <span>Hide checked in</span>
        </label>
      </div>

      {/* Search results */}
      <div className="checkin-list">
        {searchResults.length === 0 && raceBoats.length > 0 && (
          <p className="races-empty">{search.trim() ? "No matching boats" : "All boats are checked in"}</p>
        )}
        {searchResults.map((rb) => {
          const boat = getBoat(rb.boatId);
          const checked = isCheckedIn(rb);
          return (
            <div key={rb.boatId} className="finish-search-entry">
              <div className={`finish-search-item ${checked ? "finish-search-item--finished" : ""}`}>
                <div className="finish-search-item-main" style={{ padding: "0.5rem" }}>
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

      {/* Checked in section */}
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
                    <div className="finish-search-item-main" style={{ padding: "0.5rem" }}>
                      <div className="finish-search-item-info">
                        <span className="checkin-boat-name">{boat?.name || `Boat #${rb.boatId}`}</span>
                        {boat?.info.sailNumber && (
                          <span className="checkin-boat-sail">{boat.info.sailNumber}</span>
                        )}
                        <span className="checkin-boat-class">{rb.class}</span>
                      </div>
                      <span className="finish-search-item-status" style={{ color: "#4ade80" }}>✓</span>
                    </div>
                    <button className="checkin-action-btn checkin-action-btn--undo" onClick={() => uncheckIn(rb.boatId)}>
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
