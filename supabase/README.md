# Supabase Setup

This folder holds SQL you must apply manually to your Supabase project (the app
cannot create tables itself).

## Migrations

| File | Purpose | Status |
|------|---------|--------|
| `migrations/20260615_create_trips.sql` | Phase 1 — creates the `trips` mirror table + RLS policies + realtime publication. | **Apply manually** |

## How to apply

1. Open your Supabase project → **SQL Editor**.
2. Paste the contents of the migration file and run it.
3. Verify the `trips` table exists with RLS enabled.

## Why manual

Trips use the same local-first + JSONB sync pattern as `trip_events`. Until the
`trips` table exists, the local RxDB `trips` collection still works fully offline;
trips replication will simply log an error and no-op (event sync is unaffected).

The expected column contract and RLS assumptions are documented inline at the top
of `migrations/20260615_create_trips.sql`.
