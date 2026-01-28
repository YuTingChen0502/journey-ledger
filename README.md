# Nagoya 2026 Trip Planner (v0.3.6)

An advanced, offline-first travel itinerary management tool built for the 2026 Nagoya Trip.
Powered by **React**, **RxDB** (Local-First), and **Supabase** (Auth).

## 🚀 Key Features

### 📅 Smart Itinerary Planning
-   **Timeline View**: A drag-and-drop powered Gantt-chart style view for visualize your trip flow. Supports an **8-Day Itinerary** (Jan 31 - Feb 07).
-   **Data Grid**: A powerful table view for bulk editing events, sorting, and managing details.
-   **Floating Events**: A "Backlog" or "Unscheduled" area for ideas that haven't been assigned a specific time yet.

### 🧠 Intelligent Import System
-   **Natural Language Parsing**: Paste unstructured text (e.g., from Notion, Chat logs) and the app intelligently extracts dates, times, and locations.
-   **Staging Area**: Review and refine imported items before committing them to your main database.
-   **Multi-Day Support**: Automatically detects date headers (e.g., "Day 1: 2026-02-01") and assigns events accordingly.

### 🛡️ Robust Architecture
-   **Local-First Database**: Uses **RxDB** to store all data locally in your browser. Works completely offline.
-   **Crash Protection**: Built-in Error Boundaries and Safe Date Formatting prevent the app from breaking even with corrupt data.
-   **Data Recovery**: Includes a "Nuke Data" option to reset your local database in case of emergencies.

## 📝 Changelog

### v0.4.0: Interactive Timeline Engine (Current)
- **Vertical Week View**: Full interactive grid for Jan 31 - Feb 7, 2026.
- **Precision Drag & Drop**:
    - Absolute grid positioning with "Duration Lock" (moving doesn't resize).
    - 5-minute magnetic snapping (10px intervals).
- **Live Resizing**:
    - Bottom-handle resizing logic with touch support.
    - Real-time HUD showing "End Time" during manipulation.
- **UI Improvements**:
    - Collapsible "Unscheduled" Sidebar.
    - Refined Header Layout (Split Actions/Views).
    - Fixed Date Range & Timezone logic.

### v0.3.5: Event Management
- **Add/Edit Modal**: Unified `EventModal` with "Create" and "Update" modes.
- **Crash Prevention**: Robust date parsing and error boundaries.
- **Data Safety**: "Nuke Data" recovery option.

### v0.3.0: Smart Import & Staging
- **Natural Language Parsing**: Paste unstructured text (e.g., from Notion, Chat logs) and the app intelligently extracts dates, times, and locations.
- **Staging Area**: Review and refine imported items before committing them to your main database.
- **Multi-Day Support**: Automatically detects date headers (e.g., "Day 1: 2026-02-01") and assigns events accordingly.

## 🛠️ Tech Stack
-   **Frontend**: React 18, TypeScript, Vite
-   **UI Framework**: TailwindCSS, shadcn/ui
-   **Database**: RxDB (IndexedDB wrapper)
-   **Authentication**: Supabase
-   **Drag & Drop**: dnd-kit
-   **Date Handling**: date-fns

## 📝 TODO / Roadmap

### ✅ Completed
-   [x] Initial Setup & Database Schema
-   [x] Authentication (Google/Email)
-   [x] Smart Import Modal (Regex & JSON)
-   [x] Timeline & Table Views
-   [x] Drag & Drop Reordering
-   [x] **Critical**: Crash Proofing & Error Boundaries

### 🚧 Pending Features
-   [ ] **點即可展開詳細資訊 (Click to Expand Details)**
    -   Implement a collapsible detail view for each event card in the Timeline.
    -   Allow viewing notes, links, and reservation numbers without leaving the timeline.
-   [ ] **與 Google Map 導航功能連結 (Google Maps Navigation Link)**
    -   Add a "Navigate" button to event cards.
    -   Automatically open the location in Google Maps app based on the `location` field.
    -   Generate daily route summaries.

## 📦 quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## ⚠️ Troubleshooting
If you encounter a **White Screen** or **Crash**:
1.  Reload the page.
2.  If the red "Application Crashed" screen appears, click **"🗑️ Nuke Data & Reset"**.
3.  This will clear your local cache and fix data corruption issues.
