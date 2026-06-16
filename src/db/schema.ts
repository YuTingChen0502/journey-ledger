export const TRIP_EVENT_SCHEMA = {
    version: 4,
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
        region: {
            type: 'string'
        },
        lat: {
            type: 'number'
        },
        lng: {
            type: 'number'
        },
        place_id: {
            type: 'string'
        },
        category: {
            type: 'string'
        },
        image: {
            type: 'string'
        },
        external_link: {
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
        },
        workspace_type: {
            type: 'string'
        },
        workspace_id: {
            type: 'string'
        },
        memo: {
            type: 'string'
        },
        todos: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    text: { type: 'string' },
                    is_checked: { type: 'boolean' }
                }
            }
        }
    },
    required: ['id', 'trip_id', 'owner_id', 'title', 'sort_order', 'created_at', 'updated_at', 'is_deleted', 'start_time'],
    indexes: [
        ['trip_id', 'start_time'],
        'updated_at'
    ]
} as const;

export type TodoItem = {
    id: string;
    text: string;
    is_checked: boolean;
};

export type TripEventDocType = {
    id: string;
    trip_id: string;
    owner_id: string;
    title: string;
    description?: string;
    location?: string;
    region?: string;
    lat?: number;
    lng?: number;
    place_id?: string;
    category?: string;
    image?: string; // Base64
    external_link?: string;
    is_floating: boolean;
    start_time?: string;
    end_time?: string;
    sort_order: string;
    created_at: number;
    updated_at: number;
    is_deleted: boolean;
    workspace_type?: 'personal' | 'group';
    workspace_id?: string;
    memo?: string;
    todos?: TodoItem[];
};
