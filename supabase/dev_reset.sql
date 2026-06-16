-- =============================================================================
-- ⚠️  DEV-ONLY RESET SCRIPT — DO NOT RUN ON PRODUCTION  ⚠️
-- =============================================================================
--
--   THIS SCRIPT DELETES ALL JOURNEY LEDGER CONTENT (trips, events, groups,
--   memberships, invites) FOR EVERY USER IN THE PROJECT.
--
--   * It is intended ONLY for a disposable DEV / TEST Supabase project where you
--     want to restart manual testing from a clean state.
--   * It is intentionally NOT placed in `supabase/migrations/` so it can never be
--     auto-applied by a migration runner.
--   * It does NOT delete auth users. Remove test accounts manually in the
--     Supabase Dashboard → Authentication → Users (or via admin tooling outside
--     this app). Never embed service-role keys anywhere in the frontend.
--
--   STOP. Confirm you are connected to the correct (dev) project before running.
--
-- =============================================================================

-- Delete content children-first. (group_invites / group_members are keyed by a
-- text group_id, not a hard FK to groups, so ordering is for clarity/safety.)
delete from public.trip_events;
delete from public.trips;
delete from public.group_invites;
delete from public.group_members;
delete from public.groups;

-- Tables, RLS, helpers, and RPCs are left intact. If you instead recreated the
-- project from scratch, re-run `supabase/bootstrap.sql` (fresh) or the ordered
-- migrations (existing project) — see supabase/README.md and docs/DEV_RESET.md.
--
-- After running this, also clear local browser state on each device
-- (IndexedDB / LocalStorage / Service Worker) — see docs/DEV_RESET.md.
-- =============================================================================
