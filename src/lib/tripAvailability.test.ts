import { describe, expect, it } from 'vitest';
import { getTripAvailabilityIssue } from './tripAvailability';

const baseTrip = {
    id: 'trip-1',
    owner_id: 'user-1',
    title: 'Group Trip',
    start_date: '2026-06-01',
    end_date: '2026-06-08',
    created_at: 1,
    updated_at: 1,
    is_deleted: false,
};

describe('getTripAvailabilityIssue', () => {
    it('accepts a complete trip row', () => {
        expect(getTripAvailabilityIssue(baseTrip)).toBeNull();
    });

    it('flags a missing trip row', () => {
        expect(getTripAvailabilityIssue(null)).toBe('missing-trip');
    });

    it('flags missing identity fields', () => {
        expect(getTripAvailabilityIssue({ ...baseTrip, id: '' })).toBe('missing-id');
        expect(getTripAvailabilityIssue({ ...baseTrip, title: '' })).toBe('missing-title');
    });

    it('flags missing or inverted trip dates', () => {
        expect(getTripAvailabilityIssue({ ...baseTrip, start_date: undefined })).toBe('invalid-date-range');
        expect(getTripAvailabilityIssue({ ...baseTrip, end_date: '2026-05-31' })).toBe('invalid-date-range');
    });
});
