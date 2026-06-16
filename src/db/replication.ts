import type { RxCollection } from 'rxdb';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { supabase } from '../services/supabase';
import type { TripEventDocType } from './schema';
import type { TripDocType } from './tripSchema';
import type { GroupDocType } from './groupSchema';
import {
    packTripEventForSync,
    packTripForSync,
    unpackTripEventRow,
    unpackTripRow,
    type JsonbMirrorRow,
} from './supabaseRows';
import { Subject } from 'rxjs';

const REPLICATION_SIZE = 100;

export type ReplicationState = {
    error: Subject<unknown>;
    active: Subject<boolean>;
    received: Subject<number>;
    sent: Subject<number>;
    reSync: () => void;
}

type TripEventCheckpoint = { updated_at: number };

export const startReplication = async (collection: RxCollection<TripEventDocType>) => {
    // 1. Authenticate / Get Session
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;

    if (!userId) {
        console.warn("Replication skipped: No User ID");
        return null;
    }

    console.log("Starting Supabase Replication for User:", userId);

    const replicationState = await replicateRxCollection<TripEventDocType, TripEventCheckpoint>({
        collection,
        replicationIdentifier: 'supabase-jsonb-trip-events-v2',
        pull: {
            handler: async (checkpoint, batchSize) => {
                const updatedAt = checkpoint ? checkpoint.updated_at : 0;

                // PULL: Fetch rows where updated_at > checkpoint
                const { data, error } = await supabase
                    .from('trip_events')
                    .select('id, updated_at, deleted, user_id, data')
                    .gt('updated_at', updatedAt)
                    .order('updated_at', { ascending: true })
                    .limit(batchSize);

                if (error) {
                    console.error('Supabase Pull Error:', error);
                    throw error;
                }

                const rows = (data ?? []) as unknown as JsonbMirrorRow<TripEventDocType>[];
                const documents = rows.map(unpackTripEventRow);

                return {
                    documents: documents,
                    checkpoint: rows.length > 0
                        ? { updated_at: rows[rows.length - 1].updated_at }
                        : (checkpoint ?? { updated_at: 0 })
                };
            }
        },
        push: {
            handler: async (docs) => {
                const rows = docs.map((d) => packTripEventForSync(d.newDocumentState));

                const { error } = await supabase.rpc('sync_trip_event_documents', {
                    documents: rows,
                });

                if (error) {
                    console.error('Supabase Push Error:', error);
                    throw error;
                }

                // Return explicitly empty array to indicate success for all docs
                return [];
            },
            batchSize: REPLICATION_SIZE,
            modifier: (doc) => doc // Send as-is
        },
        live: true,
        waitForLeadership: false, // Replicate in all tabs
        autoStart: true
    });

    // Realtime Subscription
    supabase
        .channel('trip_events_db_changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'trip_events' },
            () => {
                // console.log('Realtime Change Detected');
                replicationState.reSync();
            }
        )
        .subscribe();

    // Attach listener cancellation if needed, though replicationState handles most lifecycle

    return replicationState;
};

// ---------------------------------------------------------------------------
// Trips replication (Phase 1)
//
// Mirrors the exact same local-first + Supabase JSONB pattern used for events,
// but targets the dedicated `trips` table. Kept as a separate, fully-typed
// function so the existing events replication path is left untouched.
// ---------------------------------------------------------------------------

type TripCheckpoint = { updated_at: number };

