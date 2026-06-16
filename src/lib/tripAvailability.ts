import type { TripDocType } from '@/db/tripSchema';
import { isValidTripDateRange } from './dateRange';

export type TripAvailabilityIssue =
    | 'missing-trip'
    | 'missing-id'
    | 'missing-title'
    | 'invalid-date-range';

/**
 * Runtime guard for trip rows before mounting the workspace. Group hydration is
 * RLS-scoped and local-first, but historical/corrupt rows can still be missing
 * fields that TypeScript marks as required. Return an issue instead of letting
 * date parsing crash the whole app.
 */
export function getTripAvailabilityIssue(
    trip: Partial<TripDocType> | null | undefined
): TripAvailabilityIssue | null {
    if (!trip) return 'missing-trip';
    if (typeof trip.id !== 'string' || trip.id.length === 0) return 'missing-id';
    if (typeof trip.title !== 'string' || trip.title.trim().length === 0) return 'missing-title';
    if (!isValidTripDateRange(trip.start_date, trip.end_date)) return 'invalid-date-range';
    return null;
}
