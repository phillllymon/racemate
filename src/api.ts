const BASE_URL = "https://racematevercel.vercel.app/api";

// ---- Auth types ----

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface SignInResponse {
  message: string;
  token?: string;
  user?: User;
}

export interface SignUpResponse {
  message: string;
  user?: User;
}

export interface SignOutResponse {
  message: string;
}

// ---- Data types ----

export interface BoatRecord {
  id: number;
  name: string;
  info: string;
  owner: string;
}

export interface RaceRecord {
  id: number;
  name: string;
  info: string;
  owner: string;
}

export interface SeriesRecord {
  id: number;
  name: string;
  info: string;
  owner: string;
}

// Parsed info types used in the frontend
export interface BoatInfo {
  name: string;
  sailNumber?: string;
  type?: string;
  skipper?: string;
  class?: string;
  phrf?: number;
  [key: string]: unknown;
}

export interface RaceBoatEntry {
  boatId: number;
  class: string;
  status: string;
  finishTime?: number | null;
  [key: string]: unknown;
}

export interface RaceInfo {
  name: string;
  autoCheckIn?: boolean;
  boats?: RaceBoatEntry[];
  starts?: StartInfo[];
  scoringMethod?: string;
  [key: string]: unknown;
}

export interface StartInfo {
  id: string;
  classes: string[];
  startTime?: number | null;
  sequence?: SequenceStep[];
  [key: string]: unknown;
}

export interface SequenceStep {
  offsetSeconds: number;
  label: string;
}

export interface SeriesInfo {
  name: string;
  raceIds: number[];
  scoringMethod?: string;
  drops?: number;
  [key: string]: unknown;
}

// ---- Helpers ----

interface AuthParams {
  userId: string;
  token: string;
}

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ---- Auth ----

export async function signUp(
  username: string,
  email: string,
  password: string
): Promise<SignUpResponse> {
  return post("auth/signUp", { username, email, password });
}

export async function signIn(
  email: string,
  password: string
): Promise<SignInResponse> {
  return post("auth/signIn", { email, password });
}

export async function signOut(
  userId: string,
  token: string
): Promise<SignOutResponse> {
  return post("auth/signOut", { userId, token });
}

// ---- Boats ----

export async function addBoat(
  auth: AuthParams,
  boatName: string,
  boatInfo: BoatInfo
): Promise<{ message: string; boat: BoatRecord[] }> {
  return post("addBoat", {
    userId: auth.userId,
    token: auth.token,
    boatName,
    boatInfo,
  });
}

export async function updateBoat(
  auth: AuthParams,
  boatId: number,
  boatName: string,
  boatInfo: BoatInfo
): Promise<{ message: string; boat: BoatRecord[] }> {
  return post("updateBoat", {
    userId: auth.userId,
    token: auth.token,
    boatId: String(boatId),
    boatName,
    boatInfo,
  });
}

export async function getBoatsByColumn(
  auth: AuthParams,
  column: string,
  targetVal: string | number
): Promise<{ message: string; results: BoatRecord[] }> {
  return post("getBoatsByColumn", {
    userId: auth.userId,
    token: auth.token,
    column,
    targetVal,
  });
}

export async function getBoatsByProperties(
  auth: AuthParams,
  properties: Array<{ key: string; value: string | number }>
): Promise<{ message: string; results: BoatRecord[] }> {
  return post("getBoatsByProperties", {
    userId: auth.userId,
    token: auth.token,
    properties,
  });
}

// ---- Races ----

export async function addRace(
  auth: AuthParams,
  raceName: string,
  raceInfo: RaceInfo
): Promise<{ message: string; race: RaceRecord[] }> {
  return post("addRace", {
    userId: auth.userId,
    token: auth.token,
    raceName,
    raceInfo,
  });
}

export async function updateRace(
  auth: AuthParams,
  raceId: number,
  raceName: string,
  raceInfo: RaceInfo
): Promise<{ message: string; race: RaceRecord[] }> {
  return post("updateRace", {
    userId: auth.userId,
    token: auth.token,
    raceId: String(raceId),
    raceName,
    raceInfo,
  });
}

export async function getRacesByColumn(
  auth: AuthParams,
  column: string,
  targetVal: string | number
): Promise<{ message: string; results: RaceRecord[] }> {
  return post("getRacesByColumn", {
    userId: auth.userId,
    token: auth.token,
    column,
    targetVal,
  });
}

// ---- Series ----

export async function addSeries(
  auth: AuthParams,
  seriesName: string,
  seriesInfo: SeriesInfo
): Promise<{ message: string; series: SeriesRecord[] }> {
  return post("addSeries", {
    userId: auth.userId,
    token: auth.token,
    seriesName,
    seriesInfo,
  });
}

export async function updateSeries(
  auth: AuthParams,
  seriesId: number,
  seriesName: string,
  seriesInfo: SeriesInfo
): Promise<{ message: string; series: SeriesRecord[] }> {
  return post("updateSeries", {
    userId: auth.userId,
    token: auth.token,
    seriesId: String(seriesId),
    seriesName,
    seriesInfo,
  });
}

export async function getSeriesByColumn(
  auth: AuthParams,
  column: string,
  targetVal: string | number
): Promise<{ message: string; results: SeriesRecord[] }> {
  return post("getSeriesByColumn", {
    userId: auth.userId,
    token: auth.token,
    column,
    targetVal,
  });
}
