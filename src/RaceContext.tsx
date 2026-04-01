import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  addRace, updateRace, getRacesByColumn, deleteRace,
  addSeries, updateSeries, getSeriesByColumn, deleteSeries,
  addBoat, updateBoat, getBoatsByColumn,
} from "./api";
import type {
  RaceRecord, SeriesRecord, BoatRecord,
  RaceInfo, SeriesInfo, BoatInfo,
} from "./api";

// ---- Parsed types ----

export interface Race {
  id: number;
  name: string;
  info: RaceInfo;
}

export interface Series {
  id: number;
  name: string;
  info: SeriesInfo;
}

export interface Boat {
  id: number;
  name: string;
  info: BoatInfo;
}

function parseRecord<T>(rec: { id: number; name: string; info: string }): { id: number; name: string; info: T } {
  let parsed: T;
  try {
    parsed = JSON.parse(rec.info);
  } catch (_e) {
    parsed = {} as T;
  }
  return { id: rec.id, name: rec.name, info: parsed };
}

// ---- Context value ----

interface RaceContextValue {
  // Data
  series: Series[];
  races: Race[];
  boats: Boat[];
  selectedRaceId: number | null;
  selectedRace: Race | null;
  synced: boolean;
  loading: boolean;

  // Actions
  selectRace: (id: number | null) => void;
  createSeries: (name: string, info?: Partial<SeriesInfo>) => Promise<Series>;
  createRace: (name: string, seriesId: number | null, info?: Partial<RaceInfo>) => Promise<Race>;
  createBoat: (name: string, info: BoatInfo) => Promise<Boat>;
  updateBoatData: (boatId: number, name: string, info: BoatInfo) => void;
  updateRaceData: (raceId: number, name: string, info: RaceInfo) => void;
  updateSeriesData: (seriesId: number, name: string, info: SeriesInfo) => void;
  softDeleteBoat: (boatId: number) => void;
  removeRace: (raceId: number) => Promise<void>;
  removeSeries: (seriesId: number) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const RaceContext = createContext<RaceContextValue | null>(null);

export function RaceProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [series, setSeries] = useState<Series[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [synced, setSynced] = useState(true);
  const [loading, setLoading] = useState(true);

  // Sync queue
  const pendingUpdates = useRef<Map<string, () => Promise<unknown>>>(new Map());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending boats: temp ID boats waiting for server confirmation
  const pendingBoatsRef = useRef<Map<number, {
    name: string;
    info: BoatInfo;
    raceIds: number[];
  }>>(new Map());
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const auth = user && token ? { userId: user.id, token } : null;

  // Flush pending updates to backend
  const flush = useCallback(async () => {
    if (pendingUpdates.current.size === 0) {
      setSynced(true);
      return;
    }
    const batch = new Map(pendingUpdates.current);
    pendingUpdates.current.clear();

    try {
      const promises = Array.from(batch.values()).map((fn) => fn());
      await Promise.all(promises);
    } catch (_e) {
      // Re-queue failed updates
      batch.forEach((fn, key) => {
        if (!pendingUpdates.current.has(key)) {
          pendingUpdates.current.set(key, fn);
        }
      });
    }

    if (pendingUpdates.current.size === 0 && pendingBoatsRef.current.size === 0) {
      setSynced(true);
    } else {
      scheduleFlush();
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(flush, 5000);
  }, [flush]);

  const queueUpdate = useCallback((key: string, fn: () => Promise<unknown>) => {
    pendingUpdates.current.set(key, fn);
    setSynced(false);
    scheduleFlush();
  }, [scheduleFlush]);

  // Load all data on mount
  const refreshAll = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const [seriesRes, racesRes, boatsRes] = await Promise.all([
        getSeriesByColumn(auth, "owner", auth.userId),
        getRacesByColumn(auth, "owner", auth.userId),
        getBoatsByColumn(auth, "owner", auth.userId),
      ]);
      setSeries(seriesRes.results.map((r: SeriesRecord) => parseRecord<SeriesInfo>(r)));
      setRaces(racesRes.results.map((r: RaceRecord) => parseRecord<RaceInfo>(r)));
      setBoats(boatsRes.results.map((r: BoatRecord) => parseRecord<BoatInfo>(r)));
    } catch (_e) {
      // Keep existing state on error
    }
    setLoading(false);
  }, [auth?.userId, auth?.token]);

  useEffect(() => {
    refreshAll();
  }, [user?.id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const selectedRace = races.find((r) => r.id === selectedRaceId) || null;

  const createSeries = async (name: string, info?: Partial<SeriesInfo>): Promise<Series> => {
    if (!auth) throw new Error("Not authenticated");
    const seriesInfo: SeriesInfo = { name, raceIds: [], ...info };
    const res = await addSeries(auth, name, seriesInfo);
    const created = parseRecord<SeriesInfo>(res.series[0]);
    setSeries((prev) => [...prev, created]);
    return created;
  };

  const createRace = async (
    name: string,
    seriesId: number | null,
    info?: Partial<RaceInfo>
  ): Promise<Race> => {
    if (!auth) throw new Error("Not authenticated");
    const raceInfo: RaceInfo = { name, boats: [], starts: [], ...info };
    const res = await addRace(auth, name, raceInfo);
    const created = parseRecord<RaceInfo>(res.race[0]);
    setRaces((prev) => [...prev, created]);
    setSelectedRaceId(created.id);

    // If creating inside a series, add raceId to the series
    if (seriesId !== null) {
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const updated = {
            ...s,
            info: { ...s.info, raceIds: [...s.info.raceIds, created.id] },
          };
          queueUpdate(`series-${s.id}`, () =>
            updateSeries(auth, s.id, s.name, updated.info)
          );
          return updated;
        })
      );
    } else {
      // Wrap in a placeholder series
      const seriesName = `${name} Series`;
      const placeholder = await createSeries(seriesName, { raceIds: [created.id] });
      // Update local reference
      setSeries((prev) =>
        prev.map((s) => (s.id === placeholder.id ? { ...s, info: { ...s.info, raceIds: [created.id] } } : s))
      );
    }

    return created;
  };

  const generateTempId = (): number => {
    // Large negative number to avoid collision with real DB IDs
    return -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
  };

  const swapBoatId = useCallback((tempId: number, realId: number) => {
    // 1. Swap in boats array
    setBoats((prev) =>
      prev.map((b) => (b.id === tempId ? { ...b, id: realId } : b))
    );

    // 2. Swap in tracked races only
    const pending = pendingBoatsRef.current.get(tempId);
    if (pending) {
      setRaces((prevRaces) =>
        prevRaces.map((race) => {
          if (!pending.raceIds.includes(race.id)) return race;
          const updatedBoats = (race.info.boats || []).map((rb) =>
            rb.boatId === tempId ? { ...rb, boatId: realId } : rb
          );
          const updatedRace = { ...race, info: { ...race.info, boats: updatedBoats } };
          // Queue the race update to sync the swapped ID to backend
          if (auth) {
            queueUpdate(`race-${race.id}`, () => updateRace(auth, race.id, race.name, updatedRace.info));
          }
          return updatedRace;
        })
      );
      pendingBoatsRef.current.delete(tempId);
    }
  }, [auth, queueUpdate]);

  const retryPendingBoats = useCallback(async () => {
    if (!auth || pendingBoatsRef.current.size === 0) return;

    const entries = Array.from(pendingBoatsRef.current.entries());
    for (const [tempId, { name, info }] of entries) {
      try {
        const res = await addBoat(auth, name, info);
        const created = parseRecord<BoatInfo>(res.boat[0]);
        swapBoatId(tempId, created.id);
      } catch {
        // Still offline, will retry next cycle
      }
    }

    // Schedule another retry if there are still pending boats
    if (pendingBoatsRef.current.size > 0) {
      retryTimerRef.current = setTimeout(retryPendingBoats, 10000);
    } else {
      setSynced(pendingUpdates.current.size === 0);
    }
  }, [auth, swapBoatId]);

  // Track which race a temp boat gets added to
  const trackTempBoatInRace = useCallback((tempId: number, raceId: number) => {
    const entry = pendingBoatsRef.current.get(tempId);
    if (entry && !entry.raceIds.includes(raceId)) {
      entry.raceIds.push(raceId);
    }
  }, []);

  const CREATE_TIMEOUT_MS = 5000;

  const createBoat = async (name: string, info: BoatInfo): Promise<Boat> => {
    if (!auth) {
      // No auth — create temp boat only
      const tempId = generateTempId();
      const tempBoat: Boat = { id: tempId, name, info };
      setBoats((prev) => [...prev, tempBoat]);
      pendingBoatsRef.current.set(tempId, { name, info, raceIds: [] });
      setSynced(false);
      return tempBoat;
    }

    // Try to create with timeout
    try {
      const result = await Promise.race([
        addBoat(auth, name, info),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), CREATE_TIMEOUT_MS)
        ),
      ]);
      const created = parseRecord<BoatInfo>(result.boat[0]);
      setBoats((prev) => [...prev, created]);
      return created;
    } catch {
      // Failed or timed out — use temp ID
      const tempId = generateTempId();
      const tempBoat: Boat = { id: tempId, name, info };
      setBoats((prev) => [...prev, tempBoat]);
      pendingBoatsRef.current.set(tempId, { name, info, raceIds: [] });
      setSynced(false);

      // Start retry cycle if not already running
      if (!retryTimerRef.current) {
        retryTimerRef.current = setTimeout(retryPendingBoats, 10000);
      }

      return tempBoat;
    }
  };

  const updateBoatData = (boatId: number, name: string, info: BoatInfo) => {
    setBoats((prev) =>
      prev.map((b) => (b.id === boatId ? { ...b, name, info } : b))
    );
    if (auth) {
      queueUpdate(`boat-${boatId}`, () => updateBoat(auth, boatId, name, info));
    }
  };

  const updateRaceData = (raceId: number, name: string, info: RaceInfo) => {
    // Track any temp boat IDs being added to this race
    const raceBoats = info.boats || [];
    for (const rb of raceBoats) {
      if (rb.boatId < 0 && pendingBoatsRef.current.has(rb.boatId)) {
        trackTempBoatInRace(rb.boatId, raceId);
      }
    }

    setRaces((prev) =>
      prev.map((r) => (r.id === raceId ? { ...r, name, info } : r))
    );
    // Only sync races that have no temp boat IDs
    const hasTempBoats = raceBoats.some((rb) => rb.boatId < 0);
    if (auth && !hasTempBoats) {
      queueUpdate(`race-${raceId}`, () => updateRace(auth, raceId, name, info));
    }
  };

  const updateSeriesData = (seriesId: number, name: string, info: SeriesInfo) => {
    setSeries((prev) =>
      prev.map((s) => (s.id === seriesId ? { ...s, name, info } : s))
    );
    if (auth) {
      queueUpdate(`series-${seriesId}`, () => updateSeries(auth, seriesId, name, info));
    }
  };

  // Soft delete a boat (marks as deleted, keeps record for historical races)
  const softDeleteBoat = (boatId: number) => {
    setBoats((prev) =>
      prev.map((b) => {
        if (b.id !== boatId) return b;
        const updatedInfo = { ...b.info, deleted: true };
        if (auth) {
          queueUpdate(`boat-${boatId}`, () => updateBoat(auth, boatId, b.name, updatedInfo));
        }
        return { ...b, info: updatedInfo };
      })
    );
  };

  // Delete a race from the database and remove from its parent series
  const removeRace = async (raceId: number) => {
    // Remove from parent series
    setSeries((prev) =>
      prev.map((s) => {
        if (!s.info.raceIds.includes(raceId)) return s;
        const updatedInfo = { ...s.info, raceIds: s.info.raceIds.filter((id) => id !== raceId) };
        if (auth) {
          queueUpdate(`series-${s.id}`, () => updateSeries(auth, s.id, s.name, updatedInfo));
        }
        return { ...s, info: updatedInfo };
      })
    );

    // Remove from local state
    setRaces((prev) => prev.filter((r) => r.id !== raceId));

    // Deselect if this was the selected race
    setSelectedRaceId((prev) => (prev === raceId ? null : prev));

    // Delete from database
    if (auth) {
      try {
        await deleteRace(auth, raceId);
      } catch {
        // If delete fails, data will be re-synced on next refresh
      }
    }
  };

  // Delete a series and all its races
  const removeSeries = async (seriesId: number) => {
    const s = series.find((s) => s.id === seriesId);
    const raceIdsToDelete = s?.info.raceIds || [];

    // Deselect if current race is in this series
    setSelectedRaceId((prev) => {
      if (prev != null && raceIdsToDelete.includes(prev)) return null;
      return prev;
    });

    // Remove races from local state
    setRaces((prev) => prev.filter((r) => !raceIdsToDelete.includes(r.id)));

    // Remove series from local state
    setSeries((prev) => prev.filter((s) => s.id !== seriesId));

    // Delete from database
    if (auth) {
      try {
        for (const raceId of raceIdsToDelete) {
          await deleteRace(auth, raceId);
        }
        await deleteSeries(auth, seriesId);
      } catch {
        // If deletes fail, will be cleaned up on refresh
      }
    }
  };

  return (
    <RaceContext.Provider
      value={{
        series, races, boats,
        selectedRaceId, selectedRace,
        synced, loading,
        selectRace: setSelectedRaceId,
        createSeries, createRace, createBoat,
        updateBoatData, updateRaceData, updateSeriesData,
        softDeleteBoat, removeRace, removeSeries,
        refreshAll,
      }}
    >
      {children}
    </RaceContext.Provider>
  );
}

export function useRaces(): RaceContextValue {
  const ctx = useContext(RaceContext);
  if (!ctx) throw new Error("useRaces must be inside RaceProvider");
  return ctx;
}
