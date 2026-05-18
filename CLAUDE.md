# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Type-check + build to dist/
npm run preview      # Preview production build

# Tests
npx vitest run src/test/scoring.test.ts   # Run scoring unit tests
npx vitest                                 # Run all tests in watch mode
```

## Architecture

Racemate is a **React + TypeScript SPA** (Vite) for sailing race committees. The frontend lives in `src/` and is deployed to Vercel. The backend is a set of **Vercel serverless functions** in `api/` that connect to a **Neon (serverless Postgres)** database.

### Frontend (`src/`)

The app is structured around three React context providers that wrap the entire authenticated UI:

- **`AuthContext`** — JWT-style auth stored in `localStorage` under `racemate_auth`. Dispatches `racemate-auth-invalid` window event on token mismatch to auto-logout.
- **`RaceContext`** — Central data store. Holds `series`, `races`, and `boats` arrays. All mutations are **optimistic**: local state updates immediately, then a debounced sync queue (`pendingUpdates` ref) flushes to the backend every 5 seconds. Temp IDs (large negative numbers) are used for boats created while offline and swapped for real IDs once the server responds.
- **`TimeContext`** — Syncs the client clock to the server (`/api/time`) using NTP-style offset measurement. Takes 3 samples and uses the lowest-latency one. Re-syncs every 5 minutes.

The main app renders six tabs as always-mounted panes (CSS visibility toggle, not unmount/remount):

| Tab | Component | Purpose |
|-----|-----------|---------|
| Races | `RacesTab` | Select/create series and races |
| Check In | `CheckInTab` | Register boats for a race |
| Start | `StartTab` | Countdown clock, start sequence |
| Chart | `ChartTab` | Leaflet map view |
| Finish | `FinishTab` | Record finish times, manage observations |
| Results | `ResultsTab` | Scoring and standings |

### Data Model

All data records have the shape `{ id, name, info }` where `info` is a JSON blob. The parsed TypeScript types are in `src/api.ts`:

- **`RaceInfo`** — contains `boats: RaceBoatEntry[]` (per-boat state including `finishTime`, `status`, `class`), `starts: StartInfo[]` (with countdown sequences), `scoringSettings`, and `assistants`.
- **`SeriesInfo`** — contains `raceIds: number[]` linking races, plus series-level scoring settings.
- **`BoatInfo`** — sail number, type, skipper, class, PHRF rating.

### Backend (`api/`)

Each file in `api/` is a standalone Vercel serverless function (CommonJS). Auth is verified by bcrypt-comparing the provided token against a hashed `login_token` stored in the `users` table. All functions follow the same pattern: verify user + token, then execute a SQL query.

The API base URL is hardcoded in `src/api.ts` as `https://racematevercel.vercel.app/api`. The `post()` helper handles all API calls and dispatches `racemate-auth-invalid` on token errors.

### Sync / Collaboration

- The selected race polls for remote updates every 15 seconds (configurable via `localStorage["racemate-sync-interval"]`).
- Writes are batched and deduped by key (`race-{id}`, `series-{id}`, `boat-{id}`) — a newer write for the same key overwrites the pending one before it flushes.
- The `synced` boolean in `RaceContext` reflects whether all local changes have been flushed to the server.
- Finish observations (from assistant users) are stored separately in a `finish_observations` table and fetched via `getFinishObservations`.

### Testing

Unit tests live in `src/test/scoring.test.ts`. Because the scoring/formatting functions are not exported from their source components, the test file **copies them inline** — the comment at the top of the test file notes to keep them in sync. If you refactor to export these functions, import them directly instead.

## Working Preferences

- Prefer small, targeted changes over large rewrites.
- Preserve the existing architecture unless I explicitly ask for a rewrite.
- Use minimal dependencies.
- Prefer vanilla JavaScript/TypeScript and fetch where practical.
- When debugging, suggest or make one fix at a time.
- Explain what changed and why after editing.
- Do not modify unrelated files.