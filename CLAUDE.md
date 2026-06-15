# CLAUDE.md — Journey Ledger Project Instructions

This file is the persistent source of truth for future Claude Code sessions. Read it before making changes. Keep it current (see **Update Policy**).

## Project Identity

* This repository was started from `Nagoya_ledger`.
* The new product is **Journey Ledger**.
* The goal is to refactor from a single-trip **Nagoya 2026** planner into a general **multi-trip travel ledger**.

## Product Goal

* Each trip will eventually be a separate workspace.
* Each trip should have its own Journal, Planning Timeline, Table, Import, Events, Notes, Checklist, Weather, and Location data.
* The app should eventually support arbitrary trips, not only Nagoya.
* The most valuable features are **Journal** and **Planning**.
* Photo / base64 image features are **non-core** and should be removed or postponed in a later phase.

## Architecture Summary

* **React + TypeScript + Vite** frontend.
* **RxDB** local-first IndexedDB storage.
* **Supabase** Auth, PostgreSQL, and sync.
* **Existing core views:**
  * Journal / Overview
  * Planning Timeline
  * Table
  * Smart Import
  * Event Detail
* **Existing known risk areas:**
  * hardcoded `nagoya-2026` trip id
  * hardcoded Nagoya copy / strings
  * hardcoded `2026-01-31` to `2026-02-07` date range
  * event queries that may not yet be fully trip-scoped
  * photo / base64 image storage

## Engineering Rules

* Work in phases.
* Do not rewrite the whole app at once.
* Do not introduce unrelated UI rewrites during data-model phases.
* Preserve existing behavior unless the current phase explicitly changes it.
* Prefer explicit TypeScript types over `any`.
* All event queries must eventually be scoped by `trip_id`.
* Do not remove RxDB local-first behavior.
* Do not remove Supabase Auth.
* Do not commit secrets or environment values.
* Run `npm run build` after implementation.
* Run `npm run lint` if available.
* Run `npm test` if available.

## Phase Plan

* **Phase 0:** v2 baseline, metadata rebrand, create `CLAUDE.md`.
* **Phase 1:** add `trips` data model.
* **Phase 2:** add TripLibrary.
* **Phase 3:** add TripWorkspace.
* **Phase 4:** remove Nagoya hardcoding, make event views trip-scoped and date-driven.
* **Phase 5:** UI/UX rebrand and remove photo UI.
* **Phase 6:** quota, tests, RLS documentation, and release cleanup.

## Phase Status

Current phase: Phase 4 — remove Nagoya hardcoding / trip-scoped, date-driven views

Completed:
- **Phase 0 — v2 baseline.** Metadata rebranded to Journey Ledger (`package.json`, `vite.config.ts` PWA manifest, `index.html` title/alt, `README.md`); `CLAUDE.md` created. Runtime behavior unchanged; single-trip behavior preserved.
  - Build/lint/test result: build passed; lint has pre-existing legacy errors only (no new errors introduced); no test script exists yet.
- **Phase 1 — `trips` data model.** Added a first-class `trips` model while preserving single-trip behavior.
  - **Persistence decision:** local-first RxDB `trips` collection + Supabase `trips` mirror table, using the same JSONB pattern as `trip_events` (`id`, `updated_at`, `deleted`, `user_id`, `data jsonb`). Trips are NOT stored inside `trip_events`; trips are NOT local-only.
  - New: `src/db/tripSchema.ts` (`Trip` type + `TRIP_SCHEMA`, version 0), `src/db/trips.ts` (`ensureLegacyTrip` upsert helper, `LEGACY_TRIP_ID`).
  - Changed: `src/db/index.ts` (register `trips` collection, start trips replication independently of events), `src/db/replication.ts` (`startTripsReplication`, fully typed), `src/App.tsx` (upsert legacy trip after DB init + auth).
  - **Legacy data:** on first load a `nagoya-2026` trip (Nagoya, Japan; 2026-01-31 → 2026-02-07; Asia/Tokyo) is upserted with `owner_id = current user`, so existing events (`trip_id = 'nagoya-2026'`) are not orphaned. Existing events were NOT rewritten.
  - **Manual Supabase action required:** for a **fresh project** run `supabase/bootstrap.sql` (provisions `trip_events` + `trips`, indexes, RLS, realtime). For a project that already has `trip_events`, run `supabase/migrations/20260615_create_trips.sql` (trips only). Until applied, replication logs an error and no-ops locally; no data loss. See `supabase/README.md`.
  - Build/lint/test result: build passed; lint unchanged (pre-existing legacy errors only, no new errors in touched files; new files clean); no test script.
