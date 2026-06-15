// Trip collection helpers (Phase 1).

import type { RxCollection } from 'rxdb';
import type { TripDocType } from './tripSchema';

export const LEGACY_TRIP_ID = 'nagoya-2026';

// Create/upsert the legacy "Nagoya 2026" trip so existing events that point to
// `trip_id = 'nagoya-2026'` are not orphaned.
//
// Phase 11: this is NO LONGER called automatically on login — new users must
// not be auto-seeded with Nagoya. It is retained for manual/dev migration only
// (existing users keep their Nagoya trip via Supabase replication). If the trip
// already exists locally it is left untouched.
export async function ensureLegacyTrip(
    trips: RxCollection<TripDocType>,
    ownerId: string
): Promise<void> {
    const existing = await trips.findOne(LEGACY_TRIP_ID).exec();
    if (existing) return;

    const now = Date.now();
    const legacyTrip: TripDocType = {
        id: LEGACY_TRIP_ID,
        owner_id: ownerId,
        title: 'Nagoya 2026',
        destination: 'Nagoya, Japan',
        start_date: '2026-01-31',
        end_date: '2026-02-07',
        timezone: 'Asia/Tokyo',
        description: '',
        created_at: now,
        updated_at: now,
        is_deleted: false
    };

    await trips.upsert(legacyTrip);
}
