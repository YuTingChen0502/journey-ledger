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
-- 2b. GROUP MEMBERSHIP + INVITES (Phase 12C)
-- Defined before RLS so the widened `groups` SELECT policy can reference the
-- `is_group_member` helper. See migrations/20260617_group_members_invites.sql
-- for the standalone, fully-documented version.
-- =============================================================================

create table if not exists public.group_members (
    id          uuid        primary key default gen_random_uuid(),
    group_id    text        not null,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    role        text        not null default 'member',
    status      text        not null default 'active',
    joined_at   timestamptz not null default now(),
    created_at  timestamptz not null default now(),
    unique (group_id, user_id)
);

create table if not exists public.group_invites (
    id          uuid        primary key default gen_random_uuid(),
    group_id    text        not null,
    code        text        not null unique,
    created_by  uuid        not null references auth.users (id) on delete cascade,
    created_at  timestamptz not null default now(),
    expires_at  timestamptz null,
    revoked     boolean     not null default false
);

create index if not exists group_members_group_id_idx on public.group_members (group_id);
create index if not exists group_members_user_id_idx   on public.group_members (user_id);
create index if not exists group_invites_group_id_idx  on public.group_invites (group_id);
create index if not exists group_invites_code_idx       on public.group_invites (code);

-- Helpers (SECURITY DEFINER so RLS policies can use them without recursion).
create or replace function public.is_group_member(p_group_id text, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select exists (
        select 1 from public.group_members m
        where m.group_id = p_group_id and m.user_id = p_user_id and m.status = 'active'
    );
$$;

create or replace function public.is_group_owner(p_group_id text, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select exists (
        select 1 from public.groups g
        where g.id = p_group_id and g.user_id = p_user_id
    );
$$;

-- Auto-create the creator's 'owner' membership on group insert.
create or replace function public.tg_groups_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.group_members (group_id, user_id, role, status)
    values (new.id, new.user_id, 'owner', 'active')
    on conflict (group_id, user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists groups_after_insert_membership on public.groups;
create trigger groups_after_insert_membership
    after insert on public.groups
    for each row execute function public.tg_groups_after_insert();

-- Redeem an invite code (the only non-owner path into membership).
create or replace function public.join_group_by_invite_code(invite_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
    v_invite public.group_invites%rowtype;
    v_uid    uuid := auth.uid();
begin
    if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

    select * into v_invite from public.group_invites where code = invite_code;
    if not found then raise exception 'INVALID_CODE'; end if;
    if v_invite.revoked then raise exception 'REVOKED_CODE'; end if;
    if v_invite.expires_at is not null and v_invite.expires_at < now() then
        raise exception 'EXPIRED_CODE';
    end if;

    insert into public.group_members (group_id, user_id, role, status)
    values (v_invite.group_id, v_uid, 'member', 'active')
    on conflict (group_id, user_id) do nothing;

    return v_invite.group_id;
end;
$$;

grant execute on function public.join_group_by_invite_code(text) to authenticated;


-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

alter table public.trip_events   enable row level security;
alter table public.trips         enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;

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
-- Phase 12C: SELECT is "owner OR active member" (membership table + helper are
-- defined in section 2b above). INSERT/UPDATE remain owner-only. Group TRIPS /
-- EVENTS are still owner-scoped — cross-user trip/event sharing is Phase 12D.
drop policy if exists "Users can select their own groups" on public.groups;
drop policy if exists "Members or owners can select groups" on public.groups;
create policy "Members or owners can select groups"
    on public.groups for select
    using (auth.uid() = user_id or public.is_group_member(id, auth.uid()));

drop policy if exists "Users can insert their own groups" on public.groups;
create policy "Users can insert their own groups"
    on public.groups for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own groups" on public.groups;
create policy "Users can update their own groups"
    on public.groups for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- --- group_members (Phase 12C) ----------------------------------------------
-- SELECT only: your own memberships, or (as owner) all members of your group.
-- Writes happen only via the owner trigger + join RPC (both SECURITY DEFINER),
-- so there is intentionally NO client INSERT/UPDATE/DELETE policy.
drop policy if exists "Select own or owned group memberships" on public.group_members;
create policy "Select own or owned group memberships"
    on public.group_members for select
    using (user_id = auth.uid() or public.is_group_owner(group_id, auth.uid()));

-- --- group_invites (Phase 12C) ----------------------------------------------
-- Owner-only management. Ordinary users can never list codes; they redeem one
-- via join_group_by_invite_code (SECURITY DEFINER).
drop policy if exists "Owners can select group invites" on public.group_invites;
create policy "Owners can select group invites"
    on public.group_invites for select
    using (public.is_group_owner(group_id, auth.uid()));

drop policy if exists "Owners can insert group invites" on public.group_invites;
create policy "Owners can insert group invites"
    on public.group_invites for insert
    with check (public.is_group_owner(group_id, auth.uid()) and created_by = auth.uid());

drop policy if exists "Owners can update group invites" on public.group_invites;
create policy "Owners can update group invites"
    on public.group_invites for update
    using (public.is_group_owner(group_id, auth.uid()))
    with check (public.is_group_owner(group_id, auth.uid()));


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
