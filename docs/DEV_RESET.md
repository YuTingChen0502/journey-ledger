# Dev Reset Guide (testing only)

How to restart Aurea manual testing from a clean state.

> ⚠️ **Everything here is for a disposable DEV / TEST environment.**
> **Never** run the reset SQL against a production project, and never delete data
> you care about. There is no undo.

Aurea is local-first, so a full reset has **two** sides:

1. **Local browser state** (the RxDB/IndexedDB copy on each device).
2. **Supabase data** (the cloud mirror that re-syncs into the browser).

If you only clear one side, replication will repopulate the other — so for a
truly clean slate, clear **both**.

---

## 1. Clear local browser data

The app stores an RxDB database named `tripdb` in IndexedDB, a few small
`journey_ledger_*` keys in LocalStorage, and a PWA service worker + cache.

### Easiest: DevTools "Clear site data"

1. Open the app, then open **DevTools** (F12) → **Application** tab.
2. **Storage** → **Clear site data** (check IndexedDB, Local/Session Storage,
   Cache storage, and Service Workers) → **Clear site data**.
3. Close and reopen the tab.

### Manual, piece by piece (same Application tab)

- **IndexedDB** → delete the `tripdb` database.
- **Local Storage** → remove the `journey_ledger_*` keys (selected workspace /
  trip, language, font scale).
- **Service Workers** → **Unregister** the app's worker.
- **Cache Storage** → delete the app's caches (Workbox/PWA precache).

### From the app

When signed in, the app already runs a "clean room" local DB wipe on each login.
You can also force a full local reset from the browser console:

```js
window.resetAppDB()  // removes the local RxDB 'tripdb' and reloads
```

> Installed as a PWA? Also remove/reinstall the installed app (or use its
> in-app "Clear site data") so the cached service worker is replaced.

---

## 2. Clear Supabase test data (dev project only)

> ⚠️ **Dev project only.** Double-check which project your SQL Editor is
> connected to before running anything.

Run [`../supabase/dev_reset.sql`](../supabase/dev_reset.sql) in the Supabase
**SQL Editor**. It deletes all content rows, children first, in this order:

1. `trip_events`
2. `trips`
3. `group_invites`
4. `group_members`
5. `groups`

It leaves tables, RLS, helpers, and RPCs intact (so you do **not** need to
re-run migrations afterward — see the next section for when you do).

### Auth users

The reset script does **not** delete auth users. Remove test accounts manually
in **Supabase Dashboard → Authentication → Users**, or via admin tooling
**outside** the frontend app. Never put a service-role key or the Management API
in client code.

---

## 3. If you recreated the database / project

If you dropped tables or started a brand-new project, re-provision before
testing again:

- **Fresh project:** run [`../supabase/bootstrap.sql`](../supabase/bootstrap.sql)
  (everything in one idempotent script).
- **Existing project, applying phases in order:** run the migrations in date
  order — `20260615_create_trips.sql`, `20260616_create_groups.sql`,
  `20260617_group_members_invites.sql`, `20260618_group_trip_event_sharing.sql`,
  then `20260618_group_member_collaboration_fix.sql`. See
  [`../supabase/README.md`](../supabase/README.md).

---

## 4. Clean two-account convergence smoke test (after reset)

Use **Account A** and **Account B** (fresh emails if you deleted the old users).

**Online sharing**
1. **A:** create a group → copy its invite code → create group trip `A1` → add event `A1-E1`.
2. **B:** Join Group with the code → open the group → confirm `A1` and `A1-E1` are visible.
3. **B:** create group trip `B1` → add event `B1-E1`. **A** sees `B1` and `B1-E1`.
4. **A:** edit `A1-E1`. **B** sees the edit. **B:** edit `A1-E1` (or add `A1-E2`). **A** sees it.

**Offline-first convergence**
5. **A:** go offline (DevTools → Network → Offline). Create a group event while offline → it
   appears locally immediately. Go back online → **B** eventually sees A's offline-created event.
6. **B:** go offline. Edit a group event while offline → reconnect → **A** eventually sees B's edit.
7. **Join-while-logged-in backfill:** with B already logged in and active, have A create more group
   content, then have a *new* account C join the group → C should see the full existing dataset
   (this exercises the hydration backfill, not just the incremental pull).

**Deletes & isolation**
8. **A (owner):** soft-delete a group trip/event (or the group) → **B** sees the deletion after sync.
9. Confirm personal trips/events stay private to each account, and a non-member third account sees
   no group content.

> Convergence is **eventual**: allow a moment for reconnect + realtime/replication + hydration.
> If something looks stale, reopening the group workspace (or going offline→online) re-runs the
> backfill.
