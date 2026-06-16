# Deployment Guide

Deploying Journey Ledger is two parts: provision the Supabase backend, then build and host the static PWA frontend.

## 1. Supabase Project Setup

- [ ] Create a Supabase project, or reuse an existing one.
- [ ] For a fresh project, open SQL Editor and run [`../supabase/bootstrap.sql`](../supabase/bootstrap.sql). It creates the mirror tables, group membership/invite tables, invite RPC, ownership-safe sync RPCs, indexes, RLS policies, and realtime publication.
- [ ] For an already-deployed project upgrading from Phase 12C, run [`../supabase/migrations/20260618_group_trip_event_sharing.sql`](../supabase/migrations/20260618_group_trip_event_sharing.sql) before testing shared group trips/events.
- [ ] Verify `trip_events`, `trips`, and `groups` exist with the mirror columns: `id`, `updated_at`, `deleted`, `user_id`, `data`.
- [ ] Verify `group_members` and `group_invites` exist.
- [ ] Verify RLS is enabled. `trips` / `trip_events` should have member-aware SELECT policies and blocked direct INSERT/UPDATE policies; writes go through `sync_trip_documents` and `sync_trip_event_documents`.
- [ ] Verify Realtime includes `trip_events`, `trips`, and `groups` in `supabase_realtime`.
- [ ] Configure Auth providers.
- [ ] Set Auth URL Configuration:
  - Site URL: your deployed production URL, such as `https://your-app.vercel.app`.
  - Redirect URLs: add the production wildcard, such as `https://your-app.vercel.app/**`, and keep `http://localhost:5173/**` for local dev.

For password recovery, Supabase Auth Redirect URLs must include:

```text
https://<production-domain>/reset-password
https://<production-domain>/**
http://localhost:5173/reset-password
http://localhost:5173/**
```

Do not hardcode the production domain in app code; Journey Ledger builds the reset redirect from `window.location.origin`.

### Email sending & signup/password-reset rate limits

Supabase's **built-in email provider is for testing/demo only** and has a **very
low email-send limit**. This affects both signup confirmation emails and
forgot-password recovery emails. Repeated requests can return
`email rate limit exceeded` or another rate-limit error (HTTP 429). The app
detects this in both flows and shows a friendly message:

```text
Too many emails were requested. Please wait about an hour and try again.
```

The frontend does **not**, and must not, try to bypass the limit.

For production / heavier testing:

- [ ] Configure **Custom SMTP** in **Supabase Dashboard → Authentication →
  Emails → SMTP Settings** (use your own email provider). The built-in provider
  is not suitable for production.
- [ ] After enabling Custom SMTP, raise the relevant caps under **Authentication
  → Rate Limits** (for example signup confirmation, password recovery, and
  email-send limits) to values your provider supports.
- [ ] Keep secrets server-side: SMTP credentials live in the Supabase Dashboard
  only. **Never** commit SMTP secrets, service-role keys, or Management API
  calls into the frontend.

See [`../supabase/README.md`](../supabase/README.md) for the full column contract and RLS expectations.

## 2. Environment Variables

Set these on your hosting provider and locally in `.env.local`:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon / publishable key |

- [ ] Never set `service_role` / secret keys in frontend env. The client uses the anon key only.

## 3. Build & Host

Journey Ledger is a static SPA/PWA. Host the build output on Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3 + CDN, or another static host.

| Setting | Value |
|---------|-------|
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 18+ (20+ recommended) |

- [ ] Configure SPA fallback to `/index.html` if your host needs it.
- [ ] Ensure HTTPS for service worker / PWA install.

### Vercel

- [ ] Import the repo into Vercel. Framework preset: Vite.
- [ ] Build command: `npm run build`; output directory: `dist`; install command: `npm install`.
- [ ] SPA fallback is already provided by [`../vercel.json`](../vercel.json).
- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Project Settings / Environment Variables.
- [ ] After the first deploy, copy the production URL into Supabase Auth URL Configuration.
- [ ] Redeploy if you changed env vars after the initial build.

## 4. Post-Deploy Smoke Test

- [ ] App loads and the splash screen clears.
- [ ] Sign up / sign in works.
- [ ] Forgot password sends a Supabase reset email; the link returns to `/reset-password`; setting a new password succeeds.
- [ ] TripLibrary loads. A brand-new account shows the empty state.
- [ ] Create a personal trip; it appears in the Personal workspace.
- [ ] Open the trip; Journal and Planning render for the trip's date range.
- [ ] Add an event; it shows only in that trip.
- [ ] Edit the trip title/dates; changes persist after reload.
- [ ] Reload while a trip is open; it reopens.
- [ ] Click "All Trips", reload; it starts at TripLibrary.
- [ ] Soft-delete a temporary trip; it disappears from the library.
- [ ] Go offline; app still works. Go back online; data syncs.
- [ ] Install as PWA.

## 5. Personal RLS Isolation Test

Use two separate accounts in two browsers or one normal plus one private window.

```text
Account A:
- log in
- create a Personal trip "Trip A"
- open Trip A and create "Event A"

Account B:
- log in separately
- confirm Trip A and Event A are NOT visible in Personal
- create Personal "Trip B" and "Event B"

Account A:
- refresh
- confirm Trip B and Event B are NOT visible in Personal
```

Expected: personal content remains private. If personal trips/events cross accounts, RLS is misconfigured.

## 6. Group Sharing Smoke Test

Run this only after applying Phase 12D SQL.

```text
Account A:
- create a group
- copy its invite code
- create a group trip
- create an event in that group trip

Account B:
- join the group by invite code
- enter the group workspace
- confirm Account A's group trip is visible
- open the trip and confirm Account A's event is visible
- create a new event in that shared group trip
- edit an event in that shared group trip

Account A:
- refresh or wait for sync
- confirm Account B's event/change appears
```

Expected: active group members can see group trips and create/edit events in group trips. Personal trips remain private. Groups the user has not joined remain invisible.

## 7. Same-Account Multi-Device Sync Test

```text
Account A, browser/device 1:
- log in
- create a trip and event

Account A, browser/device 2:
- log in as the same account
- after sync, confirm the trip and event appear
```

Some lag is normal because sync is local-first and checkpointed.

## 8. iPhone Add To Home Screen

```text
iPhone Safari:
1. Open the deployed production URL.
2. Tap Share.
3. Tap Add to Home Screen.
4. Confirm the name Journey Ledger and icon.
5. Open the app from the Home Screen.
```

Verify the app name, icon, standalone launch, reload behavior, offline baseline, and login.

## 9. Known Operational Notes

- Quotas are frontend-only UX guards; backend enforcement remains future work.
- New accounts are not auto-seeded with any trip.
- Group membership/invites are online security data. Owned groups sync locally; joined group descriptors are fetched online.
- Group trip/event content is local-first after Phase 12D, with a hydration pass for historical shared rows.
