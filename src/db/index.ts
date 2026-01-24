import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { TRIP_EVENT_SCHEMA } from './schema';

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

if (import.meta.env.DEV) {
    addRxPlugin(RxDBDevModePlugin);
}

let dbPromise: Promise<any> | null = null;

import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

// ... imports

export const initDB = async () => {
    if (dbPromise) return dbPromise;

    dbPromise = (async () => {
        let storage = getRxStorageDexie();

        if (import.meta.env.DEV) {
            storage = wrappedValidateAjvStorage({
                storage
            }) as any;
        }

        const db = await createRxDatabase({
            name: 'tripdb',
            storage,
            ignoreDuplicate: true
        });

        await db.addCollections({
            tripevents: {
                schema: TRIP_EVENT_SCHEMA
            }
        });

        // Initialize replication
        // Initialize replication in the background
        import('./replication').then(async (module) => {
            try {
                const replicationState = await module.startReplication(db.tripevents);
                (db as any).replicationState = replicationState;
                console.log('Replication started');
            } catch (err) {
                console.error('Failed to start replication:', err);
            }
        });

        console.log('RxDB initialized');
        return db;
    })();

    return dbPromise;
};
