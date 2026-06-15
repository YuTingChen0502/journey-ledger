import type { RxCollection } from 'rxdb';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { supabase } from '../services/supabase';
import type { TripEventDocType } from './schema';
import type { TripDocType } from './tripSchema';
import { Subject } from 'rxjs';

const REPLICATION_SIZE = 100;

export type ReplicationState = {
    error: Subject<any>;
    active: Subject<boolean>;
    received: Subject<number>;
    sent: Subject<number>;
    reSync: () => void;
}

export const startReplication = async (collection: RxCollection<TripEventDocType>) => {
    // 1. Authenticate / Get Session
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;

    if (!userId) {
        console.warn("Replication skipped: No User ID");
        return null;
    }

    console.log("Starting Supabase Replication for User:", userId);

    const replicationState = await replicateRxCollection({
        collection,
        replicationIdentifier: 'supabase-jsonb-trip-events-v1', // Bumped version for new strategy
        pull: {
            handler: async (checkpoint: any, batchSize: number) => {
                const updatedAt = checkpoint ? checkpoint.updated_at : 0;

                // PULL: Fetch rows where updated_at > checkpoint
                const { data, error } = await supabase
                    .from('trip_events')
                    .select('id, updated_at, deleted, data')
                    .gt('updated_at', updatedAt)
                    .order('updated_at', { ascending: true })
                    .limit(batchSize);

                if (error) {
                    console.error('Supabase Pull Error:', error);
                    throw error;
                }

                const documents = data.map((row: any) => {
                    // UNPACK: Merge row metadata with JSONB data
                    // row.data contains title, description, lat, lng, etc.
                    // We must override id, updated_at, is_deleted from the SQL columns to be sure.
                    const unpacked = {
                        ...row.data, // content
                        id: row.id,
                        updated_at: row.updated_at,
                        is_deleted: row.deleted,
                        owner_id: userId // Ensure ownership is consistent locally
                    };
                    return unpacked;
                });

                return {
                    documents: documents,
                    checkpoint: data.length > 0
                        ? { updated_at: data[data.length - 1].updated_at }
                        : checkpoint
                };
            }
        },
        push: {
            handler: async (docs) => {
                const rows = docs.map(d => {
                    const doc = d.newDocumentState;

                    // PACK: Separate Metadata from Content
                    const { id, updated_at, is_deleted, ...rest } = doc;

                    // 'rest' contains all the fields we want in JSONB (title, location, images...)
                    // 'id', 'updated_at', 'is_deleted' go to their own columns.

                    return {
                        id: id,
                        updated_at: updated_at,
                        deleted: is_deleted,
                        user_id: userId, // Enforce User ID from session
                        data: rest // PACK EVERYTHING ELSE INTO JSONB
                    };
                });

                const { error } = await supabase
                    .from('trip_events')
                    .upsert(rows);

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

interface TripSupabaseRow {
    id: string;
    updated_at: number;
    deleted: boolean;
    data: Partial<TripDocType>;
}

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
        replicationIdentifier: 'supabase-jsonb-trips-v1',
        pull: {
            handler: async (checkpoint, batchSize) => {
                const updatedAt = checkpoint ? checkpoint.updated_at : 0;

                const { data, error } = await supabase
                    .from('trips')
                    .select('id, updated_at, deleted, data')
                    .gt('updated_at', updatedAt)
                    .order('updated_at', { ascending: true })
                    .limit(batchSize);

                if (error) {
                    console.error('Supabase Trips Pull Error:', error);
                    throw error;
                }

                const rows = (data ?? []) as unknown as TripSupabaseRow[];

                // RxDB's replication protocol uses `_deleted` as its deletion
                // marker; we also keep `is_deleted` as a queryable field, mirroring
                // the events pattern.
                const documents = rows.map((row) => ({
                    ...row.data,
                    id: row.id,
                    updated_at: row.updated_at,
                    is_deleted: row.deleted,
                    _deleted: row.deleted,
                    owner_id: userId // Ensure ownership is consistent locally
                })) as (TripDocType & { _deleted: boolean })[];

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

                    // PACK: metadata into columns, everything else into JSONB.
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
                    .from('trips')
                    .upsert(rows);

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
