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

Current phase: Post-Phase-6 backlog / maintenance

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
- **Phase 4 — trip-scoped, date-driven views.** Removed the active `nagoya-2026` runtime dependency; the workspace is now fully scoped to the selected trip.
  - `TripWorkspace.tsx` — deleted the `TRIP_ID` constant; threads `trip`/`trip.id` into all five children; new events/imports default to the trip's first day; `key={trip.id}` on the workspace in `App.tsx` forces a clean remount per trip (no stale cross-trip data).
  - `TripViewer.tsx` — queries `trip.id`; days built from `trip.start_date`→`trip.end_date` (`buildTripDays`, 1–60 days safe); header shows `trip.title` + derived range; selected day derived during render (no setState-in-effect). Mock weather kept but harmless/documented (keyed to legacy 2026 dates; unknown → "--").
  - `TimelineView.tsx` — queries `trip.id`; days from the trip range; drag/drop/resize and floating/backlog preserved (writes stay within the trip's own events).
  - `TripTable.tsx` — now requires `tripId`; query scoped by `trip_id`; **Delete All operates on the scoped result → selected-trip-only**.
  - `EventModal.tsx` — requires `tripId`; creates with `trip_id: tripId` (no more hardcoded `nagoya-2026`).
  - `ImportModal.tsx` — already inserted with `trip_id: tripId`; now also takes the trip range and routes out-of-range scheduled imports to the backlog (floating).
  - `EventDetailView.tsx` — unchanged; edits by event id, and ids only ever come from trip-scoped parent queries, so there is no cross-trip edit path.
  - Behavior: selecting Nagoya shows the legacy events/dates exactly as before; a new trip shows empty Journal/Timeline/Table until its own events are added; all writes attach to the selected trip.
  - Build/lint/test result: build passed; touched files introduce no new lint errors (pre-existing `any` in ImportModal/TripTable catch blocks and the EventModal `setOpen` warning remain as legacy debt); no test script.
- **Phase 5 — UI/UX rebrand + photo UI removal.** De-Nagoya'd the active UI and removed the non-core photo feature; Phase 4 trip-scoping preserved.
  - **Rebrand copy:** `src/i18n/translations.ts` — `trip.title` → "Journey Ledger", `trip.dates` → generic ("Travel Journal & Planner" / "旅行日誌與規劃"), `dashboard.footer` → "Journey Ledger", `import.placeholder` examples de-Nagoya'd (no "Nagoya Castle"/"名古屋城"), `detail.location_tag` → "Journey Ledger"; added `nav.all_trips` (All Trips / 所有旅行).
  - **Navigation (polish patch):** `TripWorkspace.tsx` header now distinguishes two actions — the **logo + "Journey Ledger" title return to All Trips** (`onBackToTrips`), while a **"Back" / "上一頁" button returns to the current trip dashboard** (`setMode('dashboard')`, internal to the workspace). TripDashboard keeps its own explicit "All Trips" button (dashboard mode). New i18n keys `nav.all_trips` + `nav.back`.
  - **Lint cleanup (polish patch):** `useSettings` + the context object/types moved to `src/context/settings.ts` so `SettingsContext.tsx` exports only the `SettingsProvider` component (fixes `react-refresh/only-export-components`); consumers repointed. `EventDetailView.tsx` — `updateField` hoisted + `useCallback` (fixes use-before-declaration + effect deps), `toJSON() as any` → `as TripEventDocType`, and a redundant synchronous `setEvent(null)` removed. The six Phase 5 files now lint clean (zero errors).
  - **Photo UI removed:** `EventDetailView.tsx` — deleted the file input + `handleImageUpload` (no new base64 written); existing `image` data now renders **read-only** (polaroid shown only if an image already exists); removed the `ImageIcon`/"Add Photo" affordance and the Nagoya location tag. `image` schema field untouched (backward compatible). Memo/checklist/location/weather/navigation/title/description/category editing all preserved.
  - **Weather:** `TripViewer.tsx` — mock weather widget now only renders when mock data exists for the day, so non-legacy trips show no weather (no "--" / no Nagoya implication). Legacy Nagoya still shows its mock forecast.
  - **TripLibrary:** added a product tagline + clearer "All Trips" label and a more explanatory empty state.
  - **Settings keys:** `SettingsContext.tsx` — renamed to `journey_ledger_lang` / `journey_ledger_font_scale`; reads legacy `nagoya_*` keys once as a fallback (no preference loss); all writes go to the new keys.
  - Build/lint/test result: build passed; touched files introduce no new lint errors (pre-existing EventDetailView `any`/access-order/deps and the SettingsContext `react-refresh` warning remain as legacy debt, line-shifted only); no test script.
- **Phase 6 — quotas, tests, RLS docs, release cleanup.** Stabilized the app for real use without UI/schema changes.
  - **Quotas:** new `src/lib/quotas.ts` — `QUOTAS` (maxTripsPerUser 10, maxEventsPerTrip 500, maxChecklistItemsPerEvent 50, maxMemoLength 5000) + pure helpers (`canCreateTrip`, `canAddEvents`, `canAddChecklistItem`, `isMemoWithinLimit`, `getRemainingEventCapacity`). **Frontend UX guard only — NOT a security boundary** (backend enforcement deferred). Enforced in CreateTripModal (count non-deleted owned trips), EventModal create path (count non-deleted events for `trip_id`), ImportModal (blocks the WHOLE batch if it would exceed remaining capacity — no partial import), EventDetailView (checklist add guard + memo `maxLength` + blur guard). Edit paths unaffected.
  - **Extracted helpers (DRY + testable):** `src/lib/dateRange.ts` (`buildTripDays`, `MAX_TRIP_DAYS=60`; was duplicated in TripViewer/TimelineView) and `src/lib/tripScoping.ts` (`tripEventsSelector(tripId)` — canonical `{trip_id, is_deleted:false}` selector now used by TripViewer/TimelineView/TripTable). Identical query output → Phase 4 isolation unchanged.
  - **Tests:** added `"test": "vitest run"`. New suites `quotas.test.ts` (15), `dateRange.test.ts` (7), `tripScoping.test.ts` (4) + existing `dateUtils.test.ts` (4) = **30 passing**. Covers quota below/at/above limits, import-batch-exceeds-capacity rejection, date ranges (1-day/multi-day/inverted/invalid/cap), and trip-scoped selector correctness.
  - **Docs:** `supabase/README.md` expanded — required tables/columns, RLS expectations (own-row select/insert/update, no hard delete, soft-delete via `deleted=true`), realtime publication, anon-key-only / never-ship-`service_role`, post-setup verification steps.
  - Build/lint/test result: build passed; `npm test` 30/30 pass; no new lint errors in touched files (pre-existing `any` in ImportModal/TripTable catch blocks + EventModal `setOpen` warning remain as legacy debt; new lib + test files clean).

## Hardcode classification (Phase 6 release audit)

Remaining `nagoya-2026` / `Nagoya` / `名古屋` / `2026-01-31` / `2026-02-07` references:
- **Allowed legacy seed/demo data:** `src/db/trips.ts` (`LEGACY_TRIP_ID` + seeded "Nagoya 2026" trip + its dates). Adopt-existing-events data, not active routing.
- **Allowed comments:** `src/App.tsx` (bootstrap comment), `src/lib/parser.ts` (date-header regex example), `src/services/geocoding.ts` (example string).
- **Deferred (harmless):** `src/components/TripViewer/TripViewer.tsx` mock `WEATHER_FORECAST` keyed to 2026 dates — hidden for non-legacy trips; not real weather.
- **Dead code (deferred cleanup):** `src/components/Home/LandingPage.tsx` shows "Nagoya 2026" but is NOT rendered anywhere — safe to delete later.
- **Deferred assets:** Nagoya-themed `public/` images (`home_icon.jpg`, `splash-cover.jpg`, `castle_logo.jpg`, `pwa-icon.png`).
- **Active runtime risk:** NONE — no routing on `nagoya-2026`; create/import default to the selected trip; no product copy implies all trips are Nagoya.

In progress:
- (none — Phase 6 complete)

Next (Post-Phase-6 backlog / maintenance — recommended small phases):
1. Trip edit / delete / archive (+ graceful recovery when a selected trip is missing).
2. Selected-trip persistence across reloads (e.g. `localStorage`).
3. Public asset refresh (de-Nagoya logo/splash) + delete dead `LandingPage.tsx`.
4. Backend quota enforcement (per-user trips / per-trip events) — frontend quotas are UX-only.
5. Legacy lint-debt cleanup (remaining `no-explicit-any` / react-hooks items in untouched legacy files).
6. Real per-trip weather (replace mock `WEATHER_FORECAST`).

## Architecture Changes (running log)

- **Phase 1:** Second RxDB collection `trips` alongside `tripevents`. Independent Supabase replication channel (`trips_db_changes`, identifier `supabase-jsonb-trips-v1`). Trips replication failures are isolated from events replication. Legacy trip bootstrap runs once per load (no-op if the trip already exists locally).
- **Phase 2:** Trip-selection gate in `AppContent` (`selectedTripId` state). New `src/components/Trips/` module (TripLibrary / TripCard / CreateTripModal). TripLibrary is the post-auth landing; the legacy single-trip workspace renders only after a trip is selected. Workspace internals remain legacy-scoped (`TRIP_ID = 'nagoya-2026'`) — selection is an entry point, not yet a data scope. `selectedTripId` is in-memory only (not persisted across reloads).
- **Phase 3:** Workspace extracted from `App.tsx` into `src/components/TripWorkspace.tsx`, which takes the resolved `trip` object. `App.tsx` is now a thin router (AppShell → AppContent → TripLibrary | TripWorkspace). TripDashboard displays the selected trip's identity. The legacy `TRIP_ID = 'nagoya-2026'` is now isolated in ONE place (`TripWorkspace`) with an explicit Phase 4 TODO block listing every inner view that still depends on it.
- **Phase 4:** All core event views/writes are trip-scoped via `trip.id`, and day ranges are derived from `trip.start_date`/`trip.end_date`. The active `nagoya-2026` constant is gone; `nagoya-2026` now only persists as the legacy seed trip's id + its events' `trip_id`. Scoping is enforced at the RxDB query level (`trip_id` selector) in TripViewer/TimelineView/TripTable, at the write level in EventModal/ImportModal (`trip_id: tripId`), and structurally by `key={trip.id}` remounting the workspace. EventDetailView remains id-based but is only fed trip-scoped ids.
- **Phase 5:** Active UI rebranded to Journey Ledger (i18n copy, TripLibrary, dashboard footer). Photo/base64 upload removed from EventDetailView (existing images read-only; schema unchanged). Mock weather hidden for non-legacy trips. Settings localStorage keys renamed to `journey_ledger_*` with one-time legacy fallback. New header "All Trips" button decouples "return to library" from the logo. No data-layer changes; Phase 4 trip-scoping intact.

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
- **Phase 4 — remaining hardcodes / risks:**
  - Mock weather in `TripViewer` is still keyed to the legacy 2026 Nagoya dates. It is harmless (unknown dates render "--") but is NOT real per-trip weather. Replace or remove in a later phase.
  - Remaining `nagoya-2026` references are demo/legacy only: the seed trip id + its events, and Phase 5 UI copy in `src/i18n/translations.ts`, `LandingPage.tsx`, `SettingsContext.tsx` storage keys, `docs/*`, and Nagoya-themed `public/` assets. None drive active data routing.
  - `EventDetailView` edits by event id without re-checking `trip_id`. Safe today (ids come only from trip-scoped parent queries) but would become a cross-trip risk if a future component passes an arbitrary id — keep this invariant in mind.
  - Out-of-range imported events fall into the backlog (floating). They are NOT lost, but there is no explicit "outside trip dates" UI section yet.
  - Photo/base64 image UI still present (Phase 5).
- **Trip edit / delete / archive — KNOWN PRODUCT LIMITATION (deferred):**
  - Trips can be **created and selected, but not edited, deleted, or archived** yet. There is intentionally no trip edit/delete/archive UI as of Phase 5.
  - Selected-trip recovery is incomplete: if a trip is removed externally (e.g. another device, or direct DB edit) while selected, `AppContent` can sit on "Loading trip…". No graceful fallback to TripLibrary yet.
  - Trip edit/delete (and robust recovery for a missing selected trip) should be handled in a **later small phase** — not folded into Phase 6 release cleanup.
- **Phase 5 — remaining items / risks:**
  - Selected trip is still NOT persisted across reloads (returns to TripLibrary). Candidate for Phase 6 or the trip-management phase.
  - Nagoya-themed binary assets in `public/` remain (logo `home_icon.jpg`, `splash-cover.jpg`, `castle_logo.jpg`, `pwa-icon.png`) — not worth replacing yet; no active text branding depends on them. Replace in a future asset pass.
  - Dead/legacy `src/components/Home/LandingPage.tsx` still contains "Nagoya 2026" but is NOT imported/rendered anywhere — safe to delete in Phase 6 cleanup.
  - Mock weather (`WEATHER_FORECAST` in TripViewer) is still keyed to legacy 2026 dates; now hidden for other trips, but it is not real per-trip weather.
  - `detail.photo.add` translation key is now unused (harmless); the `image` schema field is retained for backward-compatible read-only display.
  - Legacy lint debt persists in untouched legacy files (EventDetailView, SettingsContext react-refresh, etc.) — deferred to Phase 6.

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
