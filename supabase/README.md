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

## RLS assumptions (both tables)

- **SELECT / INSERT / UPDATE** are scoped to `user_id = auth.uid()`.
- Soft-delete is an UPDATE (`deleted = true`) — covered by the UPDATE policy.
- Hard `DELETE` is intentionally **not** granted.

## Why manual

Trips and events use the same local-first sync pattern. Until the tables exist,
the local RxDB collections still work fully offline; replication will log an
error and no-op (no data loss). Cross-device sync activates once the SQL is
applied.
