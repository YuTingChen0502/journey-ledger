# Journey Ledger

**Journey Ledger** is a local-first travel journal and planner. It lets you capture, plan, and review trips with a magazine-style interface that works fully offline and syncs when you reconnect.

> **Project direction:** Journey Ledger began as the single-trip **Nagoya 2026** planner (`Nagoya_ledger`) and is being refactored into a general **multi-trip** travel ledger. Multi-trip support is planned — see the phase plan in [`CLAUDE.md`](CLAUDE.md). The current build still behaves as the original single-trip app while the refactor is in progress.

## Tech Stack

* **React + TypeScript + Vite** — frontend.
* **RxDB** — local-first IndexedDB storage (offline-first).
* **Supabase** — Auth, PostgreSQL, and sync.
* **PWA** — installable, offline-capable.

## Core Features

* **Journal / Overview** — review your trip.
* **Planning Timeline** — interactive, drag-and-resize itinerary planning.
* **Table** — tabular event editing and batch actions.
* **Smart Import** — paste an itinerary and parse it into events.
* **Event Detail** — per-event notes, checklist, and location.
* **Offline-first** — full operation without a network; auto-sync when online.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev

# 3. Build for production
npm run build
```

Supabase credentials are supplied via environment variables (see `.env`). Do not commit secrets.

## Documentation

* **[User Guide](docs/USER_GUIDE.md)** — dashboard, timeline planning, smart import, offline mode.
* **[Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)** — stack, architecture, and security review.
* **[CLAUDE.md](CLAUDE.md)** — project direction, phase plan, and engineering rules for contributors and AI coding sessions.

---
*Originated from `Nagoya_ledger`. Now evolving into a general multi-trip travel ledger.*
