import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SELECTED_TRIP_STORAGE_KEY,
    loadSelectedTripId,
    saveSelectedTripId,
    clearSelectedTripId,
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
});
