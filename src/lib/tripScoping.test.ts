import { describe, it, expect } from 'vitest';
import { tripEventsSelector } from './tripScoping';

describe('tripEventsSelector', () => {
    it('scopes by the given trip id', () => {
        const selector = tripEventsSelector('trip-abc');
        expect(selector.trip_id).toEqual({ $eq: 'trip-abc' });
    });

    it('always excludes soft-deleted events', () => {
        const selector = tripEventsSelector('trip-abc');
        expect(selector.is_deleted).toEqual({ $eq: false });
    });

    it('produces distinct selectors for distinct trips (no cross-trip leakage)', () => {
        const a = tripEventsSelector('trip-a');
        const b = tripEventsSelector('trip-b');
        expect(a.trip_id).toEqual({ $eq: 'trip-a' });
        expect(b.trip_id).toEqual({ $eq: 'trip-b' });
        expect(a).not.toEqual(b);
    });

    it('only contains the expected scoping keys', () => {
        const selector = tripEventsSelector('trip-abc');
        expect(Object.keys(selector).sort()).toEqual(['is_deleted', 'trip_id']);
    });
});