export const startTripsReplication = async (collection: RxCollection<TripDocType>) => {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;

    if (!userId) {
        console.warn('Trips replication skipped: No User ID');
        return null;
    }

    console.log('Starting Supabase Trips Replication for User:', userId);

    const replicationState = await replicateRxCollection<TripDocType, TripCheckpoint>({
        collection,
        replicationIdentifier: 'supabase-jsonb-trips-v2',
        pull: {
            handler: async (checkpoint, batchSize) => {
                const updatedAt = checkpoint ? checkpoint.updated_at : 0;

                const { data, error } = await supabase
                    .from('trips')
                    .select('id, updated_at, deleted, user_id, data')
                    .gt('updated_at', updatedAt)
                    .order('updated_at', { ascending: true })
                    .limit(batchSize);

                if (error) {
                    console.error('Supabase Trips Pull Error:', error);
                    throw error;
                }

                const rows = (data ?? []) as unknown as JsonbMirrorRow<TripDocType>[];

                // RxDB's replication protocol uses `_deleted` as its deletion
                // marker; we also keep `is_deleted` as a queryable field, mirroring
                // the events pattern.
                const documents = rows.map(unpackTripRow);

                return {
                    documents,
                    checkpoint: rows.length > 0
                        ? { updated_at: rows[rows.length - 1].updated_at }
                        : (checkpoint ?? { updated_at: 0 })
                };
            }
        },
        push: {
            handler: async (docs) => {
                const rows = docs.map((d) => packTripForSync(d.newDocumentState));

                const { error } = await supabase.rpc('sync_trip_documents', {
                    documents: rows,
                });

                if (error) {
                    console.error('Supabase Trips Push Error:', error);
                    throw error;
                }

                return [];
            },
            batchSize: REPLICATION_SIZE,
            modifier: (doc) => doc
        },
        live: true,
        waitForLeadership: false,
        autoStart: true
    });

    // Realtime Subscription
    supabase
        .channel('trips_db_changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'trips' },
            () => {
                replicationState.reSync();
            }
        )
        .subscribe();

    return replicationState;
};

// ---------------------------------------------------------------------------
// Groups replication (Phase 12B)
//
// Same local-first + Supabase JSONB pattern as trips, targeting the dedicated
// `groups` table. Owner-scoped only (no real sharing yet). Independent of the
// trips/events channels so a missing `groups` table cannot break them.
// ---------------------------------------------------------------------------

type GroupCheckpoint = { updated_at: number };

interface GroupSupabaseRow {
    id: string;
    updated_at: number;
    deleted: boolean;
    data: Partial<GroupDocType>;
}

export const startGroupsReplication = async (collection: RxCollection<GroupDocType>) => {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;

    if (!userId) {
        console.warn('Groups replication skipped: No User ID');
        return null;
    }

    console.log('Starting Supabase Groups Replication for User:', userId);

    const replicationState = await replicateRxCollection<GroupDocType, GroupCheckpoint>({
        collection,
        replicationIdentifier: 'supabase-jsonb-groups-v1',
        pull: {
            handler: async (checkpoint, batchSize) => {
                const updatedAt = checkpoint ? checkpoint.updated_at : 0;

                // Phase 12C: the `groups` SELECT RLS is widened to "owner OR
                // active member", so we MUST filter to own rows explicitly here.
                // Otherwise this owner-scoped local-first channel would pull
                // joined groups too, overwrite their owner_id locally, and risk
                // a push-back ownership conflict. Joined (member) groups are read
                // online instead — see src/services/groups.ts.
                const { data, error } = await supabase
                    .from('groups')
                    .select('id, updated_at, deleted, data')
                    .eq('user_id', userId)
                    .gt('updated_at', updatedAt)
                    .order('updated_at', { ascending: true })
                    .limit(batchSize);

                if (error) {
                    console.error('Supabase Groups Pull Error:', error);
                    throw error;
                }

                const rows = (data ?? []) as unknown as GroupSupabaseRow[];

                const documents = rows.map((row) => ({
                    ...row.data,
                    id: row.id,
                    updated_at: row.updated_at,
                    is_deleted: row.deleted,
                    _deleted: row.deleted,
                    owner_id: userId // Ensure ownership is consistent locally
                })) as (GroupDocType & { _deleted: boolean })[];

                return {
                    documents,
                    checkpoint: rows.length > 0
                        ? { updated_at: rows[rows.length - 1].updated_at }
                        : (checkpoint ?? { updated_at: 0 })
                };
            }
        },
        push: {
            handler: async (docs) => {
                const rows = docs.map((d) => {
                    const doc = d.newDocumentState;
                    const { id, updated_at, is_deleted, ...rest } = doc;

                    return {
                        id,
                        updated_at,
                        deleted: is_deleted,
                        user_id: userId, // Enforce User ID from session
                        data: rest
                    };
                });

                const { error } = await supabase
                    .from('groups')
                    .upsert(rows);

                if (error) {
                    console.error('Supabase Groups Push Error:', error);
                    throw error;
                }

                return [];
            },
            batchSize: REPLICATION_SIZE,
            modifier: (doc) => doc
        },
        live: true,
        waitForLeadership: false,
        autoStart: true
    });

    // Realtime Subscription
    supabase
        .channel('groups_db_changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'groups' },
            () => {
                replicationState.reSync();
            }
        )
        .subscribe();

    return replicationState;
};
