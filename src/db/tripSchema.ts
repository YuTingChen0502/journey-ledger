// Trip data model (Phase 1).
//
// Trips are first-class records, stored in their own RxDB collection and mirrored
// to a dedicated Supabase `trips` table (same local-first + JSONB pattern as
// `trip_events`). Trip records are NOT stored inside `trip_events`.

export type Trip = {
    id: string;
    owner_id: string;
    title: string;
    destination?: string;
    start_date: string; // YYYY-MM-DD
    end_date: string;   // YYYY-MM-DD
    timezone?: string;
    description?: string;
    created_at: number;
    updated_at: number;
    is_deleted: boolean;
};

// RxDB document type. Mirrors `Trip` exactly; kept as a separate alias so the
// schema layer and app layer can evolve independently if needed.
export type TripDocType = Trip;

export const TRIP_SCHEMA = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100
        },
        owner_id: {
            type: 'string',
            maxLength: 100
        },
        title: {
            type: 'string'
        },
        destination: {
            type: 'string'
        },
        start_date: {
            type: 'string', // YYYY-MM-DD
            maxLength: 100
        },
        end_date: {
            type: 'string' // YYYY-MM-DD
        },
        timezone: {
            type: 'string'
        },
        description: {
            type: 'string'
        },
        created_at: {
            type: 'number'
        },
        updated_at: {
            type: 'number',
            minimum: 0,
            maximum: 10000000000000,
            multipleOf: 1
        },
        is_deleted: {
            type: 'boolean'
        }
    },
    required: ['id', 'owner_id', 'title', 'start_date', 'end_date', 'created_at', 'updated_at', 'is_deleted'],
    indexes: [
        ['owner_id', 'start_date'],
        'updated_at'
    ]
} as const;
