-- =============================================================================
-- Journey Ledger — Full Supabase Bootstrap
-- =============================================================================
-- Run this ONCE on a brand-new Supabase project to provision everything the app
-- needs: the `trip_events`, `trips`, and group-sharing tables, indexes, Row
-- Level Security policies, ownership-safe sync RPCs, and realtime publication.
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
--     user_id     uuid                   (creator/owner; preserved on update)
--     data        jsonb                  (all remaining document fields)
--
--   trip_events.data fields: trip_id, owner_id, title, description, location,
--     region, lat, lng, place_id, category, image, external_link, is_floating,
--     start_time, end_time, sort_order, created_at, memo, todos.
--   trips.data fields: owner_id, title, destination, start_date, end_date,
--     timezone, description, created_at.
--
-- RLS / SYNC ASSUMPTIONS
--   * Personal trips/events stay private to user_id.
--   * Group trips/events are visible to active group members.
--   * trips/trip_events writes go through SECURITY DEFINER sync RPCs, which set
--     user_id on insert and preserve user_id + data.owner_id on update.
--   * Direct INSERT/UPDATE policies on trips/trip_events are intentionally false.
--   * Hard DELETE is intentionally NOT granted; soft-delete uses deleted = true.
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
create index if not exists trip_events_trip_id_idx    on public.trip_events ((data->>'trip_id'));

create index if not exists trips_updated_at_idx on public.trips (updated_at);
create index if not exists trips_user_id_idx    on public.trips (user_id);
create index if not exists trips_workspace_idx  on public.trips ((data->>'workspace_type'), (data->>'workspace_id'));

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

-- Phase 12D: member-aware trip/event visibility and ownership-safe sync RPCs.
create or replace function public.can_view_trip_row(
    p_user_id uuid,
    p_data jsonb,
    p_uid uuid
)
returns boolean language sql security definer stable set search_path = public as $$
    select p_uid is not null
       and (
            p_user_id = p_uid
            or (
                p_data->>'workspace_type' = 'group'
                and coalesce(p_data->>'workspace_id', '') <> ''
                and public.is_group_member(p_data->>'workspace_id', p_uid)
            )
       );
$$;

-- Phase 12D (collaboration fix): group trip metadata is manageable by any ACTIVE
-- GROUP MEMBER, not just the group owner. Personal trips stay owner-only; the
-- sync RPC still preserves user_id/owner_id/workspace/created_at, so this grants
-- collaboration without ownership transfer. (See migration
-- 20260618_group_member_collaboration_fix.sql.)
create or replace function public.can_manage_trip_row(
    p_user_id uuid,
    p_data jsonb,
    p_uid uuid
)
returns boolean language sql security definer stable set search_path = public as $$
    select p_uid is not null
       and (
            p_user_id = p_uid
            or (
                p_data->>'workspace_type' = 'group'
                and coalesce(p_data->>'workspace_id', '') <> ''
                and public.is_group_member(p_data->>'workspace_id', p_uid)
            )
       );
$$;