- **Phase 2 — TripLibrary.** Added an authenticated landing page that lists trips before entering the workspace.
  - New: `src/components/Trips/TripLibrary.tsx` (lists user's non-deleted trips via `useRxData`, empty state, sign-out), `src/components/Trips/TripCard.tsx` (presentational, keyboard-accessible), `src/components/Trips/CreateTripModal.tsx` (react-hook-form; title/destination/start_date/end_date/timezone/description; inserts into `trips` with `owner_id`, timestamps, `is_deleted=false`; timezone defaults to browser tz → `Asia/Tokyo`).
  - Changed: `src/App.tsx` (added `selectedTripId` gate — `TripLibrary` shows until a trip is selected; selecting enters the existing workspace; reset to library via dashboard back button). `src/components/Home/TripDashboard.tsx` (added optional `onBack` → "All Trips" button).
  - **Behavior:** the workspace is now gated behind trip selection. It still uses legacy `TRIP_ID = 'nagoya-2026'` internally — selecting ANY trip currently shows the legacy Nagoya workspace data. De-scoping is Phase 3/4.
  - Build/lint/test result: build passed; only pre-existing lint debt remains (new files clean; the single `App.tsx` error is the pre-existing `useState<any>`); no test script.
- **Phase 3 — TripWorkspace.** Extracted the workspace into its own component; the selected trip object now owns the workspace flow.
  - New: `src/components/TripWorkspace.tsx` — receives `trip: TripDocType`, `onBackToTrips`, `signOut`; owns workspace mode/planningView/event-modal/detail state, top/bottom nav, and view routing (dashboard / overview / planning).
  - Changed: `src/App.tsx` — now thin: AppShell (auth + DB init) → AppContent resolves the selected trip via `useRxData` and routes Auth → TripLibrary → TripWorkspace. Single `<Toaster>` at AppContent. **Fixed** the pre-existing `useState<any>` → `useState<RxDatabase | null>`.
  - Changed: `src/components/Home/TripDashboard.tsx` — accepts optional `trip`; renders the real trip title, destination, and formatted date range (falls back to legacy i18n copy when no trip).
  - **Flow:** Auth → TripLibrary → TripWorkspace(selectedTrip). Workspace mounts fresh per selection; back button unmounts it. selectedTrip resolved reactively (shows a loading state while resolving).
  - **Behavior:** legacy Nagoya trip renders Journal/Overview + Planning Timeline exactly as before. Inner data views remain legacy-scoped (see risks).
  - Build/lint/test result: build passed; new/changed files (`App.tsx`, `TripWorkspace.tsx`, `TripDashboard.tsx`) lint clean; legacy debt elsewhere unchanged; no test script.

In progress:
- Phase 4 — remove Nagoya hardcoding / trip-scoped, date-driven views

Next:
- Phase 5 — UI/UX rebrand and remove photo UI

## Architecture Changes (running log)

- **Phase 1:** Second RxDB collection `trips` alongside `tripevents`. Independent Supabase replication channel (`trips_db_changes`, identifier `supabase-jsonb-trips-v1`). Trips replication failures are isolated from events replication. Legacy trip bootstrap runs once per load (no-op if the trip already exists locally).
- **Phase 2:** Trip-selection gate in `AppContent` (`selectedTripId` state). New `src/components/Trips/` module (TripLibrary / TripCard / CreateTripModal). TripLibrary is the post-auth landing; the legacy single-trip workspace renders only after a trip is selected. Workspace internals remain legacy-scoped (`TRIP_ID = 'nagoya-2026'`) — selection is an entry point, not yet a data scope. `selectedTripId` is in-memory only (not persisted across reloads).
- **Phase 3:** Workspace extracted from `App.tsx` into `src/components/TripWorkspace.tsx`, which takes the resolved `trip` object. `App.tsx` is now a thin router (AppShell → AppContent → TripLibrary | TripWorkspace). TripDashboard displays the selected trip's identity. The legacy `TRIP_ID = 'nagoya-2026'` is now isolated in ONE place (`TripWorkspace`) with an explicit Phase 4 TODO block listing every inner view that still depends on it.

## Known Risks (running log)

- **Phase 1:**
  - `trips` Supabase table must be created manually; until then cross-device trip sync does not work (local-only, no data loss).
  - RxDB dev-mode schema validation for `TRIP_SCHEMA` was not exercised in this session (the production `build` does not run runtime schema validation, and `npm run dev` requires Supabase env vars). Schema mirrors the proven `TRIP_EVENT_SCHEMA` structure; verify on first `npm run dev`.
  - Deletion semantics: trips replication maps server `deleted` → both RxDB `_deleted` and the queryable `is_deleted` field. No trip-deletion UI exists yet (Phase 2+), so this path is untested.
- **Phase 2:**
  - Selecting any non-legacy trip currently shows the **legacy Nagoya workspace data** (workspace still reads `TRIP_ID = 'nagoya-2026'`). This is expected until Phase 3/4 thread `selectedTripId` into the views.
  - `selectedTripId` is not persisted — a reload returns the user to TripLibrary. Acceptable for Phase 2; revisit when building TripWorkspace.
  - `CreateTripModal` does not validate `end_date >= start_date` yet.
  - TripLibrary scopes by `owner_id`; this relies on the legacy trip and new trips carrying the current user's id (they do).
- **Phase 3 (Phase 4 backlog — the `TRIP_ID = 'nagoya-2026'` block in `TripWorkspace.tsx`):**
  - `TripViewer` (`tripId={TRIP_ID}`) — also hardcodes 2026 dates, mock weather, and the "Nagoya 2026" header.
  - `TimelineView` (`tripId={TRIP_ID}`) — also hardcodes the `2026-01-31` + 8-day window.
  - `TripTable` — NOT trip-scoped (queries all events regardless of trip).
  - `ImportModal` (`tripId={TRIP_ID}`) — new imports attach to the legacy trip, not the selected trip.
  - `EventModal` — hardcodes `trip_id: 'nagoya-2026'` on create.
  - Net effect: selecting a non-legacy trip shows the correct title/dates on the dashboard but legacy Nagoya data + writes in the inner views. Phase 4 must thread `trip.id` + `trip.start_date`/`trip.end_date` through all of the above.
  - `selectedTripId` still not persisted; `TripWorkspace` remounts per selection (workspace mode resets to dashboard). Acceptable.
  - If a selected trip id resolves to no document (e.g. deleted mid-session), AppContent shows a perpetual "Loading trip…" state. Low risk (selection comes from the live list).

## Update Policy

Future Claude Code sessions **must** keep this file current. Do not let `CLAUDE.md` become stale.

When a phase is completed:
* Update the **Phase Status** section.
* Move the completed phase into **Completed**.
* Set the next phase as **Current phase**.
* Add important architecture changes.
* Add known risks and TODOs discovered during implementation.

## End-of-Phase Report Format

At the end of each phase, report using this standard format:

* Files changed
* Architecture changes
* Behavior changes
* Commands run
* Build / lint / test result
* Known risks
* TODOs for next phase
