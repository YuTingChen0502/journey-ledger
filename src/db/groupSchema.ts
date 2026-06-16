// Group data model (Phase 12B — local group shell).
//
// Groups are first-class records, stored in their own RxDB collection and
// mirrored to a dedicated Supabase `groups` table (same local-first + JSONB
// pattern as `trips` / `trip_events`). In this phase a group is effectively
// owned by its creator (owner-scoped only). Real shared membership / invite
// codes / group RLS are a later phase — NOT implemented here.

export type Group = {
    id: string;
    name: string;
    description?: string;
    created_by: string;
    owner_id: string;
    created_at: number;
    updated_at: number;
    is_deleted: boolean;
};

export type GroupDocType = Group;

export const GROUP_SCHEMA = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100
        },
        name: {
            type: 'string'
        },
        description: {
            type: 'string'
        },
        created_by: {
            type: 'string'
        },
        owner_id: {
            type: 'string',
            maxLength: 100
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
    required: ['id', 'name', 'created_by', 'owner_id', 'created_at', 'updated_at', 'is_deleted'],
    indexes: [
        ['owner_id', 'updated_at'],
        'updated_at'
    ]
} as const;
