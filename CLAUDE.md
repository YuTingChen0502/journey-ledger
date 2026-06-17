# CLAUDE.md — Aurea Project Instructions

This file is the persistent source of truth for future Claude Code sessions. Read it before making changes. Keep it current (see **Update Policy**).

## Project Identity

* This repository was started from `Nagoya_ledger`.
* The product is now **Aurea**.
* Aurea was formerly **Journey Ledger** during the multi-trip refactor.
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
* **Phase 7:** trip edit / soft-delete + selected-trip persistence & recovery.
* **Phase 8:** release polish & deploy readiness (assets, dead code, PWA, README, deploy docs).
* **Phase 9:** Weather / Location cleanup.
* **Phase 10:** Archive/Status + final hardening.
* **Phase 11:** post-RC UX polish (double-submit guards, no Nagoya auto-seed, responsive top-nav, logo, responsive timeline density).
* **Phase 12A:** Workspace abstraction foundation (WorkspaceHome + Personal workspace; trip workspace metadata; NO real group sharing yet).
* **Phase 12B:** Groups shell and local group model (groups collection + replication; Create Group; group-scoped TripLibrary; still NO real multi-user sharing/RLS/invite codes).
* **Phase 12C:** Group membership + invite-code foundation (`group_members` + `group_invites` tables, `join_group_by_invite_code` RPC, owner/member roles, widened group-visibility RLS, Join Group + Copy Invite Code UI). Group **trip/event** cross-user sharing is still deferred to **Phase 12D**.
* **Phase 12C.1:** Auth recovery polish (forgot-password email + `/reset-password` password update flow; no group collaboration/RLS changes).
* **Phase 12D:** Group trip/event sharing + RLS (member-visible group trips/events, RPC-based ownership-preserving sync, historical group hydration).
* **Phase 12D.1 / 12F-lite:** Stabilization — auth reset-email rate-limit UX + SMTP docs, owner-only group edit/soft-delete, dev-reset docs. No new migration; no permission roles.
* **Phase 12D.2:** Group workspace convergence / offline-first sync — robust delete-aware retrying group hydration (entry + reconnect), no clobbering of unpushed offline edits, deterministic last-write-wins conflict policy. Foundational sync fix; **paused 12E/12F** for this.
* **Phase 12D.3:** Auth email rate-limit UX/docs + responsive timeline/overview polish.
* **Brand rename:** Journey Ledger → Aurea (branding/metadata only; no sync, Supabase, RLS, RxDB, or data-model changes).
* **Phase 12E:** Group permission/lifecycle hardening (roles UI, member management, leave/remove, invite lifecycle) and remaining release hardening.

## Phase Status

Current phase: Brand rename complete - Journey Ledger → Aurea (branding/metadata only; next -> Phase 12E group permission/lifecycle hardening)

> **Brand rename:** visible product copy, package metadata, PWA manifest, README/deployment docs, and active logo references now use **Aurea**. This did **not** change Supabase tables, RLS, RPCs, migrations, RxDB schemas/database names, replication identifiers, localStorage compatibility keys, or Phase 12E functionality.

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
  - **Phase 6 lint polish patch:** `catch (err: any)` → `catch (err: unknown)` (with safe `err instanceof Error ? err.message : '…'`) in ImportModal/TripTable. Targeted eslint now 0 errors (only the documented EventModal `setOpen` warning remains).
