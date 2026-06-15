# Supabase Setup

This folder holds SQL you must apply manually to your Supabase project (the app
cannot create tables itself).

## Which file do I run?

| Scenario | Run this |
|----------|----------|
| **Brand-new / fresh Supabase project** | `bootstrap.sql` — provisions everything (`trip_events` + `trips`, indexes, RLS, realtime) in one idempotent script. |
| **Existing project that already has `trip_events`** (legacy Nagoya setup) | `migrations/20260615_create_trips.sql` — adds only the new `trips` table. |

Both scripts are idempotent and safe to re-run.

## How to apply

1. Open your Supabase project → **SQL Editor** → New query.
2. Paste the contents of the chosen file and **Run**.
3. Verify the tables exist with RLS enabled (Table Editor / Authentication → Policies).

## Files

| File | Purpose |
|------|---------|
| `bootstrap.sql` | Full bootstrap for a fresh project: `trip_events` + `trips` tables, indexes, RLS policies, realtime publication. |
| `migrations/20260615_create_trips.sql` | Phase 1 incremental: `trips` table only (for projects that already had `trip_events`). |

## Sync contract

Both tables share the same local-first + JSONB shape used by RxDB replication
(see `src/db/replication.ts`):

| Column | Type | Meaning |
|--------|------|---------|
| `id` | text (PK) | RxDB document id |
| `updated_at` | bigint | epoch **milliseconds**; replication pull checkpoint |
| `deleted` | boolean | soft-delete flag |
| `user_id` | uuid | owner; must equal `auth.uid()` |
| `data` | jsonb | all remaining document fields |

## Required tables & columns

Both `trip_events` and `trips` MUST exist with exactly these columns (the RxDB
replication handlers in `src/db/replication.ts` depend on this shape):

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | RxDB document id |
| `updated_at` | bigint | epoch **milliseconds**; replication pull checkpoint |
| `deleted` | boolean | soft-delete flag (maps to local `is_deleted`) |
| `user_id` | uuid | owner; references `auth.users(id)`; must equal `auth.uid()` |
| `data` | jsonb | all remaining document fields |

## RLS policy expectations (both tables)

RLS MUST be enabled on both tables, with policies scoped to the authenticated user:

- **SELECT** — a user can read only their own rows (`auth.uid() = user_id`).
- **INSERT** — a user can insert only rows they own (`with check (auth.uid() = user_id)`).
- **UPDATE** — a user can update only their own rows (`using` + `with check` on `auth.uid() = user_id`).
- **Soft delete** is performed as an UPDATE that sets `deleted = true` — covered by the UPDATE policy.
- **Hard `DELETE` is intentionally NOT exposed** (no DELETE policy is granted). Rows are never physically removed by the app.

## Realtime publication expectations

Both tables must belong to the `supabase_realtime` publication so the client's
`postgres_changes` subscriptions (`trip_events_db_changes`, `trips_db_changes`)
fire. `bootstrap.sql` adds them idempotently.

## API keys / secrets

- The client uses the **anon / publishable** key only (`VITE_SUPABASE_ANON_KEY` in `.env.local`).
- **NEVER** place the `service_role` / secret key in `.env.local` or any client-bundled env — it bypasses RLS and would be shipped to the browser.
- `.env.local` must not be committed (see repo `.gitignore`).
- All client-side quota limits (see `src/lib/quotas.ts`) are a **UX guard only**, not a security boundary. Authoritative quota/row-ownership enforcement is RLS (ownership) plus future backend checks (per-user/per-trip counts) — see CLAUDE.md "recommended next small phases".

## Verifying after setup

After running the SQL:

1. **Table Editor** → confirm `public.trip_events` and `public.trips` exist with the 5 columns above.
2. **Authentication → Policies** → confirm RLS is **enabled** and each table has SELECT / INSERT / UPDATE policies (no DELETE policy).
3. **Database → Publications → `supabase_realtime`** → confirm both tables are included.
4. Smoke test from the app: sign in, create a trip, add an event, reload — data should persist and (on a second device) sync.

## Why manual

Trips and events use the same local-first sync pattern. Until the tables exist,
the local RxDB collections still work fully offline; replication will log an
error and no-op (no data loss). Cross-device sync activates once the SQL is
applied.
