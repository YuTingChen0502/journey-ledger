# Supabase Setup

This folder holds SQL you must apply manually to your Supabase project. The app cannot create tables or policies itself.

## Which File Do I Run?

| Scenario | Run this |
|----------|----------|
| Brand-new / fresh Supabase project | `bootstrap.sql` provisions everything in one idempotent script. |
| Existing project that already has `trip_events` | `migrations/20260615_create_trips.sql` adds the `trips` table. |
| Existing project that needs group workspaces (Phase 12B) | `migrations/20260616_create_groups.sql` adds the `groups` table. |
| Existing project enabling group membership + invites (Phase 12C) | `migrations/20260617_group_members_invites.sql` adds `group_members`, `group_invites`, the join RPC, owner membership trigger, and group visibility RLS. |
| Existing project enabling group trip/event sharing (Phase 12D) | `migrations/20260618_group_trip_event_sharing.sql` adds shared trip/event RLS, ownership-safe sync RPCs, and hydration indexes. |
| Existing project — Phase 12D collaboration fix (REQUIRED) | `migrations/20260618_group_member_collaboration_fix.sql` makes group trip management member-based (`can_manage_trip_row`). Without it, owner→member trip sharing is asymmetric (members stall). |

**Phase 12D manual action:** run `migrations/20260618_group_trip_event_sharing.sql` **and** `migrations/20260618_group_member_collaboration_fix.sql` (or the updated `bootstrap.sql`, which already includes both) in the Supabase SQL Editor before testing cross-account group trip/event sharing. Until applied, joined groups can appear but their trips/events remain owner-scoped, and group trip sharing is asymmetric until the collaboration fix is applied.

All scripts are idempotent and safe to re-run.

## How To Apply

1. Open your Supabase project, then open SQL Editor, then New query.
2. Paste the contents of the chosen file and Run.
3. Verify the tables exist with RLS enabled under Table Editor / Authentication Policies.

## Files

| File | Purpose |
|------|---------|
| `bootstrap.sql` | Full bootstrap for a fresh project: mirror tables, group membership/invites, sync RPCs, indexes, RLS policies, and realtime publication. |
| `migrations/20260615_create_trips.sql` | Phase 1 incremental: `trips` table only. |
| `migrations/20260616_create_groups.sql` | Phase 12B incremental: `groups` table only. Superseded by Phase 12C group visibility policies. |
| `migrations/20260617_group_members_invites.sql` | Phase 12C incremental: membership, invites, owner trigger, and `join_group_by_invite_code`. |
| `migrations/20260618_group_trip_event_sharing.sql` | Phase 12D incremental: member-aware `trips` / `trip_events` SELECT policies, RPC-only writes through `sync_trip_documents` / `sync_trip_event_documents`, ownership preservation on update, and indexes for group workspace hydration. |
| `migrations/20260618_group_member_collaboration_fix.sql` | Phase 12D fix: `can_manage_trip_row` becomes member-based so group trip create/edit (and the member-side hydration push-back) work for any active member, not just the owner. Required follow-up to the sharing migration. |
| `dev_reset.sql` | **DEV-ONLY** content wipe for restarting manual testing. Deletes all trip/event/group rows (not auth users). **Never run on production.** Not a migration. See [`../docs/DEV_RESET.md`](../docs/DEV_RESET.md). |

## Group edit / delete (Phase 12D.1)

Editing a group's name/description and **soft-deleting** a group are
**owner-only** and need **no migration**: the `groups` table already enforces
owner-only INSERT/UPDATE RLS (`auth.uid() = user_id`), and owned groups sync via
the local-first RxDB `groups` collection. Soft-delete sets `deleted = true`;
member-visibility queries filter `deleted = false`, so the group disappears for
all members. Group **trips/events are not cascade-deleted** and their RLS is
unchanged. Non-owner members can still collaborate on group trips/events (Phase
12D) but cannot edit/delete the group document itself.

## Group Membership & Invites

- Group visibility is owner OR active member via `is_group_member`.
- Membership writes are server-only: creator membership is created by the `groups` insert trigger; non-owners join only through `join_group_by_invite_code(invite_code text)`.
- Invite codes are owner-managed rows in `group_invites`; ordinary users redeem a code through the RPC and cannot list invite codes.
- Owned groups still sync via RxDB. Joined groups are fetched online through `src/services/groups.ts` because they are intentionally not pulled into the owner-scoped `groups` local collection.

## Group Trip/Event Sharing

