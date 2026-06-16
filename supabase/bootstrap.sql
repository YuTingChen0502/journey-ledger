-- =============================================================================
-- Journey Ledger — Full Supabase Bootstrap
-- =============================================================================
-- Run this ONCE on a brand-new Supabase project to provision everything the app
-- needs: the `trip_events` and `trips` mirror tables, indexes, Row Level
-- Security policies, and realtime publication.
--
-- HOW TO RUN
--   1. Supabase dashboard -> SQL Editor -> New query.
--   2. Paste this entire file and Run.
--   3. Confirm both tables exist with RLS enabled (Table Editor / Authentication
--      -> Policies).
--
-- This script is idempotent: it is safe to re-run.
--
-- SYNC CONTRACT (must match src/db/replication.ts)
--   Both tables share the same local-first + JSONB shape used by RxDB
--   replication:
--     id          text     primary key   (RxDB document id)
--     updated_at  bigint                 (epoch MILLISECONDS; pull checkpoint)
--     deleted     boolean                (soft-delete flag)
--     user_id     uuid                   (owner; must equal auth.uid())
--     data        jsonb                  (all remaining document fields)
--
--   trip_events.data fields: trip_id, owner_id, title, description, location,
--     region, lat, lng, place_id, category, image, external_link, is_floating,
--     start_time, end_time, sort_order, created_at, memo, todos.
--   trips.data fields: owner_id, title, destination, start_date, end_date,
--     timezone, description, created_at.
--
-- RLS ASSUMPTIONS (both tables)
--   * SELECT: a user can read only their own rows   (user_id = auth.uid()).
--   * INSERT: a user can insert only rows they own   (user_id = auth.uid()).
--   * UPDATE: a user can update only their own rows   (user_id = auth.uid()).
--   * Soft-delete is performed via UPDATE (deleted = true) and is therefore
--     covered by the UPDATE policy. Hard DELETE is intentionally NOT granted.
--   * user_id is enforced from the authenticated session by the client and by
--     the WITH CHECK clauses below.
-- =============================================================================


-- =============================================================================
-- 1. TABLES
-- =============================================================================

create table if not exists public.trip_events (
    id          text        primary key,
    updated_at  bigint      not null,
    deleted     boolean     not null default false,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    data        jsonb       not null default '{}'::jsonb
);

create table if not exists public.trips (
    id          text        primary key,
    updated_at  bigint      not null,
    deleted     boolean     not null default false,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    data        jsonb       not null default '{}'::jsonb
);

-- Phase 12B: groups. Owner-scoped only for now (NOT yet real shared groups).
create table if not exists public.groups (
    id          text        primary key,
    updated_at  bigint      not null,
    deleted     boolean     not null default false,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    data        jsonb       not null default '{}'::jsonb
);


-- =============================================================================
-- 2. INDEXES
-- Pull queries order/filter by updated_at; ownership filtering by user_id.
-- =============================================================================

create index if not exists trip_events_updated_at_idx on public.trip_events (updated_at);
create index if not exists trip_events_user_id_idx    on public.trip_events (user_id);

create index if not exists trips_updated_at_idx on public.trips (updated_at);
create index if not exists trips_user_id_idx    on public.trips (user_id);

create index if not exists groups_updated_at_idx on public.groups (updated_at);
create index if not exists groups_user_id_idx    on public.groups (user_id);


-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

alter table public.trip_events enable row level security;
alter table public.trips       enable row level security;
alter table public.groups      enable row level security;

-- --- trip_events ------------------------------------------------------------
drop policy if exists "Users can select their own trip_events" on public.trip_events;
create policy "Users can select their own trip_events"
    on public.trip_events for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own trip_events" on public.trip_events;
create policy "Users can insert their own trip_events"
    on public.trip_events for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own trip_events" on public.trip_events;
create policy "Users can update their own trip_events"
    on public.trip_events for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- --- trips -------------------------------------------------------------------
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

-- --- groups ------------------------------------------------------------------
-- NOTE (Phase 12B): own-row access only. This is NOT yet real group sharing —
-- a group is visible only to its creator. Shared membership / invite-code access
-- will require a `group_members` table and broader policies in a later phase.
drop policy if exists "Users can select their own groups" on public.groups;
create policy "Users can select their own groups"
    on public.groups for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own groups" on public.groups;
create policy "Users can insert their own groups"
    on public.groups for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own groups" on public.groups;
create policy "Users can update their own groups"
    on public.groups for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);


-- =============================================================================
-- 4. REALTIME PUBLICATION
-- The client subscribes to postgres_changes on both tables. Add them to the
-- default `supabase_realtime` publication if not already present (idempotent).
-- =============================================================================

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'trip_events'
    ) then
        alter publication supabase_realtime add table public.trip_events;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'trips'
    ) then
        alter publication supabase_realtime add table public.trips;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'groups'
    ) then
        alter publication supabase_realtime add table public.groups;
    end if;
end
$$;

-- =============================================================================
-- Done. trip_events, trips, and groups are provisioned with RLS + realtime.
-- =============================================================================
