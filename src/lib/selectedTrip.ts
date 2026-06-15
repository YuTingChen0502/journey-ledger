// Persistence for the currently-selected trip (Phase 7).
//
// Only the trip id is stored — no sensitive data. Used so a page reload returns
// the user to the trip they were viewing, with graceful fallback to TripLibrary
// when the stored trip no longer exists / has been soft-deleted.

export const SELECTED_TRIP_STORAGE_KEY = 'journey_ledger_selected_trip_id';

export function loadSelectedTripId(): string | null {
    try {
        const value = localStorage.getItem(SELECTED_TRIP_STORAGE_KEY);
        return value && value.length > 0 ? value : null;
    } catch {
        return null;
    }
}

export function saveSelectedTripId(id: string): void {
    // Ignore empty ids so we never persist a meaningless selection.
    if (!id) return;
    try {
        localStorage.setItem(SELECTED_TRIP_STORAGE_KEY, id);
    } catch {
        // localStorage may be unavailable (private mode / quota); persistence is
        // best-effort and non-critical.
    }
}

export function clearSelectedTripId(): void {
    try {
        localStorage.removeItem(SELECTED_TRIP_STORAGE_KEY);
    } catch {
        // ignore
    }
}