- **Phase 7 — trip edit / soft-delete + selected-trip persistence.** Practical trip management; no schema change.
  - **Edit:** new `src/components/Trips/EditTripModal.tsx` (controlled). Edits title/destination/start_date/end_date/timezone/description; preserves `id`/`owner_id`/`created_at`; updates `updated_at`; validates required fields + `end_date >= start_date` (via new `isValidTripDateRange`). Patches via `incrementalPatch` — events untouched. CreateTripModal now uses the same range validation.
  - **Soft-delete:** TripCard has Edit/Delete actions (`stopPropagation` so they don't open the trip); TripLibrary shows a confirm `AlertDialog`, then soft-deletes (`is_deleted=true`, bump `updated_at`) — **no hard delete**, **events left untouched**. Deleted trip drops from the library (existing `is_deleted=false` filter). If the deleted trip was the persisted selection, its stored id is cleared.
  - **Selected-trip persistence:** new `src/lib/selectedTrip.ts` (`load`/`save`/`clear`, key `journey_ledger_selected_trip_id`, ignores empty). `App.tsx` inits `selectedTripId` from storage and persists on select; **"All Trips" (logo/title/back-to-library) clears it** so a later reload starts at the library; selecting a trip persists it so reload reopens it.
  - **Recovery:** AppContent query excludes deleted trips; a selected id that resolves to no non-deleted doc (deleted/removed externally) renders the library via **derived state** (no setState-in-effect) and clears the stored id in an effect — no infinite "Loading trip…".
  - **Archive: DEFERRED.** The `trips` schema has no status/archive field; adding one is an RxDB schema-version migration (risky) — not done this phase per scope. Soft-delete (hide) covers the immediate need.
  - **i18n:** added trip edit/delete/confirm/save/invalid-range copy (en + zh-TW). **Tests:** `selectedTrip.test.ts` (5; in-memory localStorage stub) + `isValidTripDateRange` cases added to `dateRange.test.ts` → **39 tests pass**.
  - Build/lint/test result: build passed; `npm test` 39/39 pass; targeted eslint on touched files **0 errors / 0 warnings**.
- **Phase 8 — release polish & deploy readiness.** No features/schema changes.
  - **Assets:** added neutral `public/logo.svg` (wine + gold pin/ledger mark, no copyright). Repointed all active refs to it — `index.html` favicon + apple-touch + splash, `TripWorkspace` logo, and the PWA manifest icon (`vite.config.ts`: single `image/svg+xml` icon, `includeAssets: ['logo.svg']`). Deleted the now-unused Nagoya/legacy binaries: `home_icon.jpg`, `splash-cover.jpg`, `pwa-icon.png`, `castle_logo.jpg`, `splash-logo.png`, `splash-logo-gold.jpg`, `vite.svg`. `public/` now contains only `logo.svg`.
  - **PWA/noise:** removed the `bg-[url('/noise.png')]` decorative overlay in `WeatherDetailSheet.tsx` (the only `noise.png` reference) → the build-time "/noise.png didn't resolve" warning is **gone**. No visual change (the asset never existed; overlay was 3% opacity).
  - **Dead code:** deleted `src/components/Home/LandingPage.tsx` (confirmed unused — only self-referenced).
  - **Docs:** `README.md` finalized (features, quotas, local setup with `.env.example`, env vars + anon-key-only warning). New `docs/DEPLOYMENT.md` (Supabase setup checklist, bootstrap SQL, RLS, realtime, env vars, build/output, post-deploy smoke test). `supabase/README.md` gained a **backend quota enforcement design note** (frontend = UX only; recommended trigger/RPC/RLS/edge-function approaches; current risk = low because RLS already scopes rows per owner).
  - **Lint:** as a tiny safe fix in a touched file, `t(\`wmo.${...}\` as any)` → `as TranslationKey` in `WeatherDetailSheet.tsx` (type-only; behavior unchanged), clearing its 2 pre-existing `any` errors.
  - Build/lint/test result: build passed (no `noise.png` warning); `npm test` 39/39 pass; targeted eslint on touched files **0 errors / 0 warnings**.
- **Phase 9 — weather / location cleanup.** Removed the mock weather; no schema changes.
  - **TripViewer:** deleted the `WEATHER_FORECAST` mock (keyed to Nagoya 2026 dates) + the header weather widget + unused `Cloud/Sun/CloudRain/Snowflake` imports. TripViewer no longer shows any trip-level weather (it would be fake for arbitrary trips). Title/date-range/day-tabs/`buildTripDays` behavior unchanged.
  - **Event weather preserved:** `EventDetailView` + `SpotWeather` + `useSpotWeather` already use **real, coordinate-based** Open-Meteo data (keyless) keyed to the event's own location; widget hidden when no coordinates. Left as-is (no Nagoya default).
  - **Geocoding:** already generic/keyless (Open-Meteo + Nominatim, neutral `null` fallback). Only change: genericized the one Nagoya example comment.
  - **Docs:** README gained a "Weather & location" note (event-level real weather, keyless; trip-level forecast deferred).
  - No new pure helpers → no new tests. Build passed; `npm test` 39/39; targeted eslint on TripViewer/geocoding **0 errors / 0 warnings**.
- **Phase 10 — deployment readiness (docs-only + tiny config).** No app/schema/behavior changes; the MVP is now a release candidate.
  - **Vercel:** `vercel.json` already had the SPA rewrite; added the `$schema` field for completeness. Framework = Vite, build `npm run build`, output `dist`, env `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (anon only).
  - **`docs/DEPLOYMENT.md` expanded:** Supabase **Auth Site URL / Redirect URLs** guidance (production URL must match origin); a **Vercel** setup subsection; a **two-account RLS user-isolation** smoke test; a **same-account multi-device sync** test; **iPhone Add-to-Home-Screen** instructions + verify list; plus the existing bootstrap/RLS/realtime/env/smoke sections.
  - **Security:** repo-wide scan found **no** `service_role`/secret usage (only the "never ship service_role" warnings in docs). `.env.local` is gitignored; `.env.example` carries only the two `VITE_*` anon vars.
  - **No schema migration, no archive/status, no backend quota** (all deferred per scope).
  - Build/lint/test result: build passed; `npm test` 39/39; only `vercel.json` + docs touched (no source files), so eslint is unaffected (0 new issues).
- **Phase 11 — post-RC UX polish.** Five fixes from manual review; no schema changes; stays a Release Candidate.
  - **Double-submit guards:** `Auth.tsx` rebranded ("Journey Ledger"), now uses a `pending: 'login'|'signup'|null` state with hard `if (busy) return` guards, disabled buttons + "Signing up…/Logging in…" text, and graceful "already registered" handling (Supabase returns a user with empty `identities`). `EventModal` submit button now `disabled={form.formState.isSubmitting}`. `ImportModal` commit guarded by `isImporting` + disabled buttons. (CreateTrip/EditTrip/Delete already guarded in Phase 7.)
  - **No Nagoya auto-seed:** `App.tsx` no longer calls `ensureLegacyTrip()` on login. New users start with an empty TripLibrary; existing users keep their trips via Supabase replication (no data deleted/rewritten). The helper remains in `src/db/trips.ts` for manual/dev migration only.
  - **Responsive top-nav:** `ResponsiveLayout` header is now `overflow-x-auto` (hidden scrollbar); `TripWorkspace` nav groups got `shrink-0` so controls scroll horizontally on mobile instead of clipping/squeezing. Desktop layout unchanged.
  - **Logo:** `public/logo.svg` redesigned to a bolder filled gold pin + ledger baseline on wine (legible at favicon size; no castle/copyright). All refs already point to `/logo.svg`.
  - **Responsive timeline density:** new `src/hooks/useTimelineScale.ts` (`useSyncExternalStore` on matchMedia) is the single source of truth for pixels-per-minute — desktop 2.0 (120px/hr, unchanged), tablet 1.0 (60px/hr), mobile 0.8 (48px/hr); 5-min steps stay integer px. Threaded through `TimelineView` (grid height, hour axis, event positioning, drag deltas, snap modifier), `DayColumn` (`hourHeight` prop), and `TimelineEvent` (`ppm` prop for resize math). Event card padding/title font compacted on mobile. Drag/drop, resize, and floating/backlog preserved.
  - Build/lint/test result: build passed; `npm test` 39/39; touched files introduce **no new** lint issues (the only flags — EventModal `setOpen` warning + TimelineEvent `Date.now()` purity at 151:33 — are pre-existing legacy debt present since the Phase 0 baseline).
- **Phase 12A — workspace abstraction foundation.** Inserts a workspace selection layer above All Trips. Foundation only — **no real group sharing, no groups/group_members tables, no invite codes, no group RLS/RPC**.
  - **New flow:** Auth → `WorkspaceHome` → `TripLibrary(workspace)` → `TripWorkspace(selectedTrip)`. Currently only the **Personal** workspace is real; the Groups section is a disabled "coming soon" placeholder (non-functional Create/Join Group buttons).
  - **Workspace model:** new `src/lib/workspace.ts` — `Workspace { type:'personal'|'group', id, name }` + `getPersonalWorkspace(userId)` (id `personal:${userId}`), `getTripWorkspace(trip,userId)`, `isTripInWorkspace(trip,workspace,userId)`. **Backward-compatible fallback:** a trip missing `workspace_*` (or explicitly personal) belongs to the owner's Personal workspace.
  - **Trip schema (v0→v1):** added optional `workspace_type?: 'personal'|'group'` + `workspace_id?: string` to `TRIP_SCHEMA` and `Trip`. Bumped `version` to 1 with a **no-op migration strategy** (`db/index.ts`: `1: (oldDoc) => oldDoc`) — existing local trips migrate untouched and resolve to Personal via fallback. Supabase needs **no** change (fields ride in the existing JSONB `data` column).
  - **Scoping:** `TripLibrary` takes a `workspace` prop, queries the user's non-deleted trips, then filters by `isTripInWorkspace` (existing untagged trips show under Personal). `CreateTripModal` takes the `workspace` and stamps `workspace_type`/`workspace_id` on new trips.
  - **Persistence + no leak:** `src/lib/selectedTrip.ts` gained `*SelectedWorkspaceId` helpers (key `journey_ledger_selected_workspace_id`). `AppContent` restores workspace + trip on reload **only if the stored workspace belongs to the current user** (`personal:${userId}` match), and a resolved trip is accepted **only if `isTripInWorkspace`** — a persisted trip from another workspace cannot leak in. Recovery (clear stored id, fall through to library) preserved; no setState-in-effect.
  - **Navigation:** `TripLibrary` shows "{workspace.name} Trips" + a "Workspaces" back button (`onBackToWorkspaces` clears workspace + trip → WorkspaceHome). `TripWorkspace` upward nav unchanged (Back → trip dashboard, logo/All-Trips → library of the current workspace). New i18n key `nav.workspaces` (en + zh-TW).
  - **Tests:** new `workspace.test.ts` (11) covering personal id, group/legacy fallback, and no-leak `isTripInWorkspace`; `selectedTrip.test.ts` gained workspace-persistence cases. **51 tests pass** (was 39).
  - Build/lint/test result: build passed; `npm test` 51/51; targeted eslint — touched files introduce **no new** errors (the 10 remaining in `db/index.ts` are pre-existing `no-explicit-any` legacy debt; my migration line is typed `Record<string, unknown>`).
- **Phase 12B — groups shell and local group model.** Adds group workspaces as a local-first data + UI foundation. **Still NOT real collaboration**: no `group_members` table, no invite codes, no Supabase RPC, no group RLS beyond own-row, no cross-user access, no roles.
  - **Group model:** new `src/db/groupSchema.ts` (`GroupDocType` + `GROUP_SCHEMA` v0: `id, name, description?, created_by, owner_id, created_at, updated_at, is_deleted`). Registered as a third RxDB collection in `db/index.ts`. A group is **owner-scoped only** (effectively owned by its creator).
  - **Replication:** new `startGroupsReplication` in `db/replication.ts` — same typed JSONB mirror pattern as trips, table `groups`, identifier `supabase-jsonb-groups-v1`, channel `groups_db_changes`. Started after auth, independent of trips/events (a missing `groups` table can't break them). **Supabase:** `groups` table added to `supabase/bootstrap.sql` + new `supabase/migrations/20260616_create_groups.sql` (own-row RLS, realtime) + README note (clearly marked "not yet real sharing").
  - **Workspace model:** `src/lib/workspace.ts` gained `groupWorkspace(group)`, `isPersonalWorkspaceId(id)`, `isGroupMember(group, userId)` (membership == ownership for now). Group workspace object is `{ type:'group', id: group.id, name: group.name }`.
  - **UI:** new `src/components/Trips/CreateGroupModal.tsx` (name required + optional description; auto-enters the new group). `WorkspaceHome` now lists the user's groups as cards, has a **Create Group** button, and a disabled **Join Group** ("coming soon") placeholder. Selecting a group opens `TripLibrary(group workspace)`; the header shows the group name; the "Workspaces" back button returns to WorkspaceHome.
  - **Scoping & no leak:** trips created in a group are stamped `workspace_type:'group'` + `workspace_id:group.id` (CreateTripModal already stamps the active workspace). TripLibrary filters by `isTripInWorkspace`, so Personal trips and Group trips never appear in each other's library; legacy untagged trips remain Personal-only.
  - **Persistence/recovery:** `AppContent` now persists the workspace id (personal or group). A **group** id is resolved reactively from the groups collection (needed for its name); if it no longer resolves (deleted/removed) the stored ids are cleared and the view falls through to WorkspaceHome (derived state — no setState-in-effect, no infinite loading). A selected trip is still accepted only if `isTripInWorkspace` for the active workspace.
  - **Tests:** `workspace.test.ts` extended (groupWorkspace, isPersonalWorkspaceId, isGroupMember, and group/personal/other-group/legacy `isTripInWorkspace` no-leak matrix). **58 tests pass** (was 51).
  - Build/lint/test result: build passed; `npm test` 58/58; targeted eslint — touched files introduce **no new** errors (the 13 remaining are pre-existing `no-explicit-any` in `db/index.ts` + the events path of `db/replication.ts`; the new `startGroupsReplication` is fully typed).
- **Phase 12C — group membership + invite-code foundation.** Groups are no longer owner-only: visibility now comes from **membership**, and a user can **join a group by invite code**. Implements membership + group visibility only — **cross-user group trip/event sharing stays deferred to Phase 12D** (`trip_events`/`trips` RLS untouched).
  - **New tables/RPC (`supabase/migrations/20260617_group_members_invites.sql` + folded into `bootstrap.sql`):**
    - `group_members (id, group_id, user_id, role 'owner'|'member', status 'active', joined_at, created_at, unique(group_id,user_id))`.
    - `group_invites (id, group_id, code unique, created_by, created_at, expires_at?, revoked)`.
    - Helpers `is_group_member(gid,uid)` / `is_group_owner(gid,uid)` — **SECURITY DEFINER** so RLS policies use them without groups↔members recursion.
    - **Owner-membership trigger** `AFTER INSERT ON groups` → auto-creates the creator's `owner` membership (`ON CONFLICT DO NOTHING`; fires once on real insert, not the upsert-update path). So owner membership is created whenever the locally-created group replicates up — no client call, offline-safe.
    - **RPC `join_group_by_invite_code(invite_code text)`** (SECURITY DEFINER): validates exists / not revoked / not expired → inserts active `member` membership (no-op if already a member) → returns `group_id`. Raises coded exceptions (`INVALID_CODE`/`EXPIRED_CODE`/`REVOKED_CODE`/`NOT_AUTHENTICATED`) the client maps to friendly messages.
  - **RLS added/changed:** `groups` SELECT widened to **owner OR active member**; INSERT/UPDATE stay owner-only. `group_members`: SELECT own rows or (as owner) your group's members; **no client write policy** (writes only via trigger + RPC). `group_invites`: owner-only SELECT/INSERT/UPDATE; ordinary users can never list codes, only redeem via RPC.
  - **How membership works:** membership/invites are **auth/security data, not local-first** — they bypass RxDB and use direct Supabase calls (`src/services/groups.ts`). **Owned** groups still sync via RxDB (offline). **Joined** groups (member, not owner) are read **online** via `fetchVisibleGroups()`; the RxDB `groups` pull is now explicitly filtered `.eq('user_id', userId)` so the widened SELECT RLS can't pollute the owner-scoped local store or trigger an ownership push-back.
  - **Invite-code join:** owner's client generates a short unambiguous code (`src/lib/inviteCode.ts`) and inserts it (owner RLS); `JoinGroupModal` normalizes + validates format, calls the RPC, and on success opens the joined group's workspace.
  - **UI added:** `WorkspaceHome` now merges owned (local) + joined (online) groups via `mergeGroupsById`, shows **Member/Owner** subtitles, an owner-only **Copy Invite Code** control (`GroupInviteButton`), and a working **Join Group** modal (replaces the disabled placeholder). No restyle/redesign.
  - **Reload persistence:** `selectedTrip.ts` now persists the **full workspace descriptor** (`{id,name,type}`, `saveSelectedWorkspace`); `AppContent` reconstructs the active workspace synchronously from it — required because a joined group has **no local RxDB doc** to resolve a name from. Removed the 12B reactive group-doc resolution + its "group not found" recovery effect (trip recovery preserved). Cross-user personal guard retained.
  - **Tests:** new `inviteCode.test.ts` (10); `workspace.test.ts` extended (`isGroupOwner`, `mergeGroupsById` visibility/dedupe/soft-delete) → 23; `selectedTrip.test.ts` extended (workspace-descriptor save/load/clear/corrupt/invalid-type) → 13. **80 tests pass** (was 58).
  - **Deferred to Phase 12D (explicitly NOT done):** cross-user group **trip/event** sharing (would need workspace metadata on events + member-aware `trips`/`trip_events` RLS), permission-management UI, admin/editor/viewer roles, group leave/delete UI, invite expiry/revoke UI.
  - **Manual Supabase action:** run `supabase/migrations/20260617_group_members_invites.sql` (or the updated `bootstrap.sql`) **before** cross-account invite testing. Until applied, group creation works locally but joins fail and joined groups don't appear (no data loss).
  - Build/lint/test result: build passed; `npm test` 80/80; targeted eslint — new/changed files clean; the only 3 reported errors are **pre-existing** `no-explicit-any` in the **events** path of `db/replication.ts` (lines 12/35/51), untouched by the groups-pull edit.

- **Phase 12C.1 — Auth recovery polish.** Added Supabase password recovery without changing the group collaboration model.
  - **Forgot password UI:** `Auth.tsx` now has a minimal "Forgot password?" dialog. It validates email locally, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`, and shows a success/error message without storing reset tokens.
  - **Reset password flow:** `App.tsx` handles `/reset-password` client-side (compatible with the Vercel SPA rewrite). `ResetPasswordView` validates new password + confirmation, calls `supabase.auth.updateUser({ password })`, signs out the temporary recovery session, and returns the user to login so the existing clean-room DB flow runs on the next sign-in.
  - **Tests:** new `src/lib/authRecovery.ts` pure helpers + `authRecovery.test.ts` cover reset redirect URL, email validation, and password validation.
  - **Docs:** `docs/DEPLOYMENT.md` now documents required Supabase Auth Redirect URLs for production/local `/reset-password` and wildcard SPA routes.
  - Build/lint/test result: build passed; `npm test` 88/88; targeted eslint on touched source/test files passed. `npm run lint -- ...` still expands to full-project `eslint .` and reports pre-existing legacy lint debt in untouched files; no new lint issues were introduced in touched files.
  - **No group changes:** no edits to `group_members`, `group_invites`, `join_group_by_invite_code`, group/trip/event RLS, permission management, or group trip/event sharing.

- **Phase 12D - Group trip/event sharing + RLS.** Group workspaces now share trips and events across active group members while preserving local-first sync.
  - **RLS/RPC:** new `supabase/migrations/20260618_group_trip_event_sharing.sql` + updated `bootstrap.sql`. `trips` / `trip_events` SELECT is now owner OR active group member; direct INSERT/UPDATE is blocked; replication writes through SECURITY DEFINER RPCs `sync_trip_documents(jsonb)` and `sync_trip_event_documents(jsonb)`.
  - **Ownership preservation:** pull now includes top-level `user_id`; pulled shared docs keep their original JSON `owner_id` instead of being re-owned by the current session. RPC insert sets top-level `user_id` + JSON `owner_id` to `auth.uid()`. RPC update preserves existing top-level `user_id`, JSON `owner_id`, trip workspace identity, event `trip_id`, and `created_at`.
  - **Event metadata:** `TRIP_EVENT_SCHEMA` bumped v3->v4 with optional `workspace_type` / `workspace_id`; new events/imports stamp the selected trip's workspace tag. Legacy events remain valid and are authorized from their parent trip.
  - **Replication:** trips/events replication identifiers bumped to v2 and push via RPC instead of direct `.upsert()`. Personal trips/events continue through the same RxDB collections.
  - **Historical hydration:** `hydrateGroupWorkspaceContent` fetches visible group trips by `data.workspace_id` and their events by parent `trip_id` when a group workspace opens, covering rows older than a member's replication checkpoint without exposing unrelated groups/personal rows.
  - **UI:** `TripLibrary` lists all locally visible trips filtered by workspace (not only `owner_id=currentUser`); edit/delete trip controls are shown only for the trip owner. Group invite/create copy updated to reflect shared group trips/events. No permission-management UI added.
  - **Docs/tests:** Supabase setup/deployment docs updated; new `supabaseRows` tests plus workspace helper tests cover ownership-preserving row mapping and workspace tag behavior.
  - Build/lint/test result: `npm test` 95/95 passed; targeted eslint passed except the pre-existing `EventModal` `setOpen` warning; build result recorded at phase close.
  - **Phase 12D fix — member collaboration (asymmetric-sharing bug).** Two-account smoke testing showed group sharing was **asymmetric**: the group owner saw members' new content, but members did not reliably see the owner's new trips.
    - **Root cause:** `can_manage_trip_row` authorized group trip rows for the **group owner only** (`is_group_owner`), while every other group helper was already member-based. Hydration `upsert`s visible group trips into a member's local RxDB, which RxDB pushes back through `sync_trip_documents`; the owner-only check rejected the non-owner member's push (`TRIP_UPDATE_NOT_ALLOWED` unless byte-identical) → the **member's trips replication stalled** → owner→member trip updates stopped flowing. The owner could manage all group rows, so the owner never stalled — hence the asymmetry. (Events were already member-collaborative via `can_edit_trip_events`.)
    - **Fix (SQL):** `can_manage_trip_row` now allows any **active group member** (`is_group_member`) for group rows; personal trips stay owner-only. The `sync_trip_documents` UPDATE branch still preserves top-level `user_id`, JSON `owner_id`, workspace identity, and `created_at`, so collaboration never transfers ownership. New follow-up migration `supabase/migrations/20260618_group_member_collaboration_fix.sql` (the original 20260618 was already deployed); `bootstrap.sql` updated to ship the fixed helper.
    - **Fix (frontend):** new pure helper `canManageTrip(trip, workspace, userId)` — for a group workspace, any in-workspace (i.e. member-visible) group trip is manageable; personal stays owner-only. `TripLibrary` now gates edit/delete via `canManageTrip` instead of `trip.owner_id === currentUser`, so members can edit/soft-delete shared group trips. Event create/edit was already member-allowed and unchanged. No new migration needed beyond the SQL fix; no UI redesign; no permission roles.
    - **Tests:** `workspace.test.ts` extended with 4 `canManageTrip` cases (owner personal, non-owner personal, any member on a group trip, different-group rejection). **99 tests pass** (was 95).
    - Build/lint/test result: `npm test` 99/99 passed; `npm run build` passed; targeted eslint on `workspace.ts` / `workspace.test.ts` / `TripLibrary.tsx` clean (0 problems).
- **Phase 12D.1 / 12F-lite — stabilization (auth email UX + owner-only group edit/delete + dev reset docs).** No new migration; no Phase 12E permission roles.
  - **Goal A — auth reset-email rate-limit UX.** Supabase's built-in email provider has a very low send limit; repeated "Forgot password" requests return `email rate limit exceeded` (HTTP 429). New pure helpers in `src/lib/authRecovery.ts`: `isRateLimitError(error)` (429 / "rate limit" / "rate_limit" in message or code) and `describeResetEmailError(error)` → friendly `RATE_LIMIT_RESET_MESSAGE` ("Too many reset emails were requested. Please wait about an hour and try again."), a connection hint for network errors, else pass-through. `Auth.tsx` now maps the reset error through `describeResetEmailError` instead of showing the raw provider string. **No bypass attempted** — no service-role/Management API/SMTP secrets in the client. Forgot-password double-submit was already guarded (`forgotPending`); `ResetPasswordView` already has the invalid/expired-link state + back-to-login. Tests: `authRecovery.test.ts` +7 (rate-limit detection + message mapping).
  - **Goal B — owner-only group edit/soft-delete.** New pure helper `canManageGroup(group, userId)` (owner-only; distinct from member-collaborative `canManageTrip`). New `src/components/Trips/EditGroupModal.tsx` (rename + description via `incrementalPatch` on the local-first `groups` doc; preserves `id`/`owner_id`/`created_at`). `WorkspaceHome` shows owner-only **edit** + **delete** controls (plus existing Copy-Invite) on owned group cards; delete is a confirm `AlertDialog` → soft-delete (`is_deleted=true`), **no hard delete, no cascade** of group trips/events. On delete it also drops the stale online copy and clears the persisted workspace descriptor if it pointed at the deleted group (safe reload). **No migration:** `groups` table already enforces owner-only UPDATE RLS; member-visibility queries already filter `deleted=false`, so deletes hide the group for all members. `trips`/`trip_events` RLS untouched; members still collaborate on group content per 12D. Tests: `workspace.test.ts` +3 (`canManageGroup`).
  - **Goal C — dev reset docs.** New `docs/DEV_RESET.md` (clear local IndexedDB/LocalStorage/Service Worker/PWA cache; clear Supabase dev data; auth users removed manually in Dashboard; re-run migrations in order if recreated; clean two-account smoke test). New `supabase/dev_reset.sql` — **dev-only**, giant warning header, **not** under `migrations/`; deletes content children-first (`trip_events` → `trips` → `group_invites` → `group_members` → `groups`); does not delete auth users.
  - **Docs:** `docs/DEPLOYMENT.md` gained an "Email sending & password-reset rate limits" section (built-in provider = testing only; configure Custom SMTP + raise Auth rate limits in the Dashboard; never commit SMTP/service-role secrets; `/reset-password` redirect reminder retained). `supabase/README.md` gained the `dev_reset.sql` row + a "Group edit/delete (Phase 12D.1)" note (owner-only, no migration).
  - **Scope kept out (deferred to 12E):** member/role management, leave group, remove member, owner transfer, invite revoke/expiry UI, hard delete, cascade delete, custom SMTP integration in code.
  - Build/lint/test result: `npm test` **109/109** passed (was 99); `npm run build` passed; targeted eslint on all touched source/test files clean (0 problems).
- **Phase 12D.2 — group workspace convergence / offline-first sync.** Foundational fix so active members of a group converge to the same authorized dataset (inserts, edits, soft-deletes), including offline edits + reconnect. **No feature work**; 12E/12F paused.
  - **Root cause:** group + personal content share one RxDB collection and **one global `updated_at` replication checkpoint**. A member already logged in (checkpoint advanced by personal activity) who then joins a group never pulls the group's pre-existing rows (`gt(checkpoint)` skips them). Those rows are delivered only by `hydrateGroupWorkspaceContent`, which was **one-shot per session, marked "done" even on failure, and `deleted=false`-filtered** (could only add, never reflect deletes), and could **clobber an unpushed local offline edit** with an older server snapshot. Conflict resolution was last-*push*-wins (order-dependent).
  - **Fix (frontend, no migration needed for convergence):**
    - `src/db/groupContentHydration.ts` rewritten as an idempotent snapshot-reconcile: fetches all group rows **including deleted** (so soft-deletes propagate), bulk-loads existing local docs, and upserts a row only when `shouldHydrateRow(local?.updated_at, incoming.updated_at)` is true (missing or strictly newer) — so a locally-newer unpushed offline edit is preserved. Uses `bulkUpsert`.
    - `src/App.tsx` hydration is now retrying + reconnect-armed: a `hydrationNonce` re-runs the backfill on the `online` event and on a 5s retry after failure; `firstHydrationDoneId` opens the trip-loading gate after the first settle (success **or** failure) so the UI never hangs while background retries converge. (Replaces the old one-shot `hydrationAttemptedGroupId` guard.)
    - New pure helper `src/lib/groupSync.ts` `shouldHydrateRow` (+ `groupSync.test.ts`, 5 cases).
  - **Conflict policy (now explicit & deterministic): last-write-wins by `updated_at`.** Server sync RPCs (`sync_trip_documents` / `sync_trip_event_documents`) skip an UPDATE whose incoming `updated_at` < the stored row's; the client hydration mirrors it. Ties → last push wins. **SQL change is NOT required for visibility convergence** (frontend-only); it is a recommended determinism refinement shipped as `supabase/migrations/20260619_group_sync_lww.sql` (the 20260618 RPCs were already deployed) and folded into `bootstrap.sql`.
  - **What still holds:** offline create/edit already worked via RxDB's retrying push queue + the member-collaborative RPC (12D fix); new post-join changes propagate via realtime→pull. Nested event fields (memo/todos/lat/lng/location) sync in full (whole JSONB blob). Personal data stays private; non-members denied by RLS. UI scoping is by workspace (not owner).
  - Build/lint/test result: `npm test` **114/114** passed (was 109); `npm run build` passed; targeted eslint on `groupSync.ts` / `groupSync.test.ts` / `groupContentHydration.ts` / `App.tsx` clean (0 problems).

- **Phase 12D.3 - Auth email rate-limit UX/docs + responsive timeline/overview polish.** No group sync/RLS/RPC/replication changes.
  - **Auth UX:** signup confirmation and forgot-password email-send limits now share one friendly message: `Too many emails were requested. Please wait about an hour and try again.` `isRateLimitError` detects HTTP 429, `email rate limit`, `rate limit`, and `rate_limit`; `describeSignUpError` and `describeResetEmailError` use that shared classification. No Supabase limit bypass, service-role key, Management API, or SMTP secret is added to frontend code.
  - **Layout polish:** `ResponsiveLayout` uses more tablet/desktop width; `TimelineView`/`DayColumn` use stable responsive day-column widths plus `min-w-max` inside the scroll container; `TripViewer` day tabs use native horizontal overflow with a `min-w-max` inner row so long date ranges remain reachable.
  - **Docs/tests:** deployment/Supabase docs explain built-in provider limits for signup and recovery email, Custom SMTP, Auth Rate Limits, and `/reset-password` redirect URLs. `authRecovery.test.ts` covers signup/reset rate-limit mapping.

## Hardcode classification (Phase 9 release audit)

Remaining `nagoya-2026` / `Nagoya` / `名古屋` / `2026-01-31` / `2026-02-07` references:
- **Allowed legacy seed/demo data:** `src/db/trips.ts` (`LEGACY_TRIP_ID` + seeded "Nagoya 2026" trip + its dates). Adopt-existing-events data, not active routing.
- **Allowed comments:** `src/App.tsx` (bootstrap comment), `src/lib/parser.ts` (date-header regex example), `src/components/TripViewer/TripViewer.tsx` (Phase 9 note documenting the mock-weather removal). `src/services/geocoding.ts` example is now generic (no Nagoya).
- **Allowed legacy fallback constants:** `src/context/SettingsContext.tsx` `LEGACY_KEY_LANG`/`LEGACY_KEY_FONT` (`nagoya_*`) — read-once migration only.
- **REMOVED in Phase 9:** the mock `WEATHER_FORECAST` (Nagoya 2026 dates) is gone from TripViewer. No active component shows mock/Nagoya weather. Real weather is event-coordinate-based only.
- **Brand rename:** Active branding is now Aurea. The installed/PWA/fav icon uses `public/aurea-mark.png`, and the splash screen uses `public/aurea-splash.png`. `public/logo.svg` remains as a legacy neutral asset, but active UI no longer references it.
- **Active runtime risk:** NONE — no routing on `nagoya-2026`; create/import default to the selected trip; no visible product copy/asset/weather implies all trips are Nagoya.

In progress:
- (none - brand rename complete; next planned product phase is Phase 12E group permission/lifecycle hardening.)

Next — Post-release backlog / maintenance:
- **Phase 12E - group permission/lifecycle hardening.** Roles UI, member management, leave/remove member, invite revoke/expiry UI, owner transfer decisions, and finer delete/archive permissions for collaborative group content.
- Trip **archive/status** (deliberate `trips` schema-version migration).
- **Backend quota enforcement** (trigger / RPC / RLS / edge function) — frontend quotas are UX-only.
- **Real trip-level (per-day) weather** forecast.
- **Raster PWA icons** (192/512 PNG) if iOS/Android home-screen fidelity needs them.
- **Legacy lint-debt cleanup** (remaining `no-explicit-any` / react-hooks in untouched files).
- Optional **cascade soft-delete** of a trip's events on trip delete (behind explicit confirmation).

## Architecture Changes (running log)

- **Phase 12D.3:** Auth email error handling is centralized in `authRecovery.ts` for both signup and password-reset email sends. Timeline/Overview polish is purely presentational: a wider workspace shell on tablet/desktop, stable responsive timeline day widths, and horizontal overflow for timeline and overview day selectors. No database schema, sync, RLS, RPC, or group permission logic changed.
- **Brand rename:** Journey Ledger is now Aurea in visible UI, metadata, PWA manifest, README, and deployment docs. The rename is branding/metadata only: no Supabase table/RLS/RPC/migration, RxDB schema/database-name, replication identifier, or localStorage compatibility key was changed.
- **Phase 12D:** Trips/events are now shared group content when their parent trip belongs to a group workspace. The `trips` and `trip_events` replication push path uses SECURITY DEFINER RPCs instead of direct table upsert, so inserts assign `user_id`/`owner_id` to the creator and updates preserve existing ownership/workspace/parent-trip identity. Pull includes top-level `user_id` and no longer re-owns shared documents locally. Event schema v4 adds optional `workspace_type`/`workspace_id`; parent trip remains the source of truth for legacy events. `AppContent` hydrates group workspaces by fetching visible group trips/events online to cover rows older than the local replication checkpoint.
- **Phase 12D fix (member collaboration):** Group content is **fully collaborative for active members**, not just the owner. `can_manage_trip_row` is now member-based (`is_group_member`) instead of group-owner-based — this both enables member trip create/edit and removes the member-side replication stall that made owner→member trip sharing asymmetric (hydration push-back of group trips no longer rejected). Ownership is still preserved on update by `sync_trip_documents` (membership grants collaboration, not ownership transfer); personal trips stay owner-only. Frontend gates trip edit/delete via the new pure helper `canManageTrip(trip, workspace, userId)` (member-collaborative for group workspaces, owner-only for personal). Follow-up migration `supabase/migrations/20260618_group_member_collaboration_fix.sql`; `bootstrap.sql` ships the fixed helper. No schema/replication-shape change.
- **Phase 12D.1 / 12F-lite:** Two distinct group capabilities are now cleanly separated. **Group *content* (trips/events) = member-collaborative** (`canManageTrip` / member-based RLS, from 12D). **The group *document* (name/description/soft-delete) = owner-only** (`canManageGroup` = `isGroupOwner`; the `groups` table's pre-existing owner-only UPDATE RLS is the authoritative guard). Owner-only edit/delete lives in `WorkspaceHome` (+ `EditGroupModal`), operating on the local-first RxDB `groups` doc; soft-delete sets `is_deleted=true` (member-visibility queries filter `deleted=false`, hiding it for everyone) with **no cascade** to group trips/events and **no migration**. Auth reset-email errors are classified in `authRecovery.ts` (`isRateLimitError`/`describeResetEmailError`) for friendly rate-limit messaging — no provider bypass, no secrets in the client. Dev-only reset path documented (`docs/DEV_RESET.md` + `supabase/dev_reset.sql`, outside `migrations/`).
- **Phase 12D.2:** Group convergence rests on **hydration as a repeatable snapshot-reconcile**, not the incremental pull (whose single global `updated_at` checkpoint can skip a group's pre-existing rows). `hydrateGroupWorkspaceContent` now includes deleted rows, applies last-write-wins per row (`shouldHydrateRow` in `src/lib/groupSync.ts`) so it never clobbers unpushed offline edits, and uses `bulkUpsert`. `AppContent` re-arms hydration via a `hydrationNonce` on the `window 'online'` event and on a timed retry after failure (replacing the one-shot guard), while `firstHydrationDoneId` keeps the trip-loading gate from hanging. Conflict policy is now explicit deterministic **last-write-wins by `updated_at`**, enforced in the sync RPCs (`20260619_group_sync_lww.sql` + `bootstrap.sql`) and mirrored client-side. No schema change; replication shape unchanged.
- **Phase 1:** Second RxDB collection `trips` alongside `tripevents`. Independent Supabase replication channel (`trips_db_changes`, identifier `supabase-jsonb-trips-v1`). Trips replication failures are isolated from events replication. Legacy trip bootstrap runs once per load (no-op if the trip already exists locally).
- **Phase 2:** Trip-selection gate in `AppContent` (`selectedTripId` state). New `src/components/Trips/` module (TripLibrary / TripCard / CreateTripModal). TripLibrary is the post-auth landing; the legacy single-trip workspace renders only after a trip is selected. Workspace internals remain legacy-scoped (`TRIP_ID = 'nagoya-2026'`) — selection is an entry point, not yet a data scope. `selectedTripId` is in-memory only (not persisted across reloads).
- **Phase 3:** Workspace extracted from `App.tsx` into `src/components/TripWorkspace.tsx`, which takes the resolved `trip` object. `App.tsx` is now a thin router (AppShell → AppContent → TripLibrary | TripWorkspace). TripDashboard displays the selected trip's identity. The legacy `TRIP_ID = 'nagoya-2026'` is now isolated in ONE place (`TripWorkspace`) with an explicit Phase 4 TODO block listing every inner view that still depends on it.
- **Phase 4:** All core event views/writes are trip-scoped via `trip.id`, and day ranges are derived from `trip.start_date`/`trip.end_date`. The active `nagoya-2026` constant is gone; `nagoya-2026` now only persists as the legacy seed trip's id + its events' `trip_id`. Scoping is enforced at the RxDB query level (`trip_id` selector) in TripViewer/TimelineView/TripTable, at the write level in EventModal/ImportModal (`trip_id: tripId`), and structurally by `key={trip.id}` remounting the workspace. EventDetailView remains id-based but is only fed trip-scoped ids.
- **Phase 5:** Active UI rebranded to Journey Ledger (i18n copy, TripLibrary, dashboard footer). Photo/base64 upload removed from EventDetailView (existing images read-only; schema unchanged). Mock weather hidden for non-legacy trips. Settings localStorage keys renamed to `journey_ledger_*` with one-time legacy fallback. New header "All Trips" button decouples "return to library" from the logo. No data-layer changes; Phase 4 trip-scoping intact.
- **Phase 6:** `src/lib/` pure-logic layer + Vitest (`vitest run`): `quotas.ts` (frontend UX quotas, enforced in Create/Event/Import/Detail), `dateRange.ts` (`buildTripDays`), `tripScoping.ts` (`tripEventsSelector`). Supabase RLS/setup docs expanded. No schema/replication/UI changes.
- **Phase 7:** Trip management without schema change — `EditTripModal` (soft `incrementalPatch`), soft-delete from TripLibrary (`is_deleted=true`, events untouched), and `src/lib/selectedTrip.ts` persistence (`journey_ledger_selected_trip_id`). `AppContent` now resolves the persisted selection, excludes deleted trips, and recovers to the library via derived state (no setState-in-effect, no infinite loading). `dateRange.ts` gained `isValidTripDateRange` (used by Create + Edit). Archive deferred (no schema field).
- **Phase 8:** Release polish only. Single neutral brand asset `public/logo.svg` replaces all Nagoya binaries (favicon, splash, workspace logo, PWA manifest icon); unused image binaries + dead `LandingPage.tsx` deleted. `noise.png` reference removed (build warning gone). Docs finalized: `README.md`, new `docs/DEPLOYMENT.md`, backend-quota design note in `supabase/README.md`. No data-layer, schema, or behavior changes.
- **Phase 9:** Mock trip weather removed. TripViewer no longer renders trip-level weather (the `WEATHER_FORECAST` Nagoya mock is deleted); the only weather in the app is real, event-coordinate-based Open-Meteo data in `EventDetailView`/`SpotWeather`/`useSpotWeather` (keyless, hidden when no coordinates). Geocoding unchanged (Open-Meteo + Nominatim, keyless). No schema/replication changes.
- **Phase 10:** No architecture change — deployment readiness only. `vercel.json` SPA rewrite (+`$schema`), expanded `docs/DEPLOYMENT.md` (Vercel + Supabase Auth URLs + two-account RLS isolation test + multi-device sync test + iPhone install). App is a Release Candidate.
- **Phase 11:** UX polish. **Auto-seed removed** — `App.tsx` no longer calls `ensureLegacyTrip()`; new users get an empty library (existing trips persist via replication). New responsive timeline-density layer: `useTimelineScale()` hook is the single source of truth for pixels-per-minute, threaded through TimelineView/DayColumn/TimelineEvent (desktop unchanged, tablet/mobile compacted). Auth/EventModal/ImportModal gained double-submit guards. Top-nav row is horizontally scrollable on mobile. No schema/replication changes; Phase 4 isolation + Phase 7 edit/delete/persistence intact.
- **Phase 12A:** Workspace layer above All Trips. `AppContent` now routes WorkspaceHome → TripLibrary(workspace) → TripWorkspace, with workspace + trip persisted (and validated against the current user / current workspace so selections can't leak across workspaces). New `src/lib/workspace.ts` (Workspace model + personal-fallback helpers) and `src/components/Workspaces/WorkspaceHome.tsx`. `trips` schema bumped v0→v1 (optional `workspace_type`/`workspace_id`, no-op migration); replication unchanged (JSONB). Personal flow behaves exactly like the previous app; Groups are a non-functional placeholder.
- **Phase 12B:** Third RxDB collection `groups` (owner-scoped) with its own Supabase JSONB replication channel (`groups_db_changes`, identifier `supabase-jsonb-groups-v1`), independent of trips/events. `WorkspaceHome` lists groups + Create Group; selecting a group opens a group-scoped `TripLibrary`. `AppContent` persists the workspace id and resolves a **group** workspace reactively from the collection (Personal resolves synchronously from userId); recovery clears storage and falls through to WorkspaceHome. Group affordances exist but sharing is still local/owner-only (no `group_members`, RLS-beyond-own-row, invite codes, or RPC).
- **Phase 12C:** **Hybrid local-first + server-auth model for groups.** Membership and invites are intentionally NOT local-first — they live in Postgres (`group_members`, `group_invites`) and are accessed via direct Supabase calls + a SECURITY DEFINER join RPC (`src/services/groups.ts`), because a member cannot replicate a group they don't own without an ownership push-back conflict. Owned groups remain local-first (RxDB); the RxDB `groups` pull is now pinned to `.eq('user_id', userId)` so the widened owner-OR-member SELECT RLS can't leak joined groups into the owner-scoped local store. `WorkspaceHome` unions RxDB-owned + online-fetched groups (`mergeGroupsById`). `AppContent` no longer resolves a group workspace from a local doc; it reconstructs the active workspace from a persisted descriptor (`saveSelectedWorkspace`/`loadSelectedWorkspace`, `{id,name,type}`) so a **joined** group (no local doc) survives reload. Group **trip/event** sharing is unchanged (owner-scoped) → Phase 12D. New pure libs: `src/lib/inviteCode.ts`; `src/lib/workspace.ts` gained `isGroupOwner` + `mergeGroupsById`/`GroupSummary`.
- **Phase 12C.1:** Client-only auth recovery route. `Auth.tsx` sends Supabase reset emails with `redirectTo = window.location.origin + '/reset-password'`; `App.tsx` intercepts `/reset-password`; `ResetPasswordView` updates the password through `supabase.auth.updateUser`, then signs out the temporary recovery session and sends the user back to login. No Supabase schema/RLS/replication changes.

## Known Risks (running log)

- **Phase 12D - group sharing:**
  - Manual Supabase action required: run `supabase/migrations/20260618_group_trip_event_sharing.sql` **and** the follow-up `supabase/migrations/20260618_group_member_collaboration_fix.sql` before cross-account group trip/event sharing works correctly. (A fresh project running `bootstrap.sql` already has the fix.) Without the fix, owner→member trip sharing is asymmetric (members stall).
  - **Trip + event create/edit/soft-delete is allowed for ALL active group members** (collaborative). Membership grants collaboration; the sync RPC preserves `user_id`/`owner_id`/workspace/`created_at` on update, so no ownership transfer. Personal content stays owner-only; non-members are denied by RLS (`is_group_member`). No role hierarchy yet (owner/member only) — richer roles/capabilities are Phase 12E.
  - **Collaborative soft-delete:** any active member can soft-delete a shared group trip (`is_deleted=true` on the shared row), hiding it for all members. Intentional for now; finer-grained delete permissions are Phase 12E.
  - Hydration writes visible server rows into local RxDB and may push them back; with the member-collaboration fix `sync_trip_documents` accepts these from any active member (preserving ownership), so member replication no longer stalls.
  - Membership revocation recovery remains limited: a previously persisted group descriptor may still open an empty/stale workspace until online fetch/RLS denies shared content and the user returns to Workspaces.
- **Phase 12D.2 — convergence / offline sync (remaining limitations):**
  - **Eventual, not instant.** Convergence depends on connectivity + realtime/replication + hydration backfill. While offline, a member sees their own local state; pending pushes flush on reconnect (RxDB retrying queue) and other members converge after their next pull/hydration.
  - **Hydration is online + RLS-scoped.** The backfill is a Supabase fetch; fully offline it can't run (it retries on reconnect). A member offline at first group entry sees group content only after connectivity returns (or after a fresh login, which resets the checkpoint and pulls everything).
  - **Conflict policy = last-write-wins by `updated_at`.** Concurrent edits to the same row converge to the highest `updated_at` (ties → last push). This is field-level coarse (whole-row), not per-field merge; simultaneous edits to different fields of the same event do not merge — the later write wins the whole row. Per-field/CRDT merge is out of scope.
  - **Clock dependence.** `updated_at` is client `Date.now()`; significant client clock skew can mis-order LWW. Acceptable for the MVP; a server-authoritative timestamp is future work.
  - **Hydration re-pushes.** `bulkUpsert` of backfilled rows still triggers a redundant (ownership-preserving, LWW no-op) push; harmless but minor write amplification.
  - **Deletes converge** via both the incremental pull (delete bumps `updated_at`) and the now delete-aware hydration; a member offline during a delete reflects it after reconnect.
  - The `20260619_group_sync_lww.sql` migration is **recommended (deterministic conflict winner)** but **not required for convergence** — the frontend hydration changes restore convergence on their own.
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
- **Phase 7 — resolves prior limitations + remaining risks:**
  - RESOLVED: trip **edit** and **soft-delete** now exist; selected trip is **persisted** across reloads; missing/deleted selection **recovers** to TripLibrary (no more perpetual "Loading trip…").
  - **Archive still deferred** — `trips` schema has no status/archive field; implementing it requires a deliberate RxDB schema-version migration.
  - Soft-deleting a trip **does not delete its events** (they remain under their `trip_id`, just hidden because no non-deleted trip references them in the library). Intentional MVP; optional cascade soft-delete is a future opt-in.
  - Recovery clears only the persisted localStorage id, not the in-memory `selectedTripId` state; the derived view shows the library. Edge: if a soft-deleted trip is later un-deleted (e.g. external re-sync) within the same session, the workspace could reappear. Extremely unlikely; harmless.
  - Cross-device race: on reload, a persisted trip not yet pulled from Supabase could briefly recover to the library before sync completes (local-first). Acceptable (no infinite load); local/legacy trips are present immediately.
- **Phase 12B — groups shell (NOT real sharing):**
  - Groups are **owner-scoped only**. A group is visible solely to its creator (own-row RLS + local cleanRoom). There is **no shared membership, no invite codes, no group RLS beyond own-row, no cross-user access, no roles** — do NOT treat group workspaces as a collaboration/security boundary yet.
  - **Manual Supabase action:** a fresh project's `bootstrap.sql` now includes `groups`; an existing project must run `supabase/migrations/20260616_create_groups.sql`. Until applied, groups work fully locally; groups replication logs an error and no-ops (no data loss), exactly like trips in Phase 1.
  - New RxDB collection `groups` (v0). Adding a brand-new collection needs no migration; existing local DBs simply gain the collection on next init. Verify on first `npm run dev`.
  - No group deletion/archive UI yet (a group can be soft-deleted only via direct data edit). `getTripWorkspace` still returns a placeholder name `'Group'` for a group-tagged trip when resolved without the group doc; the live UI resolves the real name from the collection.
- **Phase 12A — workspace foundation:**
  - **RxDB `trips` schema is now version 1.** First boot after this change migrates existing local trip docs (no-op strategy). Verify on first `npm run dev` that the migration runs cleanly; if a local DB was created mid-development at v0, RxDB handles it via the registered strategy. No Supabase change.
  - Only the **Personal** workspace exists. Group affordances are disabled placeholders; selecting a group is not possible yet. `getTripWorkspace` returns a minimally-named `'Group'` for group-tagged trips (real group names arrive with the groups model in a later phase).
  - Cross-user safety: a persisted workspace id is only restored when it equals `personal:${currentUserId}`; on a different user (same browser) it is ignored. `cleanRoom` already wipes the local DB on login, so trip data does not cross users; the workspace persistence guard covers the localStorage side.
  - Backend group RLS / sharing is intentionally absent — do NOT assume group workspaces are secure until a later phase adds `groups`/`group_members` tables + RLS.
- **Phase 8 — release polish:**
  - PWA manifest now uses a single **SVG** icon (`image/svg+xml`, `sizes:any`, `purpose:any maskable`). Modern browsers accept this for install; if a target platform requires raster PWA icons (e.g. older Android/iOS home-screen rendering), add 192/512 PNGs later. No store submission depends on this today.
  - `apple-touch-icon` now points to the SVG; iOS historically prefers PNG for the home-screen icon — acceptable for now, revisit in an asset pass if iOS install fidelity matters.
  - Pre-existing legacy lint debt remains in untouched files (e.g. EventModal `setOpen` warning, other `no-explicit-any`) — out of scope for this phase.
- **Phase 12C — group membership + invites (membership only; NOT trip/event sharing):**
  - **Manual Supabase migration required:** `migrations/20260617_group_members_invites.sql` must be applied before cross-account joining works. Until then, joins fail and joined groups don't appear; owned-group creation still works locally (no data loss). On a fresh project, `bootstrap.sql` already includes everything.
  - **Group trips/events are still owner-scoped.** A joined member can SEE a group and enter its workspace, but `trips`/`trip_events` RLS is unchanged — they see only their own (typically empty) trips for that group. **Do NOT treat a group workspace as a shared content boundary yet.** Cross-user trip/event sharing is Phase 12D and needs workspace metadata on events + member-aware RLS.
  - **Joined-group visibility needs connectivity.** Owned groups are offline-first (RxDB), but joined (member, non-owner) groups are fetched online (`fetchVisibleGroups`). Offline, a member won't see groups they don't own; `fetchVisibleGroups` fails soft (returns `[]`) so owned groups still render.
  - **Reload into a joined group is descriptor-based, not validated.** The active group workspace is reconstructed from the persisted `{id,name,type}` descriptor (no local doc lookup). If membership was revoked server-side, the user still lands in the (empty) workspace until they click "Workspaces" — there's no client-side membership re-check on reload. Acceptable for this phase.
  - **Owner membership depends on replication.** The `owner` membership row is created by an `AFTER INSERT` trigger when the locally-created group **reaches Supabase**. If a group is created entirely offline and never syncs, no membership/invite is possible until it replicates. Expected (offline = local-only).
  - **No invite expiry/revoke UI.** The schema + RPC support `expires_at` and `revoked`, but the UI only generates/copies a non-expiring code; revoking requires a direct DB edit for now.
  - **Roles are minimal.** Only `owner`/`member`; no admin/editor/viewer and no role-management UI (out of scope by design).

- **Phase 12C.1 — auth recovery:**
  - Supabase Auth Redirect URLs must include both `/reset-password` and the SPA wildcard for production and local dev. If omitted, reset links will not return to the app correctly.
  - The reset form intentionally signs out the temporary recovery session after `updateUser`, so the user signs in normally with the new password and the existing clean-room local DB wipe still runs.
  - Browser smoke verified the login card, forgot-password modal validation, and invalid/expired `/reset-password` fallback. A real reset email requires a configured Supabase project and redirect URLs.

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
