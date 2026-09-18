import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  addRace, updateRace, getRacesByColumn, deleteRace,
  addSeries, updateSeries, getSeriesByColumn, deleteSeries,
  addBoat, updateBoat, getBoatsByColumn,
  getAssistantRaces,
  addRaceBoat, deleteRaceBoat, getRaceBoats, rowToEntry,
} from "./api";
import type {
  RaceRecord, SeriesRecord, BoatRecord,
  RaceInfo, SeriesInfo, BoatInfo, RaceBoatEntry, RaceBoatRow,
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

// ---- Durable sync queue ----
//
// Everything that needs to reach the server is described as plain data (never a
// closure), so it can be written to localStorage and replayed after a reload —
// the app has to keep working (create a race, check boats in, run it, see results)
// with no connection at all, and pick back up wherever it left off once one of the
// periodic sync attempts succeeds.

type Auth = { userId: string; token: string };

type PendingWrite =
  | { kind: "updateRace"; raceId: number; name: string; info: RaceInfo }
  | { kind: "updateSeries"; seriesId: number; name: string; info: SeriesInfo }
  | { kind: "updateBoat"; boatId: number; name: string; info: BoatInfo }
  // Add-or-edit a single race_boat row. One kind covers both cases (the server side
  // is an upsert) so the queue never has to know whether a given boat's insert has
  // actually reached the server yet before deciding whether a later edit is an
  // "insert" or an "update" — it's always just "here's this row's current state."
  | { kind: "syncRaceBoat"; raceId: number; entry: RaceBoatEntry }
  | { kind: "deleteRaceBoat"; raceId: number; boatId: number }
  | { kind: "deleteRace"; raceId: number }
  | { kind: "deleteSeries"; seriesId: number };

async function executeWrite(auth: Auth, write: PendingWrite): Promise<unknown> {
  switch (write.kind) {
    case "updateRace": return updateRace(auth, write.raceId, write.name, write.info);
    case "updateSeries": return updateSeries(auth, write.seriesId, write.name, write.info);
    case "updateBoat": return updateBoat(auth, write.boatId, write.name, write.info);
    case "syncRaceBoat": return addRaceBoat(auth, write.raceId, write.entry);
    case "deleteRaceBoat": return deleteRaceBoat(auth, write.raceId, write.boatId);
    case "deleteRace": return deleteRace(auth, write.raceId);
    case "deleteSeries": return deleteSeries(auth, write.seriesId);
  }
}

// A create that hasn't been confirmed by the server yet, tracked under its
// temporary (large negative) local ID until it resolves to a real one.
type PendingCreate =
  | { kind: "boat"; name: string; info: BoatInfo; raceIds: number[] }
  | { kind: "race"; name: string; seriesId: number | null; info: RaceInfo }
  | { kind: "series"; name: string; info: SeriesInfo };

// ---- Local cache (per-user, survives reload/logout-login on this device) ----

const CACHE_VERSION = 1;
const cacheKey = (userId: string) => `racemate-cache-v${CACHE_VERSION}-${userId}`;

interface CachedState {
  races: Race[];
  series: Series[];
  boats: Boat[];
  selectedRaceId: number | null;
  pendingWrites: [string, PendingWrite][];
  pendingCreates: [number, PendingCreate][];
}

function loadCache(userId: string): CachedState | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedState;
  } catch {
    return null;
  }
}

