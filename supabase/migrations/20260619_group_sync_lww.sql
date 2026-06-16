-- Journey Ledger - Phase 12D.2: deterministic last-write-wins for group sync
--
-- Apply AFTER 20260618_group_trip_event_sharing.sql and
-- 20260618_group_member_collaboration_fix.sql. Idempotent (create or replace).
--
-- WHY
--   The Phase 12D sync RPCs applied every accepted UPDATE unconditionally
--   (set updated_at = incoming), so the winner of two concurrent edits depended
--   on which push reached the server LAST. That still converges, but the winner
--   was not defined by `updated_at`.
--
-- FIX
--   Add a LAST-WRITE-WINS guard: an UPDATE is applied only when the incoming
--   `updated_at` is >= the stored row's; a strictly-older (stale) write is
--   skipped. The pusher still sees success and converges to the server's newer
--   row on the next pull. This is the deterministic MVP conflict policy; the
--   client hydration mirrors it (see src/lib/groupSync.ts) so a locally-newer
--   unpushed offline edit is never clobbered during backfill.
--
--   NOTE: this is purely a conflict-resolution refinement. Group *visibility*
--   convergence (members eventually seeing the same dataset) is restored by the
--   frontend hydration changes and needs no migration.
--
-- This migration is NOT required for convergence, but is recommended so the
-- conflict winner is deterministic. `bootstrap.sql` already includes the guard.

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

            -- Last-write-wins by updated_at: ignore a stale write.
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

            -- Last-write-wins by updated_at: ignore a stale write.
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

-- Done. Conflict resolution is now deterministic last-write-wins by updated_at.
