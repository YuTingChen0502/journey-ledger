# Journey Ledger

**Journey Ledger** is a local-first, multi-trip travel journal and planner. Each trip is its own workspace with a Journal, a Planning timeline, a data Table, and Smart Import — all working fully offline and syncing to the cloud when you reconnect.

> Originated from the single-trip `Nagoya_ledger` app and refactored into a general multi-trip ledger. See [`CLAUDE.md`](CLAUDE.md) for the full phase history.

## Features

* **Multi-trip workspaces** — create, edit, soft-delete, and switch between trips; the selected trip persists across reloads.
* **Journal / Overview** — read-only day-by-day view of a trip, driven by the trip's date range.
* **Planning Timeline** — drag/resize events across the trip's days, with a backlog for unscheduled items.
* **Table** — sortable data grid with scoped batch delete.
* **Smart Import** — paste an itinerary and parse it into events (out-of-range items go to the backlog).
* **Event detail** — notes, checklist, location, weather, and one-tap navigation.
* **Offline-first** — full operation without a network; auto-sync when online.

## Tech stack

* **React + TypeScript + Vite** — frontend.
* **RxDB** — local-first IndexedDB storage.
* **Supabase** — Auth, PostgreSQL, and sync (JSONB mirror tables `trips` + `trip_events`).
* **PWA** — installable, offline-capable.

## Quotas (frontend, UX-only)

Reasonable client-side limits guard against runaway local growth (see [`src/lib/quotas.ts`](src/lib/quotas.ts)): **10 trips/user**, **500 events/trip**, **50 checklist items/event**, **5000-char memos**. These are a UX guard, **not a security boundary** — authoritative enforcement is future backend work (see [`supabase/README.md`](supabase/README.md)).

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # start the dev server
npm run build                # production build
npm test                     # run the test suite (Vitest)
```

### Environment variables

Set these in `.env.local` (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | The Supabase **anon / publishable** key |

> ⚠️ Use the **anon/publishable** key only. **Never** put the `service_role` / secret key in `.env.local` or any client env — it bypasses RLS and would be shipped to the browser.

## Supabase & deployment

* First-time Supabase setup (tables, RLS, realtime): [`supabase/README.md`](supabase/README.md) → run [`supabase/bootstrap.sql`](supabase/bootstrap.sql).
* Production deployment checklist: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Testing

```bash
npm test
```

Vitest covers the pure-logic layer in `src/lib/` — quota helpers, trip date-range generation, trip-scoping selectors, and selected-trip persistence.

## Documentation

* [User Guide](docs/USER_GUIDE.md) · [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md) · [Deployment](docs/DEPLOYMENT.md) · [Supabase setup](supabase/README.md)
* [CLAUDE.md](CLAUDE.md) — project direction, phase plan, and engineering rules.

---
*Local-first. Your trips live on your device first, and sync when you're online.*
