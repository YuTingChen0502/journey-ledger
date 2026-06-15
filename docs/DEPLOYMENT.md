# Deployment Guide

Deploying Journey Ledger is two parts: (1) provision the Supabase backend, and
(2) build and host the static PWA frontend. Nothing deploys automatically — run
these steps deliberately.

## 1. Supabase project setup

- [ ] Create a Supabase project (or reuse an existing one).
- [ ] Open **SQL Editor** and run [`../supabase/bootstrap.sql`](../supabase/bootstrap.sql). This creates both mirror tables (`trip_events`, `trips`), indexes, RLS policies, and the realtime publication. It is idempotent.
- [ ] Verify the tables exist (**Table Editor**) with the 5 columns: `id`, `updated_at`, `deleted`, `user_id`, `data`.
- [ ] Verify **RLS is enabled** on both tables (**Authentication → Policies**), each with SELECT / INSERT / UPDATE policies scoped to `auth.uid() = user_id`, and **no DELETE policy** (soft-delete via `deleted = true`).
- [ ] Verify **Realtime** includes both tables (**Database → Publications → `supabase_realtime`**).
- [ ] Configure Auth (email/OAuth providers as desired) and the site URL / redirect URLs.

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

## 4. Post-deploy smoke test

- [ ] App loads; the splash screen clears.
- [ ] Sign up / sign in works (Supabase Auth).
- [ ] TripLibrary loads; the legacy "Nagoya 2026" trip appears (first run bootstrap).
- [ ] Create a trip → it appears in the library.
- [ ] Open a trip → Journal and Planning render for the trip's date range.
- [ ] Add an event → it shows only in that trip (cross-trip isolation).
- [ ] Edit the trip (title/dates) → changes persist after reload.
- [ ] Reload while a trip is open → it reopens (selected-trip persistence).
- [ ] Click "All Trips", reload → starts at TripLibrary.
- [ ] Soft-delete a temporary trip → it disappears from the library.
- [ ] Go offline → app still works; go back online → data syncs (check a second device/browser).
- [ ] Install as PWA (icon = Journey Ledger mark).

## 5. Known operational notes

- **Quotas are frontend-only** (UX guard). There is no backend enforcement yet — see the design note in [`../supabase/README.md`](../supabase/README.md).
- First load per user upserts a legacy `nagoya-2026` seed trip so any pre-existing events are not orphaned. This is expected demo/seed data, not active routing.
