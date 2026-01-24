import type { RxCollection } from 'rxdb';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { supabase } from '../services/supabase';
import type { TripEventDocType } from './schema';
import { Subject } from 'rxjs';

const REPLICATION_SIZE = 100;

export type ReplicationState = {
    error: Subject<any>;
    active: Subject<boolean>;
    received: Subject<number>;
    sent: Subject<number>;
}

export const startReplication = async (collection: RxCollection<TripEventDocType>) => {
    const replicationState = await replicateRxCollection({
        collection,
        replicationIdentifier: 'supabase-trip-events-replication',
        pull: {
            handler: async (checkpoint: any, batchSize: number) => {
                const updatedAt = checkpoint ? checkpoint.updated_at : 0;

                const { data, error } = await supabase
                    .from('trip_events')
                    .select('*')
                    .gt('updated_at', updatedAt)
                    .order('updated_at', { ascending: true })
                    .limit(batchSize);

                if (error) {
                    console.error('Supabase Pull Error:', error);
                    throw error;
                }

                return {
                    documents: data || [],
                    checkpoint: data && data.length > 0
                        ? { updated_at: data[data.length - 1].updated_at }
                        : checkpoint
                };
            }
        },
        push: {
            handler: async (docs) => {
                const rows = docs.map(d => d.newDocumentState);

                const { error } = await supabase
                    .from('trip_events')
                    .upsert(rows);

                if (error) {
                    console.error('Supabase Push Error:', error);
                    throw error;
                }

                // Return explicitly empty array to indicate success for all docs
                // RxDB types might update, but generally returning [] means no conflicts/errors handled individually
                return [];
            },
            batchSize: REPLICATION_SIZE,
            modifier: (doc) => doc // Send as-is
        },
        live: true,
        waitForLeadership: false, // Replicate in all tabs
    });

    // Realtime Subscription
    supabase
        .channel('trip_events_db_changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'trip_events' },
            () => replicationState.reSync()
        )
        .subscribe();

    return replicationState;
};
