export const TRIP_EVENT_SCHEMA = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100
        },
        trip_id: {
            type: 'string',
            maxLength: 100
        },
        owner_id: {
            type: 'string'
        },
        title: {
            type: 'string'
        },
        description: {
            type: 'string'
        },
        location: {
            type: 'string'
        },
        is_floating: {
            type: 'boolean'
        },
        start_time: {
            type: 'string', // ISO8601
            maxLength: 100
        },
        end_time: {
            type: 'string', // ISO8601
        },
        sort_order: {
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
    required: ['id', 'trip_id', 'owner_id', 'title', 'sort_order', 'created_at', 'updated_at', 'is_deleted', 'start_time'],
    indexes: [
        ['trip_id', 'start_time'],
        'updated_at'
    ]
} as const;

export type TripEventDocType = {
    id: string;
    trip_id: string;
    owner_id: string;
    title: string;
    description?: string;
    location?: string;
    is_floating: boolean;
    start_time?: string;
    end_time?: string;
    sort_order: string;
    created_at: number;
    updated_at: number;
    is_deleted: boolean;
};
