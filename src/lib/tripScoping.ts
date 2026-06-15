import type { MangoQuerySelector } from 'rxdb';
import type { TripEventDocType } from '@/db/schema';

/**
 * Canonical RxDB selector for the events belonging to a single trip: scoped by
 * `trip_id` and excluding soft-deleted rows. Centralizing this guarantees every
 * core view (Journal / Timeline / Table) applies identical trip scoping, which
 * is the core Phase 4 cross-trip isolation invariant.
 */
export function tripEventsSelector(tripId: string): MangoQuerySelector<TripEventDocType> {
    return {
        trip_id: { $eq: tripId },
        is_deleted: { $eq: false },
    };
}
