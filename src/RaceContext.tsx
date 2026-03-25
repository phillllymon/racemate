import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  addRace, updateRace, getRacesByColumn,
  addSeries, updateSeries, getSeriesByColumn,
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

    if (pendingUpdates.current.size === 0) {
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

  const createBoat = async (name: string, info: BoatInfo): Promise<Boat> => {
    if (!auth) throw new Error("Not authenticated");
    const res = await addBoat(auth, name, info);
    const created = parseRecord<BoatInfo>(res.boat[0]);
    setBoats((prev) => [...prev, created]);
    return created;
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
    setRaces((prev) =>
      prev.map((r) => (r.id === raceId ? { ...r, name, info } : r))
    );
    if (auth) {
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

  return (
    <RaceContext.Provider
      value={{
        series, races, boats,
        selectedRaceId, selectedRace,
        synced, loading,
        selectRace: setSelectedRaceId,
        createSeries, createRace, createBoat,
        updateBoatData, updateRaceData, updateSeriesData,
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
