import type { RxCollection } from 'rxdb';
import type { TripEventDocType } from './schema';
import type { TripDocType } from './tripSchema';
import {
    unpackTripEventRow,
    unpackTripRow,
    type JsonbMirrorRow,
} from './supabaseRows';
import { supabase } from '@/services/supabase';
import type { Workspace } from '@/lib/workspace';
import { shouldHydrateRow } from '@/lib/groupSync';

const PAGE_SIZE = 1000;
const EVENT_TRIP_ID_CHUNK = 100;

export interface HydrationResult {
    trips: number;
    events: number;
}

function stripRxDeleted<TDoc extends { _deleted?: boolean }>(doc: TDoc): Omit<TDoc, '_deleted'> {
    const { _deleted, ...rest } = doc;
    void _deleted;
    return rest;
}

// NOTE: deleted rows are intentionally INCLUDED. Hydration is a snapshot
// reconcile, so it must be able to propagate soft-deletes (deleted=true) into
// the local store, not only add visible rows.
async function fetchGroupTrips(groupId: string): Promise<JsonbMirrorRow<TripDocType>[]> {
    const out: JsonbMirrorRow<TripDocType>[] = [];
    let from = 0;

    for (;;) {
        const { data, error } = await supabase
            .from('trips')
            .select('id, updated_at, deleted, user_id, data')
            .eq('data->>workspace_type', 'group')
            .eq('data->>workspace_id', groupId)
            .order('updated_at', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const rows = (data ?? []) as unknown as JsonbMirrorRow<TripDocType>[];
        out.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return out;
}

async function fetchEventsForTrips(tripIds: string[]): Promise<JsonbMirrorRow<TripEventDocType>[]> {
    const out: JsonbMirrorRow<TripEventDocType>[] = [];

    for (let i = 0; i < tripIds.length; i += EVENT_TRIP_ID_CHUNK) {
        const chunk = tripIds.slice(i, i + EVENT_TRIP_ID_CHUNK);
        let from = 0;

        for (;;) {
            const { data, error } = await supabase
                .from('trip_events')
                .select('id, updated_at, deleted, user_id, data')
                .in('data->>trip_id', chunk)
                .order('updated_at', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);

            if (error) throw error;

            const rows = (data ?? []) as unknown as JsonbMirrorRow<TripEventDocType>[];
            out.push(...rows);
            if (rows.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }
    }

    return out;
}

/**
 * Backfill the local RxDB store with the Supabase-authorized dataset for a group
 * workspace (Phase 12D.2). This complements the incremental replication pull,
 * whose single global `updated_at` checkpoint can be ahead of a group's older
 * rows (so they would otherwise never arrive). Properties:
 *   - RLS-scoped (only rows the caller may see), filtered to this group.
 *   - Delete-aware: soft-deleted rows are reconciled too (not just additions).
 *   - Last-write-wins: a row is written locally only when it is newer than the
 *     local copy, so an unpushed local offline edit is never clobbered.
 *   - Idempotent and safe to run repeatedly (on entry, on reconnect, on retry).
 */
export async function hydrateGroupWorkspaceContent(
    workspace: Workspace,
    tripsCollection: RxCollection<TripDocType>,
    eventsCollection: RxCollection<TripEventDocType>
): Promise<HydrationResult> {
    if (workspace.type !== 'group') return { trips: 0, events: 0 };

    // --- Trips ---------------------------------------------------------------
    const tripRows = await fetchGroupTrips(workspace.id);
    const tripDocs = tripRows.map((row) => stripRxDeleted(unpackTripRow(row)) as TripDocType);
    const allTripIds = tripDocs.map((trip) => trip.id);

    const existingTrips = allTripIds.length
        ? await tripsCollection.findByIds(allTripIds).exec()
        : new Map<string, { updated_at: number }>();

    const tripsToUpsert = tripDocs.filter((trip) =>
        shouldHydrateRow(existingTrips.get(trip.id)?.updated_at, trip.updated_at)
    );
    if (tripsToUpsert.length) {
        await tripsCollection.bulkUpsert(tripsToUpsert);
    }

    // --- Events (for every group trip, including soft-deleted ones) ----------
    const eventRows = await fetchEventsForTrips(allTripIds);
    const eventDocs = eventRows.map((row) => {
        const event = stripRxDeleted(unpackTripEventRow(row)) as TripEventDocType;
        // Backfill the workspace tag from the parent trip if the event lacks it
        // (legacy events written before event-level workspace metadata).
        if (!event.workspace_type || !event.workspace_id) {
            const parentTrip = tripDocs.find((trip) => trip.id === event.trip_id);
            if (parentTrip?.workspace_type === 'group' && parentTrip.workspace_id) {
                event.workspace_type = 'group';
                event.workspace_id = parentTrip.workspace_id;
            }
        }
        return event;
    });

    const eventIds = eventDocs.map((e) => e.id);
    const existingEvents = eventIds.length
        ? await eventsCollection.findByIds(eventIds).exec()
        : new Map<string, { updated_at: number }>();

    const eventsToUpsert = eventDocs.filter((event) =>
        shouldHydrateRow(existingEvents.get(event.id)?.updated_at, event.updated_at)
    );
    if (eventsToUpsert.length) {
        await eventsCollection.bulkUpsert(eventsToUpsert);
    }

    return { trips: tripsToUpsert.length, events: eventsToUpsert.length };
}