- Personal trips/events stay private to their creator.
- Group trips are visible to active group members when `data.workspace_type = 'group'` and `data.workspace_id` is a group id they belong to.
- Events are authorized from their parent trip (`data.trip_id`); event workspace fields are denormalized metadata, not the source of truth.
- Active group members can create/edit events in shared group trips.
- Trip metadata edit/delete is conservative: the trip owner or group owner can update trip rows through the sync RPC.
- Direct `INSERT`/`UPDATE` policies on `trips` and `trip_events` are intentionally false. Client replication writes through `sync_trip_documents(jsonb)` and `sync_trip_event_documents(jsonb)`.
- On insert, sync RPCs set top-level `user_id = auth.uid()` and JSON `data.owner_id = auth.uid()`.
- On update, sync RPCs preserve existing top-level `user_id`, JSON `data.owner_id`, trip workspace identity, and event parent `trip_id`.
- When a group workspace opens, the app hydrates visible group trips and their events by workspace/trip id so rows older than the user's replication checkpoint are backfilled without leaking unrelated data.

## Sync Contract

The mirror tables use the same local-first + JSONB shape used by RxDB replication:

| Column | Type | Meaning |
|--------|------|---------|
| `id` | text primary key | RxDB document id |
| `updated_at` | bigint | epoch milliseconds; replication pull checkpoint |
| `deleted` | boolean | soft-delete flag |
| `user_id` | uuid | creator/owner; set on insert and preserved on update |
| `data` | jsonb | all remaining document fields |

## Required Tables & Columns

`trip_events`, `trips`, and `groups` must exist with the 5 mirror columns above. `group_members` and `group_invites` are normal relational auth/security tables created by the Phase 12C migration or `bootstrap.sql`.

## RLS Policy Expectations

RLS must be enabled on all tables.

- `trips` SELECT: personal owner OR active member of the row's group.
- `trip_events` SELECT: row owner OR active member of the parent trip's group.
- `trips` / `trip_events` direct INSERT/UPDATE: blocked; use sync RPCs.
- `groups` SELECT: owner OR active member.
- `groups` INSERT/UPDATE: owner only.
- `group_members`: SELECT own membership rows, or as owner all members of your group; no direct client writes.
- `group_invites`: owner-only select/insert/update; ordinary users join through the RPC.
- Hard DELETE is intentionally not exposed. The app uses soft-delete via `deleted = true`.

## Realtime Publication Expectations

`trip_events`, `trips`, and `groups` must belong to the `supabase_realtime` publication so the client's `postgres_changes` subscriptions can trigger replication re-syncs. `bootstrap.sql` adds them idempotently.

## API Keys / Secrets

- The client uses the anon / publishable key only (`VITE_SUPABASE_ANON_KEY` in `.env.local`).
- Never place the `service_role` / secret key in `.env.local` or any client-bundled env; it bypasses RLS and would be shipped to the browser.
- `.env.local` must not be committed.
- Frontend quotas are UX guards only. Authoritative quota enforcement remains future backend work.

## Auth Email Sending

- Supabase's built-in email provider is for testing only and can rate-limit both signup confirmation and forgot-password emails.
- The app maps Supabase email rate-limit errors, including HTTP 429, to: `Too many emails were requested. Please wait about an hour and try again.`
- Production projects should configure Custom SMTP in the Supabase Dashboard under Authentication / Emails / SMTP Settings.
- After Custom SMTP is configured, adjust the relevant Auth Rate Limits in the Supabase Dashboard to values your provider supports.
- Redirect URLs for `/reset-password` still need to be configured; see [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
- Do not put SMTP credentials, service-role keys, or Supabase Management API calls in the frontend.

## Verifying After Setup

1. Confirm `public.trip_events`, `public.trips`, and `public.groups` exist with the mirror columns.
2. Confirm `group_members` and `group_invites` exist after Phase 12C.
3. Confirm RLS is enabled and the policies match the expectations above.
4. Confirm `trip_events`, `trips`, and `groups` are in `supabase_realtime`.
5. Run the two-account group sharing smoke test from `docs/DEPLOYMENT.md`.

## Backend Quota Enforcement

The app enforces quotas only on the frontend today (`src/lib/quotas.ts`: 10 trips/user, 500 events/trip, 50 checklist items/event, 5000-char memos). This is a UX guard, not a security boundary.

Recommended future approaches:

1. Postgres trigger or RPC that counts existing rows and raises on overflow.
2. RLS policy with a count subquery.
3. Supabase Edge Function write path.

Keep frontend checks for fast feedback and treat the backend as the source of truth when implemented.