create or replace function public.can_create_trip_document(p_data jsonb, p_uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select p_uid is not null
       and (
            coalesce(p_data->>'workspace_type', 'personal') = 'personal'
            and (
                not (p_data ? 'workspace_id')
                or p_data->>'workspace_id' = concat('personal:', p_uid::text)
            )
            or (
                p_data->>'workspace_type' = 'group'
                and coalesce(p_data->>'workspace_id', '') <> ''
                and public.is_group_member(p_data->>'workspace_id', p_uid)
            )
       );
$$;

create or replace function public.can_edit_trip_events(p_trip_id text, p_uid uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_trip public.trips%rowtype;
begin
    if p_uid is null or coalesce(p_trip_id, '') = '' then
        return false;
    end if;

    select * into v_trip from public.trips where id = p_trip_id;
    if not found then
        return false;
    end if;

    return public.can_view_trip_row(v_trip.user_id, v_trip.data, p_uid);
end;
$$;

create or replace function public.can_view_event_row(
    p_user_id uuid,
    p_data jsonb,
    p_uid uuid
)
returns boolean language sql security definer stable set search_path = public as $$
    select p_uid is not null
       and (
            p_user_id = p_uid
            or public.can_edit_trip_events(p_data->>'trip_id', p_uid)
       );
$$;

create or replace function public.sync_trip_documents(documents jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_doc jsonb;
    v_id text;
    v_updated_at bigint;
    v_deleted boolean;
    v_data jsonb;
    v_existing public.trips%rowtype;
begin
    if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
    if jsonb_typeof(documents) <> 'array' then raise exception 'INVALID_DOCUMENTS'; end if;

    for v_doc in select value from jsonb_array_elements(documents) as t(value)
    loop
        v_id := v_doc->>'id';
        if coalesce(v_id, '') = '' then raise exception 'INVALID_TRIP_ID'; end if;

        v_updated_at := coalesce((v_doc->>'updated_at')::bigint, floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
        v_deleted := coalesce((v_doc->>'deleted')::boolean, false);
        v_data := coalesce(v_doc->'data', '{}'::jsonb) - 'id' - 'updated_at' - 'is_deleted' - '_deleted';

        select * into v_existing from public.trips where id = v_id for update;

        if found then
            if not public.can_manage_trip_row(v_existing.user_id, v_existing.data, v_uid) then
                if public.can_view_trip_row(v_existing.user_id, v_existing.data, v_uid)
                   and v_existing.updated_at = v_updated_at
                   and v_existing.deleted = v_deleted
                   and v_existing.data = v_data then
                    continue;
                end if;
                raise exception 'TRIP_UPDATE_NOT_ALLOWED' using errcode = '42501';
            end if;

            -- Last-write-wins by updated_at: ignore a stale write (older than the
            -- stored row) so concurrent offline edits converge deterministically.
            if v_updated_at < v_existing.updated_at then
                continue;
            end if;

            v_data := jsonb_set(v_data, '{owner_id}', to_jsonb(coalesce(v_existing.data->>'owner_id', v_existing.user_id::text)), true);

            if v_existing.data ? 'workspace_type' then
                v_data := jsonb_set(v_data, '{workspace_type}', v_existing.data->'workspace_type', true);
            else
                v_data := v_data - 'workspace_type';
            end if;

            if v_existing.data ? 'workspace_id' then
                v_data := jsonb_set(v_data, '{workspace_id}', v_existing.data->'workspace_id', true);
            else
                v_data := v_data - 'workspace_id';
            end if;

            if v_existing.data ? 'created_at' then
                v_data := jsonb_set(v_data, '{created_at}', v_existing.data->'created_at', true);
            end if;

            update public.trips
            set updated_at = v_updated_at,
                deleted = v_deleted,
                user_id = v_existing.user_id,
                data = v_data
            where id = v_id;
        else
            if not public.can_create_trip_document(v_data, v_uid) then
                raise exception 'TRIP_INSERT_NOT_ALLOWED' using errcode = '42501';
            end if;

            v_data := jsonb_set(v_data, '{owner_id}', to_jsonb(v_uid::text), true);
            insert into public.trips (id, updated_at, deleted, user_id, data)
            values (v_id, v_updated_at, v_deleted, v_uid, v_data);
        end if;
    end loop;
end;
$$;

create or replace function public.sync_trip_event_documents(documents jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_doc jsonb;
    v_id text;
    v_updated_at bigint;
    v_deleted boolean;
    v_data jsonb;
    v_existing public.trip_events%rowtype;
    v_trip public.trips%rowtype;
    v_trip_id text;
begin
    if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
    if jsonb_typeof(documents) <> 'array' then raise exception 'INVALID_DOCUMENTS'; end if;

    for v_doc in select value from jsonb_array_elements(documents) as t(value)
    loop
        v_id := v_doc->>'id';
        if coalesce(v_id, '') = '' then raise exception 'INVALID_EVENT_ID'; end if;

        v_updated_at := coalesce((v_doc->>'updated_at')::bigint, floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
        v_deleted := coalesce((v_doc->>'deleted')::boolean, false);
        v_data := coalesce(v_doc->'data', '{}'::jsonb) - 'id' - 'updated_at' - 'is_deleted' - '_deleted';

        select * into v_existing from public.trip_events where id = v_id for update;

        if found then
            v_trip_id := v_existing.data->>'trip_id';
            if not public.can_edit_trip_events(v_trip_id, v_uid) then
                raise exception 'EVENT_UPDATE_NOT_ALLOWED' using errcode = '42501';
            end if;

            -- Last-write-wins by updated_at: ignore a stale write (older than the
            -- stored row) so concurrent offline edits converge deterministically.
            if v_updated_at < v_existing.updated_at then
                continue;
            end if;

            select * into v_trip from public.trips where id = v_trip_id;

            v_data := jsonb_set(v_data, '{owner_id}', to_jsonb(coalesce(v_existing.data->>'owner_id', v_existing.user_id::text)), true);
            v_data := jsonb_set(v_data, '{trip_id}', to_jsonb(v_trip_id), true);

            if v_existing.data ? 'workspace_type' then
                v_data := jsonb_set(v_data, '{workspace_type}', v_existing.data->'workspace_type', true);
            elsif found and v_trip.data ? 'workspace_type' then
                v_data := jsonb_set(v_data, '{workspace_type}', v_trip.data->'workspace_type', true);
            elsif found then
                v_data := jsonb_set(v_data, '{workspace_type}', to_jsonb('personal'::text), true);
            else
                v_data := v_data - 'workspace_type';
            end if;

            if v_existing.data ? 'workspace_id' then
                v_data := jsonb_set(v_data, '{workspace_id}', v_existing.data->'workspace_id', true);
            elsif found and v_trip.data ? 'workspace_id' then
                v_data := jsonb_set(v_data, '{workspace_id}', v_trip.data->'workspace_id', true);
            elsif found then
                v_data := jsonb_set(v_data, '{workspace_id}', to_jsonb(concat('personal:', v_trip.user_id::text)), true);
            else
                v_data := v_data - 'workspace_id';
            end if;

            if v_existing.data ? 'created_at' then
                v_data := jsonb_set(v_data, '{created_at}', v_existing.data->'created_at', true);
            end if;

            update public.trip_events
            set updated_at = v_updated_at,
                deleted = v_deleted,
                user_id = v_existing.user_id,
                data = v_data
            where id = v_id;
        else
            v_trip_id := v_data->>'trip_id';
            if not public.can_edit_trip_events(v_trip_id, v_uid) then
                raise exception 'EVENT_INSERT_NOT_ALLOWED' using errcode = '42501';
            end if;

            select * into v_trip from public.trips where id = v_trip_id;
            if not found then raise exception 'EVENT_TRIP_NOT_FOUND' using errcode = '23503'; end if;

            v_data := jsonb_set(v_data, '{owner_id}', to_jsonb(v_uid::text), true);
            v_data := jsonb_set(v_data, '{trip_id}', to_jsonb(v_trip_id), true);

            if v_trip.data ? 'workspace_type' then
                v_data := jsonb_set(v_data, '{workspace_type}', v_trip.data->'workspace_type', true);
            else
                v_data := jsonb_set(v_data, '{workspace_type}', to_jsonb('personal'::text), true);
            end if;

            if v_trip.data ? 'workspace_id' then
                v_data := jsonb_set(v_data, '{workspace_id}', v_trip.data->'workspace_id', true);
            else
                v_data := jsonb_set(v_data, '{workspace_id}', to_jsonb(concat('personal:', v_trip.user_id::text)), true);
            end if;

            insert into public.trip_events (id, updated_at, deleted, user_id, data)
            values (v_id, v_updated_at, v_deleted, v_uid, v_data);
        end if;
    end loop;
end;
$$;

grant execute on function public.sync_trip_documents(jsonb) to authenticated;
grant execute on function public.sync_trip_event_documents(jsonb) to authenticated;


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
drop policy if exists "Users can insert their own trip_events" on public.trip_events;
drop policy if exists "Users can update their own trip_events" on public.trip_events;
drop policy if exists "Members can select shared group trip_events" on public.trip_events;
drop policy if exists "Trip event writes must use sync RPC" on public.trip_events;
drop policy if exists "Trip event updates must use sync RPC" on public.trip_events;

create policy "Members can select shared group trip_events"
    on public.trip_events for select
    using (public.can_view_event_row(user_id, data, auth.uid()));

create policy "Trip event writes must use sync RPC"
    on public.trip_events for insert
    with check (false);

create policy "Trip event updates must use sync RPC"
    on public.trip_events for update
    using (false)
    with check (false);

-- --- trips -------------------------------------------------------------------
drop policy if exists "Users can select their own trips" on public.trips;
drop policy if exists "Users can insert their own trips" on public.trips;
drop policy if exists "Users can update their own trips" on public.trips;
drop policy if exists "Members can select shared group trips" on public.trips;
drop policy if exists "Trip writes must use sync RPC" on public.trips;
drop policy if exists "Trip updates must use sync RPC" on public.trips;

create policy "Members can select shared group trips"
    on public.trips for select
    using (public.can_view_trip_row(user_id, data, auth.uid()));

create policy "Trip writes must use sync RPC"
    on public.trips for insert
    with check (false);

create policy "Trip updates must use sync RPC"
    on public.trips for update
    using (false)
    with check (false);

-- --- groups ------------------------------------------------------------------
-- Phase 12C: SELECT is "owner OR active member" (membership table + helper are
-- defined in section 2b above). INSERT/UPDATE remain owner-only. Group TRIPS /
-- EVENTS are still owner-scoped — cross-user trip/event sharing is Phase 12D.
drop policy if exists "Users can select their own groups" on public.groups;
-- Phase 12D: shared trip/event content is now governed by the trips and
-- trip_events policies above; the groups table itself remains owner-managed.
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