function saveCache(userId: string, state: CachedState) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(state));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — in-memory state still
    // works for this session, it just won't survive a reload.
  }
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
  patchRaceInfo: (raceId: number, patch: Partial<RaceInfo>) => void;
  patchSeriesInfo: (seriesId: number, patch: Partial<SeriesInfo>) => void;
  updateBoatInRace: (raceId: number, boatId: number, updater: (boat: RaceBoatEntry) => RaceBoatEntry) => void;
  removeBoatFromRace: (raceId: number, boatId: number) => void;
  addBoatToRace: (raceId: number, entry: RaceBoatEntry) => void;
  softDeleteBoat: (boatId: number) => void;
  removeRace: (raceId: number) => Promise<void>;
  removeSeries: (seriesId: number) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshSelectedRace: () => Promise<void>;
  refreshSeriesBoats: (seriesId: number) => Promise<void>;
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
  // Bumped whenever the ref-based queues (pendingUpdates/pendingCreatesRef) mutate,
  // so the cache-persist effect below (which can't watch refs directly) re-runs.
  const [queueTick, setQueueTick] = useState(0);
  const touchQueue = useCallback(() => setQueueTick((t) => t + 1), []);

  // Sync queue — plain data, not closures, so it can be persisted (see PendingWrite).
  const pendingUpdates = useRef<Map<string, PendingWrite>>(new Map());
  const inFlightKeys = useRef<Set<string>>(new Set());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending creates — races/series/boats waiting on their real ID.
  const pendingCreatesRef = useRef<Map<number, PendingCreate>>(new Map());
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards retryPendingCreates against overlapping runs: it awaits each pending
  // create sequentially, which can take several seconds. If a new create (e.g.
  // adding a race right after creating its series) fires its own kick while an
  // older one is still mid-flight, retryTimerRef.current has already been cleared
  // (see retryPendingCreates) so that kick would otherwise start a second
  // concurrent pass over the same still-unresolved entries — double-creating them.
  const retryInFlightRef = useRef(false);
  // Set when a new create arrives while a run is already in flight (and so got
  // deferred rather than starting its own concurrent pass — see retryInFlightRef).
  // Without this, that new entry would otherwise sit until the *next* run's normal
  // RETRY_INTERVAL_MS reschedule, compounding: e.g. a race added right after its
  // series can end up waiting out the series' own retry, then a full extra interval
  // before its first real attempt even starts. This collapses that second wait to
  // effectively zero once the in-flight run finishes.
  const retryImmediateRef = useRef(false);
  // Gates the cache-persist effect below until hydration's setRaces/setSeries/etc.
  // have actually applied. This has to be state, not a ref: setHydrated(true) is
  // deferred to the next render exactly like the hydrated data is, so both become
  // visible to the persist effect together. A ref's .current would flip immediately
  // within the same commit — before races/series/boats catch up — so the persist
  // effect would still fire once against the pre-hydration empty state and
  // overwrite a good cache with blanks.
  const [hydrated, setHydrated] = useState(false);

  // Memoized so it's referentially stable across renders when the underlying
  // user/token haven't actually changed — this object literal used to be rebuilt
  // fresh on every render, which cascaded through every useCallback that depends
  // on `auth` (ensureBoatsLoaded, fetchRaceBoatsInto, ...) and caused the
  // race-selection effect to re-fire on nearly every render. Since that effect's
  // own getRaceBoats response triggers a re-render, that became a self-sustaining
  // loop firing getRaceBoats continuously instead of only when selectedRaceId
  // actually changes.
  const auth = useMemo(
    () => (user && token ? { userId: user.id, token } : null),
    [user?.id, token]
  );

  // Check if a key has pending or in-flight writes
  const hasPendingWrite = useCallback((key: string) => {
    return pendingUpdates.current.has(key) || inFlightKeys.current.has(key);
  }, []);

  // Flush pending updates to backend
  const flush = useCallback(async () => {
    if (!auth || pendingUpdates.current.size === 0) {
      if (pendingCreatesRef.current.size === 0) setSynced(true);
      return;
    }
    const batch = Array.from(pendingUpdates.current.entries());
    pendingUpdates.current.clear();
    batch.forEach(([key]) => inFlightKeys.current.add(key));

    await Promise.allSettled(
      batch.map(([key, write]) =>
        executeWrite(auth, write).catch((e) => {
          // Re-queue only this specific failed write, not the whole batch
          if (!pendingUpdates.current.has(key)) pendingUpdates.current.set(key, write);
          throw e;
        })
      )
    );

    batch.forEach(([key]) => inFlightKeys.current.delete(key));
    touchQueue();

    if (pendingUpdates.current.size === 0 && pendingCreatesRef.current.size === 0) {
      setSynced(true);
    } else {
      scheduleFlush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const scheduleFlush = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(flush, 5000);
  }, [flush]);

  const queueUpdate = useCallback((key: string, write: PendingWrite) => {
    pendingUpdates.current.set(key, write);
    setSynced(false);
    touchQueue();
    scheduleFlush();
  }, [scheduleFlush, touchQueue]);

  // Merge freshly-fetched race_boats rows with local state: a row with a write
  // still queued keeps its local value (so a background poll can't revert an edit
  // that just hasn't reached the server yet), and any local-only row not yet
  // confirmed server-side (still on a temp ID, or its add is still queued) survives.
  //
  // Two things have to be handled carefully here, both around deletes:
  // 1. A boat can have a pending write (a delete, still in flight) but no local
  //    copy at all — removeBoatFromRace removes it from local state immediately.
  //    If we fell through to the fresh (pre-delete) copy in that case we'd
  //    resurrect a boat that was just deleted, simply because the delete hadn't
  //    reached the server yet.
  // 2. Once that delete *does* flush, its pending-write entry is gone — so a
  //    local-only entry surviving into `merged` with no pending write and no temp
  //    ID isn't a legitimate not-yet-synced addition, it's a stale leftover (e.g.
  //    from case 1 before this fix existed). Only entries actually explained by a
  //    temp ID or an active pending write should survive; anything else defers to
  //    the server's copy (or absence of one) as the source of truth.
  const mergeRaceBoats = useCallback((localBoats: RaceBoatEntry[], freshBoats: RaceBoatEntry[], raceId: number) => {
    const freshIds = new Set(freshBoats.map((b) => b.boatId));
    const merged: RaceBoatEntry[] = [];
    freshBoats.forEach((fresh) => {
      if (hasPendingWrite(`race-boat-${raceId}-${fresh.boatId}`)) {
        const local = localBoats.find((b) => b.boatId === fresh.boatId);
        if (local) merged.push(local);
        // else: pending write with no local copy — a delete in flight. Drop the
        // stale fresh copy instead of resurrecting it.
      } else {
        merged.push(fresh);
      }
    });
    localBoats.forEach((b) => {
      if (freshIds.has(b.boatId)) return; // already handled above
      if (b.boatId < 0 || hasPendingWrite(`race-boat-${raceId}-${b.boatId}`)) {
        merged.push(b); // genuinely not-yet-synced: temp ID, or its write is still queued
      }
      // else: absent from the server and nothing explains why — stale, drop it.
    });
    return merged;
  }, [hasPendingWrite]);

  // Backfill the boat directory (names, sail numbers, etc.) for any boat ID we've
  // just learned about via race_boats but don't have a record for locally — e.g.
  // an assistant checked in a brand-new boat (which they, not you, own) on a race
  // you own, or you're now pulling in a sibling race's boats for the first time.
  // Without this, that boat only ever shows as its fallback "Boat #123" — every
  // race_boats fetch (selection, series-wide, periodic poll) runs its boat IDs
  // through here so the real name/info arrives wherever those boats show up.
  const knownBoatIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    knownBoatIdsRef.current = new Set(boats.map((b) => b.id));
  }, [boats]);

  const ensureBoatsLoaded = useCallback((boatIds: number[]) => {
    if (!auth) return;
    const missing = Array.from(new Set(boatIds)).filter(
      (id) => id > 0 && !knownBoatIdsRef.current.has(id)
    );
    if (missing.length === 0) return;
    // Mark as known immediately so concurrent callers (e.g. selection fetch and
    // series-wide fetch firing together) don't double-fetch the same IDs.
    missing.forEach((id) => knownBoatIdsRef.current.add(id));
    Promise.all(
      missing.map((id) => getBoatsByColumn(auth, "id", id).catch(() => ({ message: "error", results: [] as BoatRecord[] })))
    ).then((results) => {
      const fetched = results.flatMap((r) => r.results.map((br: BoatRecord) => parseRecord<BoatInfo>(br)));
      if (fetched.length === 0) return;
      setBoats((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const toAdd = fetched.filter((b) => !existingIds.has(b.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    });
  }, [auth]);

  // Fetch everything for this user and merge it into local state without ever
  // clobbering an edit that hasn't synced yet or a create still waiting on a real ID.
  const refreshAll = useCallback(async () => {
    if (!auth) return;
    try {
      const [seriesRes, racesRes, boatsRes, assistantRes] = await Promise.all([
        getSeriesByColumn(auth, "owner", auth.userId),
        getRacesByColumn(auth, "owner", auth.userId),
        getBoatsByColumn(auth, "owner", auth.userId),
        getAssistantRaces(auth).catch(() => ({ races: [], series: [] })),
      ]);

      const ownedRaces = racesRes.results.map((r: RaceRecord) => parseRecord<RaceInfo>(r));
      const assistRaces = (assistantRes.races || []).map((r: RaceRecord) => parseRecord<RaceInfo>(r));
      const ownedSeries = seriesRes.results.map((r: SeriesRecord) => parseRecord<SeriesInfo>(r));
      const assistSeries = (assistantRes.series || []).map((r: SeriesRecord) => parseRecord<SeriesInfo>(r));

      const raceMap = new Map<number, Race>();
      ownedRaces.forEach((r) => raceMap.set(r.id, r));
      assistRaces.forEach((r) => { if (!raceMap.has(r.id)) raceMap.set(r.id, r); });

      const seriesMap = new Map<number, Series>();
      ownedSeries.forEach((s) => seriesMap.set(s.id, s));
      assistSeries.forEach((s) => { if (!seriesMap.has(s.id)) seriesMap.set(s.id, s); });

      // Collect boat IDs from assistant races that we don't own. Fetched from the
      // real race_boats table (getRaceBoats), not race.info.boats — every write path
      // (updateRaceData/patchRaceInfo) strips `boats` before persisting a race, so
      // that field is always empty server-side and can't be used to find these IDs.
      const ownedBoats = boatsRes.results.map((r: BoatRecord) => parseRecord<BoatInfo>(r));
      const ownedBoatIds = new Set(ownedBoats.map((b) => b.id));
      const missingBoatIds = new Set<number>();
      if (assistRaces.length > 0) {
        const raceBoatsResults = await Promise.all(
          assistRaces.map((race) =>
            getRaceBoats(auth, race.id).catch(() => ({ message: "error", rows: [] as RaceBoatRow[] }))
          )
        );
        raceBoatsResults.forEach((res) => {
          res.rows.map(rowToEntry).forEach((rb) => {
            if (!ownedBoatIds.has(rb.boatId)) missingBoatIds.add(rb.boatId);
          });
        });
      }

      let freshBoats = ownedBoats;
      if (missingBoatIds.size > 0) {
        const fetches = Array.from(missingBoatIds).map((id) =>
          getBoatsByColumn(auth, "id", id).catch(() => ({ results: [] as BoatRecord[] }))
        );
        const results = await Promise.all(fetches);
        const extraBoats = results.flatMap((r) =>
          r.results.map((br: BoatRecord) => parseRecord<BoatInfo>(br))
        );
        freshBoats = [...ownedBoats, ...extraBoats];
      }

      setRaces((prev) => {
        const merged = Array.from(raceMap.values()).map((fresh) => {
          const existing = prev.find((r) => r.id === fresh.id);
          if (existing && hasPendingWrite(`race-${fresh.id}`)) return existing;
          // race_boats isn't part of this row server-side — keep whatever's loaded locally.
          return { ...fresh, info: { ...fresh.info, boats: existing?.info.boats || [] } };
        });
        prev.forEach((r) => { if (!raceMap.has(r.id)) merged.push(r); });
        return merged;
      });

      setSeries((prev) => {
        const merged = Array.from(seriesMap.values()).map((fresh) => {
          const existing = prev.find((s) => s.id === fresh.id);
          if (existing && hasPendingWrite(`series-${fresh.id}`)) return existing;
          return fresh;
        });
        prev.forEach((s) => { if (!seriesMap.has(s.id)) merged.push(s); });
        return merged;
      });

      setBoats((prev) => {
        const freshIds = new Set(freshBoats.map((b) => b.id));
        const merged = freshBoats.map((fresh) => {
          const existing = prev.find((b) => b.id === fresh.id);
          if (existing && hasPendingWrite(`boat-${fresh.id}`)) return existing;
          return fresh;
        });
        prev.forEach((b) => { if (!freshIds.has(b.id)) merged.push(b); });
        return merged;
      });
    } catch (_e) {
      // Offline or request failed — local state (from cache or this session) stands.
    }
  }, [auth?.userId, auth?.token, hasPendingWrite]);

  // On login: hydrate from this device's cache first (instant, works offline), then
  // reconcile with the server in the background. Only block on the network fetch
  // if there's no cache at all yet (first time this user's data has loaded here).
  useEffect(() => {
    setHydrated(false);
    if (!user?.id) { setLoading(false); setHydrated(true); return; }
    const cached = loadCache(user.id);
    if (cached) {
      setRaces(cached.races);
      setSeries(cached.series);
      setBoats(cached.boats);
      if (cached.selectedRaceId != null) setSelectedRaceId(cached.selectedRaceId);
      pendingUpdates.current = new Map(cached.pendingWrites);
      pendingCreatesRef.current = new Map(cached.pendingCreates);
      setSynced(pendingUpdates.current.size === 0 && pendingCreatesRef.current.size === 0);
      setLoading(false);
      if (pendingUpdates.current.size > 0) scheduleFlush();
      if (pendingCreatesRef.current.size > 0 && !retryTimerRef.current) {
        retryTimerRef.current = setTimeout(retryPendingCreates, 0);
      }
      refreshAll();
    } else {
      setLoading(true);
      refreshAll().finally(() => setLoading(false));
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persist local state to this device's cache whenever it changes, so a reload,
  // logout/login, or lost connection never loses anything already known locally.
  // Gated on `hydrated` — see its declaration for why that has to be state.
  useEffect(() => {
    if (!user?.id || !hydrated) return;
    saveCache(user.id, {
      races, series, boats, selectedRaceId,
      pendingWrites: Array.from(pendingUpdates.current.entries()),
      pendingCreates: Array.from(pendingCreatesRef.current.entries()),
    });
  }, [races, series, boats, selectedRaceId, queueTick, user?.id, hydrated]);

  // Fetch one race's boats and merge them in, protecting anything not yet synced.
  const fetchRaceBoatsInto = useCallback((raceId: number) => {
    if (!auth) return Promise.resolve();
    return getRaceBoats(auth, raceId).then((res) => {
      const freshBoats = res.rows.map(rowToEntry);
      ensureBoatsLoaded(freshBoats.map((b) => b.boatId));
      setRaces((prev) => prev.map((r) => {
        if (r.id !== raceId) return r;
        const localBoats = (r.info.boats || []) as RaceBoatEntry[];
        return { ...r, info: { ...r.info, boats: mergeRaceBoats(localBoats, freshBoats, raceId) } };
      }));
    }).catch(() => {});
  }, [auth, mergeRaceBoats, ensureBoatsLoaded]);

  // Fetch every race in a series, not just the one currently selected — otherwise
  // series-wide results only ever reflect whichever single race you last had open.
  // Boats for a race someone else is running (as an assistant, say) never arrive
  // any other way, since the per-selection fetch below only covers your own
  // selection and the periodic poll only covers that same one race.
  const refreshSeriesBoats = useCallback(async (seriesId: number) => {
    if (!auth) return;
    const s = series.find((s) => s.id === seriesId);
    if (!s) return;
    await Promise.all(s.info.raceIds.filter((id) => id > 0).map((id) => fetchRaceBoatsInto(id)));
  }, [auth, series, fetchRaceBoatsInto]);

  // Fetch race boats when a race is selected, merging with any locally-pending
  // boats. Also pulls in every sibling race in the same series (see
  // refreshSeriesBoats) so series-wide results are populated as soon as any one
  // of its races is opened, not only the one you personally selected.
  useEffect(() => {
    if (!auth || selectedRaceId == null) return;
    const parentSeries = series.find((s) => s.info.raceIds.includes(selectedRaceId));
    const raceIds = parentSeries
      ? Array.from(new Set([selectedRaceId, ...parentSeries.info.raceIds]))
      : [selectedRaceId];
    raceIds.filter((id) => id > 0).forEach((id) => fetchRaceBoatsInto(id));
  }, [selectedRaceId, auth?.userId, series, fetchRaceBoatsInto]);

  // Periodically refresh the selected race data to pick up changes from other users
  useEffect(() => {
    if (!auth || selectedRaceId == null) return;
    const interval = (() => {
      const stored = localStorage.getItem("racemate-sync-interval");
      if (stored) {
        const parsed = Number(stored);
        if (!isNaN(parsed) && parsed > 0) return parsed;
        if (stored === "off" || stored === "0") return 0;
      }
      return 15000;
    })();
    if (interval <= 0) return;

    const timer = setInterval(async () => {
      try {
        const [raceRes, boatsRes] = await Promise.all([
          hasPendingWrite(`race-${selectedRaceId}`) ? null : getRacesByColumn(auth, "id", selectedRaceId),
          getRaceBoats(auth, selectedRaceId),
        ]);
        const freshBoats = boatsRes.rows.map(rowToEntry);
        ensureBoatsLoaded(freshBoats.map((b) => b.boatId));
        setRaces((prev) => prev.map((r) => {
          if (r.id !== selectedRaceId) return r;
          const localBoats = (r.info.boats || []) as RaceBoatEntry[];
          const mergedBoats = mergeRaceBoats(localBoats, freshBoats, selectedRaceId);
          if (raceRes && raceRes.results.length === 1 && !hasPendingWrite(`race-${selectedRaceId}`)) {
            const freshRace = parseRecord<RaceInfo>(raceRes.results[0]);
            // Preserve locally-added empty classes that haven't been synced yet
            const localEmptyClasses = (r.info.emptyClasses as string[] | undefined) || [];
            const serverEmptyClasses = (freshRace.info.emptyClasses as string[] | undefined) || [];
            const mergedEmptyClasses = Array.from(new Set([...serverEmptyClasses, ...localEmptyClasses]));
            return { ...freshRace, info: { ...freshRace.info, boats: mergedBoats, emptyClasses: mergedEmptyClasses } };
          }
          return { ...r, info: { ...r.info, boats: mergedBoats } };
        }));
      } catch {
        // ignore — will retry next interval
      }
    }, interval);

    return () => clearInterval(timer);
  }, [selectedRaceId, auth?.userId, auth?.token, hasPendingWrite, mergeRaceBoats, ensureBoatsLoaded]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const selectedRace = races.find((r) => r.id === selectedRaceId) || null;

  // Lightweight refresh of just the selected race (for periodic polling)
  const refreshSelectedRace = useCallback(async () => {
    if (!auth || !selectedRaceId) return;
    try {
      const [raceRes, boatsRes] = await Promise.all([
        getRacesByColumn(auth, "id", selectedRaceId),
        getRaceBoats(auth, selectedRaceId),
      ]);
      if (raceRes.results.length === 1) {
        const fresh = parseRecord<RaceInfo>(raceRes.results[0]);
        const freshBoats = boatsRes.rows.map(rowToEntry);
        setRaces((prev) => prev.map((r) => {
          if (r.id !== fresh.id) return r;
          const localBoats = (r.info.boats || []) as RaceBoatEntry[];
          return { ...fresh, info: { ...fresh.info, boats: mergeRaceBoats(localBoats, freshBoats, selectedRaceId) } };
        }));
      }
    } catch {
      // Keep existing state
    }
  }, [auth?.userId, auth?.token, selectedRaceId, mergeRaceBoats]);

  const generateTempId = (): number => {
    // Large negative number to avoid collision with real DB IDs
    return -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
  };

  // A temp boat's real ID has arrived — swap it everywhere it's referenced and
  // sync any races it was added to while it was still temp (those syncs were
  // skipped until now, since a temp boat ID can't be written to race_boats).
  const resolveBoat = useCallback((tempId: number, realId: number) => {
    setBoats((prev) => prev.map((b) => (b.id === tempId ? { ...b, id: realId } : b)));
    const pending = pendingCreatesRef.current.get(tempId);
    if (pending && pending.kind === "boat") {
      setRaces((prevRaces) =>
        prevRaces.map((race) => {
          if (!pending.raceIds.includes(race.id)) return race;
          const updatedBoats = (race.info.boats || []).map((rb) =>
            rb.boatId === tempId ? { ...rb, boatId: realId } : rb
          );
          const swapped = updatedBoats.find((rb) => rb.boatId === realId);
          if (auth && swapped && race.id > 0) {
            queueUpdate(`race-boat-${race.id}-${realId}`, { kind: "syncRaceBoat", raceId: race.id, entry: swapped });
          }
          return { ...race, info: { ...race.info, boats: updatedBoats } };
        })
      );
    }
    pendingCreatesRef.current.delete(tempId);
    touchQueue();
  }, [auth, queueUpdate, touchQueue]);

  // A temp race's real ID has arrived — adopt it (keeping all local edits made
  // since creation was first attempted), re-point the parent series, re-point any
  // still-pending boat creates that were tracked against the temp ID, and sync
  // every boat currently in this race (those syncs were skipped while the race ID
  // was temp, since a temp race ID can't be written to race_boats either).
  const resolveRace = useCallback((tempId: number, created: Race, seriesId: number | null) => {
    setRaces((prev) => prev.map((r) => {
      if (r.id !== tempId) return r;
      const localBoats = (r.info.boats || []) as RaceBoatEntry[];
      localBoats.forEach((b) => {
        if (auth && b.boatId > 0) {
          queueUpdate(`race-boat-${created.id}-${b.boatId}`, { kind: "syncRaceBoat", raceId: created.id, entry: b });
        }
      });
      return { ...r, id: created.id };
    }));

    setSelectedRaceId((prev) => (prev === tempId ? created.id : prev));

    pendingCreatesRef.current.forEach((spec) => {
      if (spec.kind === "boat") {
        const idx = spec.raceIds.indexOf(tempId);
        if (idx !== -1) spec.raceIds[idx] = created.id;
      }
    });

    if (seriesId != null) {
      setSeries((prev) => prev.map((s) => {
        if (s.id !== seriesId) return s;
        const updatedInfo = { ...s.info, raceIds: s.info.raceIds.map((id) => (id === tempId ? created.id : id)) };
        if (auth) queueUpdate(`series-${s.id}`, { kind: "updateSeries", seriesId: s.id, name: s.name, info: updatedInfo });
        return { ...s, info: updatedInfo };
      }));
    }

    pendingCreatesRef.current.delete(tempId);
    touchQueue();
  }, [auth, queueUpdate, touchQueue]);

  // A temp series' real ID has arrived — races don't store their parent series ID
  // directly (only the reverse pointer, series.info.raceIds), so the only other
  // thing that can reference it is a still-pending race create's `seriesId`.
  const resolveSeries = useCallback((tempId: number, realId: number) => {
    setSeries((prev) => prev.map((s) => (s.id === tempId ? { ...s, id: realId } : s)));
    pendingCreatesRef.current.forEach((spec) => {
      if (spec.kind === "race" && spec.seriesId === tempId) {
        spec.seriesId = realId;
      }
    });
    pendingCreatesRef.current.delete(tempId);
    touchQueue();
  }, [touchQueue]);

  const RETRY_INTERVAL_MS = 5000;

  const retryPendingCreates = useCallback(async () => {
    if (retryInFlightRef.current) return;
    retryTimerRef.current = null;
    if (!auth || pendingCreatesRef.current.size === 0) return;

    retryInFlightRef.current = true;
    try {
      const entries = Array.from(pendingCreatesRef.current.entries());
      for (const [tempId, spec] of entries) {
        try {
          if (spec.kind === "boat") {
            const res = await addBoat(auth, spec.name, spec.info);
            resolveBoat(tempId, parseRecord<BoatInfo>(res.boat[0]).id);
          } else if (spec.kind === "race") {
            const res = await addRace(auth, spec.name, spec.info);
            resolveRace(tempId, parseRecord<RaceInfo>(res.race[0]), spec.seriesId);
          } else {
            const res = await addSeries(auth, spec.name, spec.info);
            resolveSeries(tempId, parseRecord<SeriesInfo>(res.series[0]).id);
          }
        } catch {
          // Still offline or failed — leave it queued, try again next cycle
        }
      }
    } finally {
      retryInFlightRef.current = false;
    }

    if (pendingCreatesRef.current.size > 0) {
      const delay = retryImmediateRef.current ? 0 : RETRY_INTERVAL_MS;
      retryImmediateRef.current = false;
      retryTimerRef.current = setTimeout(() => retryPendingCreates(), delay);
    } else if (pendingUpdates.current.size === 0) {
      setSynced(true);
    }
  }, [auth, resolveBoat, resolveRace, resolveSeries]);

  // Track which race a temp boat gets added to, so resolveBoat can sync it there
  // once the boat's real ID arrives.
  const trackTempBoatInRace = useCallback((tempId: number, raceId: number) => {
    const entry = pendingCreatesRef.current.get(tempId);
    if (entry && entry.kind === "boat" && !entry.raceIds.includes(raceId)) {
      entry.raceIds.push(raceId);
    }
  }, []);

  const createSeries = useCallback(async (name: string, info?: Partial<SeriesInfo>): Promise<Series> => {
    const seriesInfo: SeriesInfo = { name, raceIds: [], ...info };
    const tempId = generateTempId();
    const optimistic: Series = { id: tempId, name, info: seriesInfo };
    setSeries((prev) => [...prev, optimistic]);
    pendingCreatesRef.current.set(tempId, { kind: "series", name, info: seriesInfo });
    touchQueue();
    setSynced(false);
    if (auth) {
      if (retryInFlightRef.current) {
        retryImmediateRef.current = true;
      } else if (!retryTimerRef.current) {
        retryTimerRef.current = setTimeout(() => retryPendingCreates(), 0);
      }
    }
    return optimistic;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, touchQueue]);

  const createRace = useCallback(async (
    name: string,
    seriesId: number | null,
    info?: Partial<RaceInfo>
  ): Promise<Race> => {
    const raceInfo: RaceInfo = { name, boats: [], starts: [], ...info };
    const tempId = generateTempId();
    const optimistic: Race = { id: tempId, name, info: raceInfo };
    setRaces((prev) => [...prev, optimistic]);
    setSelectedRaceId(tempId);

    let effectiveSeriesId = seriesId;
    if (seriesId !== null) {
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          return { ...s, info: { ...s.info, raceIds: [...s.info.raceIds, tempId] } };
        })
      );
    } else {
      // Standalone race — also create a placeholder series to hold it, same as before
      const placeholderName = `${name} Series`;
      const placeholder = await createSeries(placeholderName, { raceIds: [tempId] });
      effectiveSeriesId = placeholder.id;
    }

    pendingCreatesRef.current.set(tempId, { kind: "race", name, seriesId: effectiveSeriesId, info: raceInfo });
    touchQueue();
    setSynced(false);
    if (auth) {
      if (retryInFlightRef.current) {
        retryImmediateRef.current = true;
      } else if (!retryTimerRef.current) {
        retryTimerRef.current = setTimeout(() => retryPendingCreates(), 0);
      }
    }
    return optimistic;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, touchQueue, createSeries]);

  const createBoat = useCallback(async (name: string, info: BoatInfo): Promise<Boat> => {
    const tempId = generateTempId();
    const tempBoat: Boat = { id: tempId, name, info };
    setBoats((prev) => [...prev, tempBoat]);
    pendingCreatesRef.current.set(tempId, { kind: "boat", name, info, raceIds: [] });
    touchQueue();
    setSynced(false);
    if (auth) {
      if (retryInFlightRef.current) {
        retryImmediateRef.current = true;
      } else if (!retryTimerRef.current) {
        retryTimerRef.current = setTimeout(() => retryPendingCreates(), 0);
      }
    }
    return tempBoat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, touchQueue]);

  const updateBoatData = (boatId: number, name: string, info: BoatInfo) => {
    setBoats((prev) =>
      prev.map((b) => (b.id === boatId ? { ...b, name, info } : b))
    );
    if (auth) {
      queueUpdate(`boat-${boatId}`, { kind: "updateBoat", boatId, name, info });
    }
  };

  const updateRaceData = (raceId: number, name: string, info: RaceInfo) => {
    setRaces((prev) =>
      prev.map((r) => (r.id === raceId ? { ...r, name, info } : r))
    );
    if (auth) {
      const { boats: _boats, ...infoWithoutBoats } = info;
      queueUpdate(`race-${raceId}`, { kind: "updateRace", raceId, name, info: infoWithoutBoats as RaceInfo });
    }
  };

  const updateSeriesData = (seriesId: number, name: string, info: SeriesInfo) => {
    setSeries((prev) =>
      prev.map((s) => (s.id === seriesId ? { ...s, name, info } : s))
    );
    if (auth) {
      queueUpdate(`series-${seriesId}`, { kind: "updateSeries", seriesId, name, info });
    }
  };

  // Patch functions read the freshest state at write time to avoid stale overwrites
  const patchRaceInfo = (raceId: number, patch: Partial<RaceInfo>) => {
    setRaces((prev) => {
      const race = prev.find((r) => r.id === raceId);
      if (!race) return prev;
      const merged = { ...race.info, ...patch };
      if (auth) {
        const { boats: _boats, ...mergedWithoutBoats } = merged;
        queueUpdate(`race-${raceId}`, { kind: "updateRace", raceId, name: race.name, info: mergedWithoutBoats as RaceInfo });
      }
      return prev.map((r) => r.id === raceId ? { ...r, info: merged } : r);
    });
  };

  const patchSeriesInfo = (seriesId: number, patch: Partial<SeriesInfo>) => {
    setSeries((prev) => {
      const s = prev.find((s) => s.id === seriesId);
      if (!s) return prev;
      const merged = { ...s.info, ...patch };
      if (auth) {
        queueUpdate(`series-${seriesId}`, { kind: "updateSeries", seriesId, name: s.name, info: merged });
      }
      return prev.map((s) => s.id === seriesId ? { ...s, info: merged } : s);
    });
  };

  // Update a single boat within a race, reading freshest state
  const updateBoatInRace = (raceId: number, boatId: number, updater: (boat: RaceBoatEntry) => RaceBoatEntry) => {
    setRaces((prev) => {
      const race = prev.find((r) => r.id === raceId);
      if (!race) return prev;
      const currentBoats = (race.info.boats || []) as RaceBoatEntry[];
      const updatedBoats = currentBoats.map((b) => b.boatId === boatId ? updater(b) : b);
      const updatedEntry = updatedBoats.find((b) => b.boatId === boatId);
      // Races also carry a temp negative ID until the server confirms creation;
      // race_id is a Postgres integer column, so a temp ID here would fail on sync.
      // Skip until resolveRace re-sends this boat's current state with the real ID.
      if (auth && boatId > 0 && raceId > 0 && updatedEntry) {
        queueUpdate(`race-boat-${raceId}-${boatId}`, { kind: "syncRaceBoat", raceId, entry: updatedEntry });
      }
      return prev.map((r) => r.id === raceId ? { ...r, info: { ...race.info, boats: updatedBoats } } : r);
    });
  };

  // Remove a single boat from a race
  const removeBoatFromRace = useCallback((raceId: number, boatId: number) => {
    setRaces((prev) => {
      const race = prev.find((r) => r.id === raceId);
      if (!race) return prev;
      const updatedBoats = ((race.info.boats || []) as RaceBoatEntry[]).filter((b) => b.boatId !== boatId);
      if (auth && boatId > 0 && raceId > 0) {
        // Same key as updateBoatInRace/addBoatToRace, so a pending edit to this boat
        // is superseded by the delete rather than resurrecting it afterward.
        queueUpdate(`race-boat-${raceId}-${boatId}`, { kind: "deleteRaceBoat", raceId, boatId });
      }
      return prev.map((r) => r.id === raceId ? { ...r, info: { ...race.info, boats: updatedBoats } } : r);
    });
  }, [auth, queueUpdate]);

  // Atomically append a boat entry to a race — safe to call from async .then() handlers
  const addBoatToRace = useCallback((raceId: number, entry: RaceBoatEntry) => {
    if (entry.boatId < 0) {
      trackTempBoatInRace(entry.boatId, raceId);
    }
    setRaces((prev) => {
      const race = prev.find((r) => r.id === raceId);
      if (!race) return prev;
      const currentBoats = (race.info.boats || []) as RaceBoatEntry[];
      if (currentBoats.some((b) => b.boatId === entry.boatId)) return prev;
      if (auth && entry.boatId > 0 && raceId > 0) {
        queueUpdate(`race-boat-${raceId}-${entry.boatId}`, { kind: "syncRaceBoat", raceId, entry });
      }
      return prev.map((r) => r.id === raceId ? { ...r, info: { ...race.info, boats: [...currentBoats, entry] } } : r);
    });
  }, [auth, trackTempBoatInRace, queueUpdate]);

  // Soft delete a boat (marks as deleted, keeps record for historical races)
  const softDeleteBoat = (boatId: number) => {
    setBoats((prev) =>
      prev.map((b) => {
        if (b.id !== boatId) return b;
        const updatedInfo = { ...b.info, deleted: true };
        if (auth) {
          queueUpdate(`boat-${boatId}`, { kind: "updateBoat", boatId, name: b.name, info: updatedInfo });
        }
        return { ...b, info: updatedInfo };
      })
    );
  };

  // Delete a race from the database and remove from its parent series
  const removeRace = useCallback(async (raceId: number) => {
    setSeries((prev) =>
      prev.map((s) => {
        if (!s.info.raceIds.includes(raceId)) return s;
        const updatedInfo = { ...s.info, raceIds: s.info.raceIds.filter((id) => id !== raceId) };
        if (auth) {
          queueUpdate(`series-${s.id}`, { kind: "updateSeries", seriesId: s.id, name: s.name, info: updatedInfo });
        }
        return { ...s, info: updatedInfo };
      })
    );

    setRaces((prev) => prev.filter((r) => r.id !== raceId));
    setSelectedRaceId((prev) => (prev === raceId ? null : prev));

    if (raceId < 0) {
      // Never reached the server — nothing to delete remotely
      pendingCreatesRef.current.delete(raceId);
      touchQueue();
    } else if (auth) {
      queueUpdate(`race-${raceId}`, { kind: "deleteRace", raceId });
    }
  }, [auth, queueUpdate, touchQueue]);

  // Delete a series and all its races
  const removeSeries = useCallback(async (seriesId: number) => {
    const s = series.find((s) => s.id === seriesId);
    const raceIdsToDelete = s?.info.raceIds || [];

    setSelectedRaceId((prev) => {
      if (prev != null && raceIdsToDelete.includes(prev)) return null;
      return prev;
    });

    setRaces((prev) => prev.filter((r) => !raceIdsToDelete.includes(r.id)));
    setSeries((prev) => prev.filter((s) => s.id !== seriesId));

    raceIdsToDelete.forEach((raceId) => {
      if (raceId < 0) {
        pendingCreatesRef.current.delete(raceId);
      } else if (auth) {
        queueUpdate(`race-${raceId}`, { kind: "deleteRace", raceId });
      }
    });
    if (seriesId < 0) {
      pendingCreatesRef.current.delete(seriesId);
    } else if (auth) {
      queueUpdate(`series-${seriesId}`, { kind: "deleteSeries", seriesId });
    }
    touchQueue();
  }, [series, auth, queueUpdate, touchQueue]);

  return (
    <RaceContext.Provider
      value={{
        series, races, boats,
        selectedRaceId, selectedRace,
        synced, loading,
        selectRace: setSelectedRaceId,
        createSeries, createRace, createBoat,
        updateBoatData, updateRaceData, updateSeriesData,
        patchRaceInfo, patchSeriesInfo,
        updateBoatInRace, removeBoatFromRace, addBoatToRace,
        softDeleteBoat, removeRace, removeSeries,
        refreshAll,
        refreshSelectedRace,
        refreshSeriesBoats,
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
