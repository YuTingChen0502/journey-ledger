import { describe, expect, it } from 'vitest';
import type { TripEventDocType } from './schema';
import type { TripDocType } from './tripSchema';
import {
    packTripEventForSync,
    packTripForSync,
    unpackTripEventRow,
    unpackTripRow,
    type JsonbMirrorRow,
} from './supabaseRows';

describe('Supabase JSONB row mapping', () => {
    it('preserves the JSON owner_id from a pulled shared trip row', () => {
        const row: JsonbMirrorRow<TripDocType> = {
            id: 'trip-1',
            updated_at: 10,
            deleted: false,
            user_id: 'account-a',
            data: {
                owner_id: 'account-a',
                title: 'Shared',
                start_date: '2027-01-01',
                end_date: '2027-01-02',
                created_at: 1,
                updated_at: 10,
                is_deleted: false,
                workspace_type: 'group',
                workspace_id: 'group-1',
            },
        };

        expect(unpackTripRow(row).owner_id).toBe('account-a');
    });

    it('falls back to top-level user_id when legacy JSON owner_id is absent', () => {
        const row: JsonbMirrorRow<TripEventDocType> = {
            id: 'event-1',
            updated_at: 20,
            deleted: false,
            user_id: 'account-a',
            data: {
                trip_id: 'trip-1',
                title: 'Legacy event',
                is_floating: true,
                start_time: '',
                sort_order: 'n',
                created_at: 1,
                updated_at: 20,
                is_deleted: false,
            },
        };

        expect(unpackTripEventRow(row).owner_id).toBe('account-a');
    });

    it('packs trips without top-level ownership metadata', () => {
        const payload = packTripForSync({
            id: 'trip-1',
            owner_id: 'account-a',
            title: 'Trip',
            start_date: '2027-01-01',
            end_date: '2027-01-02',
            created_at: 1,
            updated_at: 10,
            is_deleted: false,
            _deleted: false,
        });

        expect(payload).toMatchObject({ id: 'trip-1', updated_at: 10, deleted: false });
        expect(payload).not.toHaveProperty('user_id');
        expect(payload.data).toMatchObject({ owner_id: 'account-a', title: 'Trip' });
        expect(payload.data).not.toHaveProperty('_deleted');
    });

    it('packs events without mutating owner_id or trip_id client-side', () => {
        const payload = packTripEventForSync({
            id: 'event-1',
            trip_id: 'trip-1',
            owner_id: 'account-a',
            title: 'Event',
            is_floating: true,
            start_time: '',
            sort_order: 'n',
            created_at: 1,
            updated_at: 10,
            is_deleted: false,
            workspace_type: 'group',
            workspace_id: 'group-1',
        });

        expect(payload).not.toHaveProperty('user_id');
        expect(payload.data).toMatchObject({
            trip_id: 'trip-1',
            owner_id: 'account-a',
            workspace_type: 'group',
            workspace_id: 'group-1',
        });
    });
});
