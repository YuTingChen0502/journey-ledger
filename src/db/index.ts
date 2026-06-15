import { createRxDatabase, addRxPlugin, removeRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { TRIP_EVENT_SCHEMA } from './schema';
import { TRIP_SCHEMA } from './tripSchema';

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

if (import.meta.env.DEV) {
    addRxPlugin(RxDBDevModePlugin);
}

// Define storage once to ensure reference equality
const storage = getRxStorageDexie();

// Singleton Pattern:
// Use a global variable attached to window to ensure singleton behavior
// even if this module is bundled into multiple chunks or re-evaluated.
const GLOBAL_DB_KEY = '__NAGOYA26_RXDB_PROMISE__';
let dbPromise: Promise<any> | null = (window as any)[GLOBAL_DB_KEY] || null;

export const initDB = async () => {
    // 1. Strict Check: If promise exists (running or resolved), return it immediately.
    if (dbPromise) return dbPromise;

    // 2. Assign Promise IMMEDIATELY to prevent race conditions.
    dbPromise = (async () => {
        let finalStorage = storage;

        if (import.meta.env.DEV) {
            finalStorage = wrappedValidateAjvStorage({
                storage
            }) as any;
        }

        try {
            console.log('RxDB: Initializing Database...');
            const db = await createRxDatabase({
                name: 'tripdb',
                storage: finalStorage,
                ignoreDuplicate: false // STRICT MODE: Do not allow duplicates. Rely on singleton.
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
                },
                trips: {
                    schema: TRIP_SCHEMA
                }
            });

            // Initialize replication in the background
            import('./replication').then(async (module) => {
                try {
                    const replicationState = await module.startReplication(db.tripevents);
                    (db as any).replicationState = replicationState;
                    console.log('Replication started');
                } catch (err) {
                    console.error('Failed to start replication:', err);
                }

                // Trips replication (Phase 1). Independent of events so a missing
                // `trips` Supabase table cannot break event sync.
                try {
                    await module.startTripsReplication(db.trips);
                    console.log('Trips replication started');
                } catch (err) {
                    console.error('Failed to start trips replication:', err);
                }
            });

            console.log('RxDB initialized');
            return db;
        } catch (err: any) {
            console.error('RxDB Init Exception:', err);
            // If initialization fails, clear the promise so we can retry?
            // Or maybe keep it failed to prevent loop?
            // For now, let's allow retry if it completely throws before returning.
            // But usually validation errors are fatal.
            throw err;
        }
    })();

    // Persist to window for HMR/singleton safety
    (window as any)[GLOBAL_DB_KEY] = dbPromise;

    return dbPromise;
};

// Emergency Reset Function
// Execute `window.resetAppDB()` in console to nuke everything.
(window as any).resetAppDB = async () => {
    console.warn('!!! RESETTING DATABASE !!!');
    try {
        await removeRxDatabase('tripdb', storage);
        console.log('Database removed. Reloading...');
        window.location.reload();
    } catch (e) {
        console.error('Reset failed:', e);
    }
};
