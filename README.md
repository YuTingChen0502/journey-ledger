# Nagoya 2026 Trip Planner (v1.1.0)

An advanced, offline-first travel itinerary management tool built for the 2026 Nagoya Trip.
Powered by **React**, **RxDB** (Local-First), and **Supabase** (Auth).

## 🚀 Key Features

### 📅 Minimalist Timeline View
-   **Aesthetic Focus**: A clean, "Magazine-style" Gantt chart that reduces visual noise by hiding secondary details.
-   **Precision Control**: Drag-and-drop powered event scheduling with 5-minute magnetic snapping.
-   **Clear Overview**: Focuses purely on the *Flow of Time*—Event Titles and Durations take center stage.

### 📖 Digital Journal (Unified Detail View)
-   **Click-to-Reveal**: Clicking any event (in Timeline or Grid) opens a rich "Digital Journal" modal.
-   **Context Rich**: Stores full location details, notes, and navigation links without cluttering the main view.
-   **Edit Experience**: Seamlessly switch between Read Mode and Edit Mode from a single unified interface.

### 🛡️ Safe Data Management
-   **Batch Actions**: A dedicated "Data Grid" table view for bulk management.
-   **Safety Lock**: "Delete All" operations require typed confirmation ('DELETE') to prevent accidental data loss.
-   **Local-First Compliance**: All changes are instantly saved to the browser's indexedDB, ensuring zero data loss even offline.

### 🧠 Intelligent Import System
-   **Smart Parsing**: Paste unstructured text (e.g., from Notion, Chat logs) or JSON.
-   **Context Mapping**: Automatically extracts:
    -   `Date: YYYY-MM-DD` headers
    -   `HH:mm Title` patterns
    -   Locations and Long Descriptions (mapped to Journal notes)
-   **Staging Area**: Review and refine parsed items before committing them to your database.

### 🌤️ Smart Automation (v1.1)
-   **Auto-Geocoding**: Smartly parses complex addresses (removing parenthesis, etc.) to find coordinates via OpenStreetMap Nominatim.
-   **Instant Weather**: Automatically fetches weather forecast for the event location/time upon opening the journal.
-   **Checklist & Memo**: Integrated Todo list and rich memo field for every event.

## 🛠️ Tech Stack
-   **Frontend**: React 18, TypeScript, Vite
-   **UI Framework**: TailwindCSS, shadcn/ui
-   **Database**: RxDB (Local-First Sync)
-   **Drag & Drop**: @dnd-kit/core
-   **Date Handling**: date-fns
-   **Icons**: lucide-react

## 📝 Changelog

### v1.1.0: Automation & Rich Details (Current)
-   **Smart Geocoding**: Upgraded to OpenStreetMap Nominatim with intelligent fallback logic for complex addresses.
-   **Productivity**: Added Checklist (Todos) and Memo fields to event details.
-   **Weather v2**: Fixed race conditions and simplified the UI (Horizontal layout, No-Emoji labels).

### v0.6.4: Aesthetic Rollback & Safety
-   **Visual Refinement**: Removed Location text from Duration Bars for a cleaner UI.
-   **Grid Polish**: Integrated "Delete All" into the Table Header for alignment perfection.
-   **Safety**: Added AlertDialog lock for destructive batch operations.

### v0.6.0: Intelligence Expansion
-   **Import V2**: Added Location field support and Description auto-mapping.
-   **Draft Cards**: Enhanced Staging UI with expand/collapse logic for long text.

### v0.5.x: Global Unification
-   **Journal View**: Unified "Event Detail" modal across all views.
-   **Interaction Fixes**: Resolved conflict between "Click to View" and "Drag to Move".

## 📦 Import Protocols

### JSON Format (Recommended)
```json
[
  {
    "title": "Visit Nagoya Castle",
    "date": "2026-02-01",
    "time": "10:30",
    "location": "Nagoya Castle",
    "note": "Bring camera"
  }
]
```

### Text Format (Quick Paste)
```text
Date: 2026-02-01
09:00 Breakfast at Hotel
10:30 Visit Nagoya Castle
```

## ⚠️ Troubleshooting
If you encounter a **White Screen** or **Crash**:
1.  Reload the page.
2.  If the red "Application Crashed" screen appears, click **"🗑️ Nuke Data & Reset"**.
3.  This will clear your local cache and fix data corruption issues.
