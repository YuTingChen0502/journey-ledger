-- Journey Ledger — Phase 1: `trips` mirror table
--
-- Trips are first-class records synced with the same local-first + JSONB pattern
-- used by `trip_events`. Apply this migration manually in your Supabase project
-- (SQL Editor) before relying on cross-device trip sync. Until it exists, trips
-- replication will log an error and no-op locally (events sync is unaffected).
--
-- Column contract (must match src/db/replication.ts -> startTripsReplication):
--   id          text     primary key   (Trip.id, e.g. 'nagoya-2026')
--   updated_at  bigint                 (epoch milliseconds; replication checkpoint)
--   deleted     boolean                (soft-delete flag; maps to Trip.is_deleted)
--   user_id     uuid                   (owner; must equal auth.uid())
--   data        jsonb                  (remaining Trip fields: title, destination,
--                                        start_date, end_date, timezone, description,
--                                        owner_id, created_at)

create table if not exists public.trips (
    id          text primary key,
    updated_at  bigint      not null,
    deleted     boolean     not null default false,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    data        jsonb       not null default '{}'::jsonb
);

-- Pull queries order/filter by updated_at.
create index if not exists trips_updated_at_idx on public.trips (updated_at);
create index if not exists trips_user_id_idx on public.trips (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Assumptions / policy intent:
--   * Users can SELECT only their own trips        (user_id = auth.uid()).
--   * Users can INSERT only trips they own         (user_id = auth.uid()).
--   * Users can UPDATE only their own trips        (user_id = auth.uid()).
--   * Soft-delete is performed via UPDATE (deleted = true), so it is covered by
--     the UPDATE policy. A hard DELETE policy is intentionally NOT granted.
--   * `user_id` is enforced from the authenticated session by the client and by
--     the WITH CHECK clauses below.
-- ---------------------------------------------------------------------------

alter table public.trips enable row level security;

drop policy if exists "Users can select their own trips" on public.trips;
create policy "Users can select their own trips"
    on public.trips for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own trips" on public.trips;
create policy "Users can insert their own trips"
    on public.trips for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own trips" on public.trips;
create policy "Users can update their own trips"
    on public.trips for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Realtime: the client subscribes to postgres_changes on public.trips.
-- Ensure the table is part of the realtime publication.
alter publication supabase_realtime add table public.trips;
