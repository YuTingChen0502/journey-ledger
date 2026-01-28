import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { TRIP_EVENT_SCHEMA } from './schema';

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

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
                schema: TRIP_EVENT_SCHEMA,
                migrationStrategies: {
                    // 1: from v0 to v1.
                    // Initialize new optional fields to null to avoid undefined issues in UI
                    1: function (oldDoc: any) {
                        oldDoc.lat = oldDoc.lat || null;
                        oldDoc.lng = oldDoc.lng || null;
                        return oldDoc;
                    },
                    2: function (oldDoc: any) {
                        oldDoc.region = oldDoc.region || '';
                        return oldDoc;
                    },
                    3: function (oldDoc: any) {
                        oldDoc.todos = [];
                        oldDoc.memo = '';
                        return oldDoc;
                    }
                }
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
