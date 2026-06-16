# Deployment Guide

Deploying Journey Ledger is two parts: (1) provision the Supabase backend, and
(2) build and host the static PWA frontend. Nothing deploys automatically — run
these steps deliberately.

## 1. Supabase project setup

- [ ] Create a Supabase project (or reuse an existing one).
- [ ] Open **SQL Editor** and run [`../supabase/bootstrap.sql`](../supabase/bootstrap.sql). This creates the mirror tables (`trip_events`, `trips`, `groups`), the group membership tables (`group_members`, `group_invites`), the `join_group_by_invite_code` RPC + helpers/trigger, indexes, RLS policies, and the realtime publication. It is idempotent. *(An already-deployed project upgrading to Phase 12C should instead run [`../supabase/migrations/20260617_group_members_invites.sql`](../supabase/migrations/20260617_group_members_invites.sql) — required before cross-account invite-code joining works.)*
- [ ] Verify the mirror tables exist (**Table Editor**) with the 5 columns: `id`, `updated_at`, `deleted`, `user_id`, `data`.
- [ ] Verify **RLS is enabled** on both tables (**Authentication → Policies**), each with SELECT / INSERT / UPDATE policies scoped to `auth.uid() = user_id`, and **no DELETE policy** (soft-delete via `deleted = true`).
- [ ] Verify **Realtime** includes both tables (**Database → Publications → `supabase_realtime`**).
- [ ] Configure Auth providers (email/OAuth as desired).
- [ ] Set **Auth → URL Configuration**:
  - **Site URL** → your deployed production URL (e.g. `https://your-app.vercel.app`).
  - **Redirect URLs** → add the production URL (e.g. `https://your-app.vercel.app/**`). You may keep `http://localhost:5173/**` for local dev.
  - These must match the origin the app is served from, or magic-link / OAuth redirects will fail in production.

See [`../supabase/README.md`](../supabase/README.md) for the full column contract and RLS expectations.

## 2. Environment variables

Set these on your hosting provider (and locally in `.env.local`):

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon / publishable** key |

- [ ] **Never** set `service_role` / secret keys in the frontend env — they bypass RLS and ship to the browser. The client uses the anon key only; row ownership is enforced by RLS.

## 3. Build & host

Journey Ledger is a static SPA/PWA — host the build output on any static host
(Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3 + CDN, etc.).

| Setting | Value |
|---------|-------|
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 18+ (20+ recommended) |

- [ ] Configure SPA fallback (rewrite all routes to `/index.html`) if your host needs it.
- [ ] Ensure HTTPS (required for service worker / PWA install).

### Vercel (recommended)

- [ ] Import the repo into Vercel. Framework preset: **Vite** (auto-detected).
- [ ] Build command: `npm run build` · Output directory: `dist` · Install: `npm install`.
- [ ] SPA fallback is already provided by [`../vercel.json`](../vercel.json) (rewrites all routes to `/index.html`) — no extra config needed.
- [ ] Add environment variables in **Project → Settings → Environment Variables** (Production + Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. **Anon key only — never the `service_role`/secret key.**
- [ ] After the first deploy, copy the production URL into Supabase **Auth → URL Configuration** (Site URL + Redirect URLs, see §1).
- [ ] Redeploy if you changed env vars after the initial build (Vite inlines `VITE_*` at build time).

## 4. Post-deploy smoke test

- [ ] App loads; the splash screen clears.
- [ ] Sign up / sign in works (Supabase Auth).
- [ ] TripLibrary loads — a brand-new account shows the empty-state onboarding (no auto-seeded trip); existing accounts show their synced trips.
- [ ] Create a trip → it appears in the library.
- [ ] Open a trip → Journal and Planning render for the trip's date range.
- [ ] Add an event → it shows only in that trip (cross-trip isolation).
- [ ] Edit the trip (title/dates) → changes persist after reload.
- [ ] Reload while a trip is open → it reopens (selected-trip persistence).
- [ ] Click "All Trips", reload → starts at TripLibrary.
- [ ] Soft-delete a temporary trip → it disappears from the library.
- [ ] Go offline → app still works; go back online → data syncs (check a second device/browser).
- [ ] Install as PWA (icon = Journey Ledger mark).

## 5. RLS / user-isolation smoke test (two accounts)

Confirms Row Level Security keeps each user's trips/events private. Use two
separate accounts (different emails), ideally in two browsers or one normal + one
private window.

```text
Account A:
- log in
- create "Trip A"
- open Trip A, create "Event A"

Account B:
- log in (separate browser / private window)
- confirm Trip A and Event A are NOT visible
- create "Trip B" + "Event B"

Account A:
- log back in / refresh
- confirm Trip B and Event B are NOT visible
```

Expected: each account sees only its own trips/events. If A sees B's data, RLS
is misconfigured — re-check that RLS is **enabled** and the SELECT policy is
`auth.uid() = user_id` on **both** `trips` and `trip_events` (see
[`../supabase/README.md`](../supabase/README.md)).

> Verify server-side too: in Supabase **Table Editor**, the `user_id` column on
> new rows should equal the creating user's auth id, and a SQL query as one user
> (via the API with their token) must never return another user's rows.

## 6. Same-account multi-device sync smoke test

Confirms local-first data syncs through Supabase for the same user.

```text
Account A — browser/device 1:
- log in
- create a trip + event

Account A — browser/device 2:
- log in as the same account
- after sync (refresh if needed), confirm the trip + event appear
```

Expected: data created on device 1 appears on device 2 once replication pulls
(realtime, or on refresh). Some lag is normal (local-first; pull is checkpointed).

## 7. iPhone — Add to Home Screen (PWA)

```text
iPhone Safari:
1. Open the deployed production URL.
2. Tap the Share button.
3. Tap "Add to Home Screen".
4. Confirm the name ("Journey Ledger") and icon, then Add.
5. Open the app from the Home Screen.
```

Verify:

- [ ] App name shows as **Journey Ledger**.
- [ ] The app icon appears (neutral Journey Ledger mark from `public/logo.svg`).
- [ ] Launches in standalone mode (minimal browser chrome) if the manifest is honored.
- [ ] Reloading / relaunching does not crash; offline baseline still renders.
- [ ] Login still works when launched from the Home Screen.

> Note: the PWA manifest currently uses a single **SVG** icon. Modern browsers
> accept this; if iOS home-screen icon fidelity is poor, adding raster 192/512
> PNG icons is a documented post-release backlog item (not required to ship).

## 8. Known operational notes

- **Quotas are frontend-only** (UX guard). There is no backend enforcement yet — see the design note in [`../supabase/README.md`](../supabase/README.md).
- New accounts are **not** auto-seeded with any trip (Phase 11) — they start with an empty TripLibrary onboarding state. The legacy `nagoya-2026` seed trip is only present for accounts that already had it; it is no longer created on login.
