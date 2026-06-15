import { describe, it, expect } from 'vitest';
import {
    QUOTAS,
    canCreateTrip,
    canAddEvents,
    canAddChecklistItem,
    isMemoWithinLimit,
    getRemainingEventCapacity,
} from './quotas';

describe('canCreateTrip', () => {
    it('allows creation below the limit', () => {
        expect(canCreateTrip(0)).toBe(true);
        expect(canCreateTrip(QUOTAS.maxTripsPerUser - 1)).toBe(true);
    });
    it('blocks creation at or above the limit', () => {
        expect(canCreateTrip(QUOTAS.maxTripsPerUser)).toBe(false);
        expect(canCreateTrip(QUOTAS.maxTripsPerUser + 5)).toBe(false);
    });
});

describe('canAddEvents', () => {
    it('allows a single event below the limit', () => {
        expect(canAddEvents(0, 1)).toBe(true);
        expect(canAddEvents(QUOTAS.maxEventsPerTrip - 1, 1)).toBe(true);
    });
    it('allows a batch that exactly fills remaining capacity', () => {
        expect(canAddEvents(QUOTAS.maxEventsPerTrip - 10, 10)).toBe(true);
    });
    it('blocks a single event at the limit', () => {
        expect(canAddEvents(QUOTAS.maxEventsPerTrip, 1)).toBe(false);
    });
    it('blocks an import batch that exceeds remaining capacity', () => {
        expect(canAddEvents(QUOTAS.maxEventsPerTrip - 10, 11)).toBe(false);
        expect(canAddEvents(490, 50)).toBe(false);
    });
    it('treats a zero/negative incoming count as allowed (no-op)', () => {
        expect(canAddEvents(QUOTAS.maxEventsPerTrip, 0)).toBe(true);
        expect(canAddEvents(QUOTAS.maxEventsPerTrip, -3)).toBe(true);
    });
});

describe('canAddChecklistItem', () => {
    it('allows below the limit', () => {
        expect(canAddChecklistItem(0)).toBe(true);
        expect(canAddChecklistItem(QUOTAS.maxChecklistItemsPerEvent - 1)).toBe(true);
    });
    it('blocks at or above the limit', () => {
        expect(canAddChecklistItem(QUOTAS.maxChecklistItemsPerEvent)).toBe(false);
        expect(canAddChecklistItem(QUOTAS.maxChecklistItemsPerEvent + 1)).toBe(false);
    });
});

describe('isMemoWithinLimit', () => {
    it('allows empty and short memos', () => {
        expect(isMemoWithinLimit('')).toBe(true);
        expect(isMemoWithinLimit('a short note')).toBe(true);
    });
    it('allows a memo exactly at the limit', () => {
        expect(isMemoWithinLimit('x'.repeat(QUOTAS.maxMemoLength))).toBe(true);
    });
    it('blocks a memo over the limit', () => {
        expect(isMemoWithinLimit('x'.repeat(QUOTAS.maxMemoLength + 1))).toBe(false);
    });
});

describe('getRemainingEventCapacity', () => {
    it('returns full capacity when empty', () => {
        expect(getRemainingEventCapacity(0)).toBe(QUOTAS.maxEventsPerTrip);
    });
    it('returns the difference below the limit', () => {
        expect(getRemainingEventCapacity(QUOTAS.maxEventsPerTrip - 7)).toBe(7);
    });
    it('never returns a negative number', () => {
        expect(getRemainingEventCapacity(QUOTAS.maxEventsPerTrip)).toBe(0);
        expect(getRemainingEventCapacity(QUOTAS.maxEventsPerTrip + 50)).toBe(0);
    });
});
