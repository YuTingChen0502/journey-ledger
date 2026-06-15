import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import { buildTripDays, isValidTripDateRange, MAX_TRIP_DAYS } from './dateRange';

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

describe('buildTripDays', () => {
    it('returns a single day for a 1-day trip (start === end)', () => {
        const days = buildTripDays('2026-01-31', '2026-01-31');
        expect(days).toHaveLength(1);
        expect(ymd(days[0])).toBe('2026-01-31');
    });

    it('returns the inclusive range for a multi-day trip', () => {
        const days = buildTripDays('2026-01-31', '2026-02-07'); // legacy Nagoya range
        expect(days).toHaveLength(8);
        expect(ymd(days[0])).toBe('2026-01-31');
        expect(ymd(days[7])).toBe('2026-02-07');
    });

    it('collapses an inverted range (end before start) to a single start day', () => {
        const days = buildTripDays('2026-02-07', '2026-01-31');
        expect(days).toHaveLength(1);
        expect(ymd(days[0])).toBe('2026-02-07');
    });

    it('falls back to a single day for an invalid start date', () => {
        const days = buildTripDays('not-a-date', 'also-bad');
        expect(days).toHaveLength(1);
    });

    it('collapses to start day when only the end date is invalid', () => {
        const days = buildTripDays('2026-03-01', 'garbage');
        expect(days).toHaveLength(1);
        expect(ymd(days[0])).toBe('2026-03-01');
    });

    it('caps very long ranges at MAX_TRIP_DAYS', () => {
        const days = buildTripDays('2026-01-01', '2030-01-01');
        expect(days).toHaveLength(MAX_TRIP_DAYS);
    });

    it('produces consecutive days', () => {
        const days = buildTripDays('2026-06-01', '2026-06-03');
        expect(days.map(ymd)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    });
});

describe('isValidTripDateRange', () => {
    it('allows a same-day range', () => {
        expect(isValidTripDateRange('2026-06-01', '2026-06-01')).toBe(true);
    });
    it('allows an increasing range', () => {
        expect(isValidTripDateRange('2026-06-01', '2026-06-10')).toBe(true);
    });
    it('blocks an inverted range', () => {
        expect(isValidTripDateRange('2026-06-10', '2026-06-01')).toBe(false);
    });
    it('blocks invalid/empty dates', () => {
        expect(isValidTripDateRange('', '')).toBe(false);
        expect(isValidTripDateRange('2026-06-01', 'garbage')).toBe(false);
        expect(isValidTripDateRange('garbage', '2026-06-01')).toBe(false);
    });
});
