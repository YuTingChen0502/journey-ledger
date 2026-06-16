# Supabase Setup

This folder holds SQL you must apply manually to your Supabase project (the app
cannot create tables itself).

## Which file do I run?

| Scenario | Run this |
|----------|----------|
| **Brand-new / fresh Supabase project** | `bootstrap.sql` — provisions everything (`trip_events` + `trips` + `groups` + `group_members` + `group_invites`, helpers, the join RPC, indexes, RLS, realtime) in one idempotent script. |
| **Existing project that already has `trip_events`** (legacy Nagoya setup) | `migrations/20260615_create_trips.sql` — adds the `trips` table. |
| **Existing project that needs group workspaces (Phase 12B)** | `migrations/20260616_create_groups.sql` — adds the `groups` table. |
| **Existing project enabling group membership + invites (Phase 12C)** | `migrations/20260617_group_members_invites.sql` — adds `group_members` + `group_invites`, the `join_group_by_invite_code` RPC, the owner-membership trigger, and **widens the `groups` SELECT policy to owner-OR-member**. |

> ⚠️ **Phase 12C manual action:** run `migrations/20260617_group_members_invites.sql` (or the updated `bootstrap.sql`) in the Supabase SQL Editor **before testing invite-code joining across accounts**. Until applied, group creation still works locally but joins will fail and joined groups won't appear.

Both scripts are idempotent and safe to re-run.

## How to apply

1. Open your Supabase project → **SQL Editor** → New query.
2. Paste the contents of the chosen file and **Run**.
3. Verify the tables exist with RLS enabled (Table Editor / Authentication → Policies).

## Files

| File | Purpose |
|------|---------|
| `bootstrap.sql` | Full bootstrap for a fresh project: `trip_events` + `trips` + `groups` tables, indexes, RLS policies, realtime publication. |
| `migrations/20260615_create_trips.sql` | Phase 1 incremental: `trips` table only (for projects that already had `trip_events`). |
| `migrations/20260616_create_groups.sql` | Phase 12B incremental: `groups` table only. **Owner-scoped RLS** (superseded by Phase 12C, which widens group visibility to members). |
| `migrations/20260617_group_members_invites.sql` | Phase 12C incremental: `group_members` + `group_invites` tables, `is_group_member` / `is_group_owner` helpers, owner-membership trigger, `join_group_by_invite_code` RPC, and the widened `groups` SELECT policy. **Membership + group visibility only — group trips/events remain owner-scoped (Phase 12D).** |

### Group membership & invites (Phase 12C)

- **Visibility:** the `groups` SELECT policy is **owner OR active member** (`is_group_member`). A user sees a group once they own it or have an active `group_members` row for it.
- **Membership writes are server-only:** the creator's `owner` membership is created by an `AFTER INSERT` trigger on `groups`; non-owners join **only** through the SECURITY DEFINER RPC `join_group_by_invite_code(invite_code text)`. There is **no** client INSERT/UPDATE/DELETE policy on `group_members`.
- **Invite codes:** owner-managed rows in `group_invites` (owner-only SELECT/INSERT/UPDATE). The owner's client generates a short code and inserts it; ordinary users can never list codes, only redeem one via the RPC.
- **Local-first split:** owned groups still sync via RxDB (offline-capable). **Joined** groups are read **online** (`src/services/groups.ts` → `fetchVisibleGroups`) because a member can't push a group they don't own without an ownership conflict — the RxDB `groups` pull is explicitly filtered to `user_id = auth.uid()`.
- **Still deferred to Phase 12D:** cross-user **group trip/event** sharing. `trip_events` / `trips` RLS is unchanged and remains owner-scoped, so a joined member sees only their own (currently empty) trips for that group.

## Sync contract

Both tables share the same local-first + JSONB shape used by RxDB replication
(see `src/db/replication.ts`):

| Column | Type | Meaning |
|--------|------|---------|
| `id` | text (PK) | RxDB document id |
| `updated_at` | bigint | epoch **milliseconds**; replication pull checkpoint |
| `deleted` | boolean | soft-delete flag |
| `user_id` | uuid | owner; must equal `auth.uid()` |
| `data` | jsonb | all remaining document fields |

