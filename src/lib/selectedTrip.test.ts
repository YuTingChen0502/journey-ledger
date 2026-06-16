import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SELECTED_TRIP_STORAGE_KEY,
    SELECTED_WORKSPACE_STORAGE_KEY,
    SELECTED_WORKSPACE_DESC_KEY,
    loadSelectedTripId,
    saveSelectedTripId,
    clearSelectedTripId,
    loadSelectedWorkspaceId,
    saveSelectedWorkspaceId,
    clearSelectedWorkspaceId,
    saveSelectedWorkspace,
    loadSelectedWorkspace,
    clearSelectedWorkspace,
} from './selectedTrip';

// Minimal in-memory localStorage stub so these tests do not depend on a DOM env.
function createMemoryStorage(): Storage {
    let store: Record<string, string> = {};
    return {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = String(v); },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { store = {}; },
        key: (i: number) => Object.keys(store)[i] ?? null,
        get length() { return Object.keys(store).length; },
    } as Storage;
}

describe('selectedTrip persistence helpers', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', createMemoryStorage());
    });

    it('returns null when nothing is stored', () => {
        expect(loadSelectedTripId()).toBeNull();
    });

    it('saves and loads a trip id', () => {
        saveSelectedTripId('trip-123');
        expect(localStorage.getItem(SELECTED_TRIP_STORAGE_KEY)).toBe('trip-123');
        expect(loadSelectedTripId()).toBe('trip-123');
    });

    it('ignores an empty id', () => {
        saveSelectedTripId('');
        expect(loadSelectedTripId()).toBeNull();
    });

    it('clears a stored id', () => {
        saveSelectedTripId('trip-123');
        clearSelectedTripId();
        expect(loadSelectedTripId()).toBeNull();
    });

    it('treats an empty stored string as no selection', () => {
        localStorage.setItem(SELECTED_TRIP_STORAGE_KEY, '');
        expect(loadSelectedTripId()).toBeNull();
    });

    // Phase 12A: workspace identity persistence
    it('saves and loads a selected workspace id', () => {
        saveSelectedWorkspaceId('personal:user-123');
        expect(localStorage.getItem(SELECTED_WORKSPACE_STORAGE_KEY)).toBe('personal:user-123');
        expect(loadSelectedWorkspaceId()).toBe('personal:user-123');
    });

    it('ignores an empty workspace id and clears it', () => {
        saveSelectedWorkspaceId('');
        expect(loadSelectedWorkspaceId()).toBeNull();
        saveSelectedWorkspaceId('personal:user-123');
        clearSelectedWorkspaceId();
        expect(loadSelectedWorkspaceId()).toBeNull();
    });

    it('keeps trip and workspace selections independent', () => {
        saveSelectedTripId('trip-1');
        saveSelectedWorkspaceId('personal:user-123');
        clearSelectedTripId();
        expect(loadSelectedTripId()).toBeNull();
        expect(loadSelectedWorkspaceId()).toBe('personal:user-123');
    });

    // Phase 12C: full workspace descriptor (id + name + type) so a joined group
    // workspace can be reconstructed on reload without a local RxDB doc.
    it('saves and loads a group workspace descriptor', () => {
        saveSelectedWorkspace({ id: 'g-1', name: 'Family', type: 'group' });
        expect(loadSelectedWorkspace()).toEqual({ id: 'g-1', name: 'Family', type: 'group' });
        // legacy id key stays in sync for backward compatibility
        expect(loadSelectedWorkspaceId()).toBe('g-1');
    });

    it('clears both the descriptor and the legacy id key', () => {
        saveSelectedWorkspace({ id: 'g-1', name: 'Family', type: 'group' });
        clearSelectedWorkspace();
        expect(loadSelectedWorkspace()).toBeNull();
        expect(loadSelectedWorkspaceId()).toBeNull();
    });

    it('returns null for a corrupt descriptor value', () => {
        localStorage.setItem(SELECTED_WORKSPACE_DESC_KEY, '{not json');
        expect(loadSelectedWorkspace()).toBeNull();
    });

    it('rejects a descriptor with an invalid type', () => {
        localStorage.setItem(SELECTED_WORKSPACE_DESC_KEY, JSON.stringify({ id: 'x', name: 'X', type: 'bogus' }));
        expect(loadSelectedWorkspace()).toBeNull();
    });

    it('does not persist a descriptor with an empty id', () => {
        saveSelectedWorkspace({ id: '', name: 'X', type: 'group' });
        expect(loadSelectedWorkspace()).toBeNull();
    });
});
