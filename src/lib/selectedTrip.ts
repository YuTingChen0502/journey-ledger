// Persistence for the currently-selected trip (Phase 7).
//
// Only the trip id is stored — no sensitive data. Used so a page reload returns
// the user to the trip they were viewing, with graceful fallback to TripLibrary
// when the stored trip no longer exists / has been soft-deleted.

export const SELECTED_TRIP_STORAGE_KEY = 'journey_ledger_selected_trip_id';
// Phase 12A: the selected workspace is persisted alongside the trip so a trip
// from one workspace cannot be restored under a different workspace.
export const SELECTED_WORKSPACE_STORAGE_KEY = 'journey_ledger_selected_workspace_id';

function readKey(key: string): string | null {
    try {
        const value = localStorage.getItem(key);
        return value && value.length > 0 ? value : null;
    } catch {
        return null;
    }
}

function writeKey(key: string, value: string): void {
    if (!value) return; // never persist an empty selection
    try {
        localStorage.setItem(key, value);
    } catch {
        // localStorage may be unavailable (private mode / quota); persistence is
        // best-effort and non-critical.
    }
}

function removeKey(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // ignore
    }
}

export function loadSelectedTripId(): string | null {
    return readKey(SELECTED_TRIP_STORAGE_KEY);
}

export function saveSelectedTripId(id: string): void {
    writeKey(SELECTED_TRIP_STORAGE_KEY, id);
}

export function clearSelectedTripId(): void {
    removeKey(SELECTED_TRIP_STORAGE_KEY);
}

export function loadSelectedWorkspaceId(): string | null {
    return readKey(SELECTED_WORKSPACE_STORAGE_KEY);
}

export function saveSelectedWorkspaceId(id: string): void {
    writeKey(SELECTED_WORKSPACE_STORAGE_KEY, id);
}

export function clearSelectedWorkspaceId(): void {
    removeKey(SELECTED_WORKSPACE_STORAGE_KEY);
}