## Required tables & columns

Both `trip_events` and `trips` MUST exist with exactly these columns (the RxDB
replication handlers in `src/db/replication.ts` depend on this shape):

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | RxDB document id |
| `updated_at` | bigint | epoch **milliseconds**; replication pull checkpoint |
| `deleted` | boolean | soft-delete flag (maps to local `is_deleted`) |
| `user_id` | uuid | owner; references `auth.users(id)`; must equal `auth.uid()` |
| `data` | jsonb | all remaining document fields |

## RLS policy expectations (both tables)

RLS MUST be enabled on both tables, with policies scoped to the authenticated user:

- **SELECT** — a user can read only their own rows (`auth.uid() = user_id`).
- **INSERT** — a user can insert only rows they own (`with check (auth.uid() = user_id)`).
- **UPDATE** — a user can update only their own rows (`using` + `with check` on `auth.uid() = user_id`).
- **Soft delete** is performed as an UPDATE that sets `deleted = true` — covered by the UPDATE policy.
- **Hard `DELETE` is intentionally NOT exposed** (no DELETE policy is granted). Rows are never physically removed by the app.

## Realtime publication expectations

Both tables must belong to the `supabase_realtime` publication so the client's
`postgres_changes` subscriptions (`trip_events_db_changes`, `trips_db_changes`)
fire. `bootstrap.sql` adds them idempotently.

## API keys / secrets

- The client uses the **anon / publishable** key only (`VITE_SUPABASE_ANON_KEY` in `.env.local`).
- **NEVER** place the `service_role` / secret key in `.env.local` or any client-bundled env — it bypasses RLS and would be shipped to the browser.
- `.env.local` must not be committed (see repo `.gitignore`).
- All client-side quota limits (see `src/lib/quotas.ts`) are a **UX guard only**, not a security boundary. Authoritative quota/row-ownership enforcement is RLS (ownership) plus future backend checks (per-user/per-trip counts) — see CLAUDE.md "recommended next small phases".

## Verifying after setup

After running the SQL:

1. **Table Editor** → confirm `public.trip_events` and `public.trips` exist with the 5 columns above.
2. **Authentication → Policies** → confirm RLS is **enabled** and each table has SELECT / INSERT / UPDATE policies (no DELETE policy).
3. **Database → Publications → `supabase_realtime`** → confirm both tables are included.
4. Smoke test from the app: sign in, create a trip, add an event, reload — data should persist and (on a second device) sync.

## Backend quota enforcement (future work — design note)

The app enforces quotas **only on the frontend** today (`src/lib/quotas.ts`:
10 trips/user, 500 events/trip, 50 checklist items/event, 5000-char memos). This
is a **UX guard, not a security boundary** — a determined client could bypass it
by writing directly via the API.

**Current risk: low.** RLS already restricts every row to its owner
(`user_id = auth.uid()`), so a user can only ever inflate *their own* data. The
quota gap is an abuse/cost concern, not a cross-user data risk.

**Recommended future approach** (pick one, in rough order of effort):

1. **Postgres trigger / RPC** — a `BEFORE INSERT` trigger (or a `SECURITY DEFINER`
   RPC the client must call) that counts existing non-deleted rows for the user /
   trip and raises on overflow. Authoritative and DB-local.
2. **RLS policy with a count subquery** — express the cap inside the INSERT
   policy's `WITH CHECK` (e.g. count of the user's non-deleted trips `< 10`).
   Simple but adds a subquery cost per insert.
3. **Edge Function** — route writes through a Supabase Edge Function that checks
   quotas server-side. Most flexible, most moving parts.

When implemented, keep the frontend checks too (fast feedback) and treat the
backend as the source of truth.

## Why manual

Trips and events use the same local-first sync pattern. Until the tables exist,
the local RxDB collections still work fully offline; replication will log an
error and no-op (no data loss). Cross-device sync activates once the SQL is
applied.
