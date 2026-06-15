import { addDays, differenceInDays, isValid, parseISO } from 'date-fns';

// Maximum number of days a single trip view will render. Guards against absurd
// or corrupted ranges blowing up the timeline/journal.
export const MAX_TRIP_DAYS = 60;

/**
 * Build the inclusive list of day-Dates for a trip from its start/end date
 * strings (YYYY-MM-DD). Defensive against invalid or inverted ranges:
 *   - invalid start  -> a single day (today)
 *   - invalid/earlier end -> collapses to the start day
 *   - capped at MAX_TRIP_DAYS
 * Always returns at least one day.
 */
export function buildTripDays(startStr: string, endStr: string): Date[] {
    const start = parseISO(startStr);
    if (!isValid(start)) return [new Date()];
    const end = parseISO(endStr);
    const safeEnd = isValid(end) && end >= start ? end : start;
    const count = Math.min(differenceInDays(safeEnd, start) + 1, MAX_TRIP_DAYS);
    return Array.from({ length: Math.max(count, 1) }, (_, i) => addDays(start, i));
}

/**
 * Whether a trip's start/end date strings (YYYY-MM-DD) form a valid range:
 * both parseable AND end on or after start (same-day is allowed). Used to block
 * inverted/invalid ranges in the create/edit trip forms.
 */
export function isValidTripDateRange(startStr: string, endStr: string): boolean {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    if (!isValid(start) || !isValid(end)) return false;
    return end >= start;
}
