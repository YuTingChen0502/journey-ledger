import { createRxDatabase, addRxPlugin, removeRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { TRIP_EVENT_SCHEMA } from './schema';
import { TRIP_SCHEMA } from './tripSchema';
import { GROUP_SCHEMA } from './groupSchema';

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

if (import.meta.env.DEV) {
    addRxPlugin(RxDBDevModePlugin);
}

// Define storage once to ensure reference equality
const storage = getRxStorageDexie();

function getAppStorage() {
    if (import.meta.env.DEV) {
        return wrappedValidateAjvStorage({
            storage
        }) as typeof storage;
    }
    return storage;
}

// Singleton Pattern:
// Use a global variable attached to window to ensure singleton behavior
// even if this module is bundled into multiple chunks or re-evaluated.
const GLOBAL_DB_KEY = '__NAGOYA26_RXDB_PROMISE__' as const;
type AppWindow = Window & {
    [GLOBAL_DB_KEY]?: Promise<RxDatabase>;
    resetAppDB?: () => Promise<void>;
};
const appWindow = window as AppWindow;
let dbPromise: Promise<RxDatabase> | null = appWindow[GLOBAL_DB_KEY] || null;

export const initDB = async () => {
    // 1. Strict Check: If promise exists (running or resolved), return it immediately.
    if (dbPromise) return dbPromise;

    // 2. Assign Promise IMMEDIATELY to prevent race conditions.
    dbPromise = (async () => {
        const finalStorage = getAppStorage();

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
                        1: function (oldDoc: Record<string, unknown>) {
                            oldDoc.lat = oldDoc.lat || null;
                            oldDoc.lng = oldDoc.lng || null;
                            return oldDoc;
                        },
                        2: function (oldDoc: Record<string, unknown>) {
                            oldDoc.region = oldDoc.region || '';
                            return oldDoc;
                        },
                        3: function (oldDoc: Record<string, unknown>) {
                            oldDoc.todos = [];
                            oldDoc.memo = '';
                            return oldDoc;
                        },
                        4: function (oldDoc: Record<string, unknown>) {
                            // Phase 12D adds optional event workspace metadata.
                            // Legacy events remain valid without it; server-side
                            // policies infer sharing from the parent trip.
                            return oldDoc;
                        }
                    }
                },
                trips: {
                    schema: TRIP_SCHEMA,
                    migrationStrategies: {
                        // 1: Phase 12A — add optional workspace_type/workspace_id.
                        // Existing trips keep no workspace fields and are treated
                        // as the owner's Personal workspace via fallback helpers.
                        1: function (oldDoc: Record<string, unknown>) {
                            return oldDoc;
                        }
                    }
                },
                groups: {
                    schema: GROUP_SCHEMA
                }
            });

            // Initialize replication in the background
            import('./replication').then(async (module) => {
                try {
                    const replicationState = await module.startReplication(db.tripevents);
                    (db as RxDatabase & { replicationState?: unknown }).replicationState = replicationState;
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

                // Groups replication (Phase 12B). Independent of trips/events so a
                // missing `groups` Supabase table cannot break them.
                try {
                    await module.startGroupsReplication(db.groups);
                    console.log('Groups replication started');
                } catch (err) {
                    console.error('Failed to start groups replication:', err);
                }
            });

            console.log('RxDB initialized');
            return db;
        } catch (err: unknown) {
            console.error('RxDB Init Exception:', err);
            dbPromise = null;
            delete appWindow[GLOBAL_DB_KEY];
            // If initialization fails, clear the promise so we can retry?
            // Or maybe keep it failed to prevent loop?
            // For now, let's allow retry if it completely throws before returning.
            // But usually validation errors are fatal.
            throw err;
        }
    })();

    // Persist to window for HMR/singleton safety
    appWindow[GLOBAL_DB_KEY] = dbPromise;

    return dbPromise;
};

export async function resetAppDB({ reload = true }: { reload?: boolean } = {}): Promise<void> {
    console.warn('!!! RESETTING JOURNEY LEDGER LOCAL DATABASE !!!');

    const existingPromise = dbPromise || appWindow[GLOBAL_DB_KEY] || null;
    dbPromise = null;
    delete appWindow[GLOBAL_DB_KEY];

    if (existingPromise) {
        try {
            const existingDb = await existingPromise;
            await existingDb.close();
        } catch (err) {
            console.warn('Reset warning: could not close existing RxDB instance', err);
        }
    }

    await removeRxDatabase('tripdb', getAppStorage());
    console.log('Database removed.');

    if (reload) {
        window.location.reload();
    }
}

// Emergency Reset Function
// Execute `window.resetAppDB()` in console to nuke everything.
appWindow.resetAppDB = async () => {
    try {
        await resetAppDB({ reload: true });
    } catch (e) {
        console.error('Reset failed:', e);
    }
};
