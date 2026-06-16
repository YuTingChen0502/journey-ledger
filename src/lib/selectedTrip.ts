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

// Phase 12C: persist the full selected workspace descriptor (id + name + type),
// not just the id. A JOINED group workspace is not present in the local RxDB
// `groups` collection (it's owner-scoped), so on reload we reconstruct the
// active group workspace from this descriptor instead of resolving a local doc.
export const SELECTED_WORKSPACE_DESC_KEY = 'journey_ledger_selected_workspace';

export interface StoredWorkspace {
    id: string;
    name: string;
    type: 'personal' | 'group';
}

export function saveSelectedWorkspace(ws: StoredWorkspace): void {
    if (!ws?.id) return;
    // Keep the legacy id key in sync for backward compatibility.
    writeKey(SELECTED_WORKSPACE_STORAGE_KEY, ws.id);
    try {
        localStorage.setItem(SELECTED_WORKSPACE_DESC_KEY, JSON.stringify(ws));
    } catch {
        // best-effort
    }
}

export function loadSelectedWorkspace(): StoredWorkspace | null {
    const raw = readKey(SELECTED_WORKSPACE_DESC_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<StoredWorkspace>;
        if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string'
            && (parsed.type === 'personal' || parsed.type === 'group')) {
            return parsed as StoredWorkspace;
        }
    } catch {
        // corrupt value — treat as no selection
    }
    return null;
}

export function clearSelectedWorkspace(): void {
    removeKey(SELECTED_WORKSPACE_STORAGE_KEY);
    removeKey(SELECTED_WORKSPACE_DESC_KEY);
}
