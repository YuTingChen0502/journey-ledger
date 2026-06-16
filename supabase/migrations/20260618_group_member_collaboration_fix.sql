-- Journey Ledger - Phase 12D fix: make group trip metadata collaborative.
--
-- Apply AFTER 20260618_group_trip_event_sharing.sql (which is already deployed).
-- Idempotent: a single `create or replace` of one helper.
--
-- WHY
--   The original Phase 12D `can_manage_trip_row` authorized group trip rows only
--   for the GROUP OWNER (`is_group_owner`). Every other group helper is already
--   member-based. That asymmetry meant:
--     * a non-owner member could not create/edit group trip metadata, and
--     * a member's trips replication would STALL: hydration upserts visible group
--       trips into the member's local RxDB, RxDB pushes them back through
--       `sync_trip_documents`, and the owner-only check rejected the non-owner's
--       push (TRIP_UPDATE_NOT_ALLOWED) unless byte-identical — so owner→member
--       trip updates stopped flowing, while owner could see everything.
--
-- FIX
--   Authorize group trip rows for any ACTIVE GROUP MEMBER. This does NOT weaken
--   ownership or the membership boundary:
--     * Personal trips stay owner-only (workspace_type <> 'group').
--     * Non-members fail `is_group_member` and can neither view nor manage.
--     * `sync_trip_documents` UPDATE still preserves the existing top-level
--       user_id, JSON owner_id, workspace identity, and created_at — membership
--       grants collaboration, never ownership transfer.
--
-- Group events were already member-collaborative via `can_edit_trip_events`.

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
                and public.is_group_member(p_data->>'workspace_id', p_uid)
            )
       );
$$;

-- Done. Re-run the two-account smoke test: owner and member should now each see
-- the other's newly created group trips/events after replication.
