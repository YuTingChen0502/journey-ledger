-- Journey Ledger - Phase 12D: group trip/event sharing + ownership-safe sync
--
-- Enables real shared group trips/events while preserving row ownership.
-- Apply after Phase 12C (`group_members`, `group_invites`, helpers, join RPC).
--
-- ⚠️ FOLLOW-UP REQUIRED: this file's `can_manage_trip_row` is group-owner-only,
-- which makes group trip collaboration asymmetric (members stall on replication).
-- Always also run `20260618_group_member_collaboration_fix.sql`, which makes
-- group trip management member-based. `bootstrap.sql` already includes the fix.
--
-- Key decisions:
--   * trips/trip_events SELECT: owner OR active member of the row's group.
--   * trips/trip_events writes: clients use SECURITY DEFINER sync RPCs.
--   * Direct INSERT/UPDATE policies are intentionally false for trips/events.
--   * RPC INSERT sets top-level user_id and JSON data.owner_id to auth.uid().
--   * RPC UPDATE preserves existing top-level user_id and data.owner_id.
--   * RPC UPDATE preserves trip workspace identity and event parent trip identity.

-- ---------------------------------------------------------------------------
-- 1. Permission helpers
-- ---------------------------------------------------------------------------

create or replace function public.can_view_trip_row(
    p_user_id uuid,
    p_data jsonb,
    p_uid uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
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

create or replace function public.can_manage_trip_row(
    p_user_id uuid,
    p_data jsonb,
    p_uid uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select p_uid is not null
       and (
            p_user_id = p_uid
            or (
                p_data->>'workspace_type' = 'group'
                and coalesce(p_data->>'workspace_id', '') <> ''
                and public.is_group_owner(p_data->>'workspace_id', p_uid)
            )
       );
$$;

create or replace function public.can_create_trip_document(
    p_data jsonb,
    p_uid uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
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

create or replace function public.can_edit_trip_events(
    p_trip_id text,
    p_uid uuid
)
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

    select * into v_trip
    from public.trips
    where id = p_trip_id;

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
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select p_uid is not null
       and (
            p_user_id = p_uid
            or public.can_edit_trip_events(p_data->>'trip_id', p_uid)
       );
$$;

-- ---------------------------------------------------------------------------
-- 2. Ownership-safe sync RPCs
-- ---------------------------------------------------------------------------

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
    if v_uid is null then
        raise exception 'NOT_AUTHENTICATED';
    end if;

    if jsonb_typeof(documents) <> 'array' then
        raise exception 'INVALID_DOCUMENTS';
    end if;

    for v_doc in select value from jsonb_array_elements(documents) as t(value)
    loop
        v_id := v_doc->>'id';
        if coalesce(v_id, '') = '' then
            raise exception 'INVALID_TRIP_ID';
        end if;

        v_updated_at := coalesce((v_doc->>'updated_at')::bigint, floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
        v_deleted := coalesce((v_doc->>'deleted')::boolean, false);
        v_data := coalesce(v_doc->'data', '{}'::jsonb) - 'id' - 'updated_at' - 'is_deleted' - '_deleted';

        select * into v_existing
        from public.trips
        where id = v_id
        for update;

        if found then
            if not public.can_manage_trip_row(v_existing.user_id, v_existing.data, v_uid) then
                -- Hydration writes a server row into RxDB and may push the exact
                -- same row back. Allow that no-op for visible group members, but
                -- reject real metadata edits unless the user owns the trip or owns
                -- the group.
                if public.can_view_trip_row(v_existing.user_id, v_existing.data, v_uid)
                   and v_existing.updated_at = v_updated_at
                   and v_existing.deleted = v_deleted
                   and v_existing.data = v_data then
                    continue;
                end if;

                raise exception 'TRIP_UPDATE_NOT_ALLOWED' using errcode = '42501';
            end if;

            -- Preserve immutable identity from the existing row.
            v_data := jsonb_set(
                v_data,
                '{owner_id}',
                to_jsonb(coalesce(v_existing.data->>'owner_id', v_existing.user_id::text)),
                true
            );

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
    if v_uid is null then
        raise exception 'NOT_AUTHENTICATED';
    end if;

    if jsonb_typeof(documents) <> 'array' then
        raise exception 'INVALID_DOCUMENTS';
    end if;

    for v_doc in select value from jsonb_array_elements(documents) as t(value)
    loop
        v_id := v_doc->>'id';
        if coalesce(v_id, '') = '' then
            raise exception 'INVALID_EVENT_ID';
        end if;

        v_updated_at := coalesce((v_doc->>'updated_at')::bigint, floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
        v_deleted := coalesce((v_doc->>'deleted')::boolean, false);
        v_data := coalesce(v_doc->'data', '{}'::jsonb) - 'id' - 'updated_at' - 'is_deleted' - '_deleted';

        select * into v_existing
        from public.trip_events
        where id = v_id
        for update;

        if found then
            v_trip_id := v_existing.data->>'trip_id';
            if not public.can_edit_trip_events(v_trip_id, v_uid) then
                raise exception 'EVENT_UPDATE_NOT_ALLOWED' using errcode = '42501';
            end if;

            select * into v_trip
            from public.trips
            where id = v_trip_id;

            -- Preserve immutable identity from the existing event row.
            v_data := jsonb_set(
                v_data,
                '{owner_id}',
                to_jsonb(coalesce(v_existing.data->>'owner_id', v_existing.user_id::text)),
                true
            );
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

            select * into v_trip
            from public.trips
            where id = v_trip_id;

            if not found then
                raise exception 'EVENT_TRIP_NOT_FOUND' using errcode = '23503';
            end if;

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

-- ---------------------------------------------------------------------------
-- 3. RLS policies
-- ---------------------------------------------------------------------------

alter table public.trip_events enable row level security;
alter table public.trips enable row level security;

-- trips: readable by owner or active group member. Writes go through RPC.
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

-- trip_events: readable by owner or active member of the parent trip's group.
-- Writes go through RPC so owner/workspace/trip identity can be preserved.
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

-- ---------------------------------------------------------------------------
-- 4. Helpful indexes for group workspace filtering / hydration
-- ---------------------------------------------------------------------------

create index if not exists trips_workspace_idx
    on public.trips ((data->>'workspace_type'), (data->>'workspace_id'));

create index if not exists trip_events_trip_id_idx
    on public.trip_events ((data->>'trip_id'));

-- Done. Run the two-account smoke test after applying this migration.
