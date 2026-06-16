import type { TripEventDocType } from './schema';
import type { TripDocType } from './tripSchema';

export interface JsonbMirrorRow<TDoc> {
    id: string;
    updated_at: number;
    deleted: boolean;
    user_id: string;
    data: Partial<TDoc> | null;
}

export interface SyncPayload {
    id: string;
    updated_at: number;
    deleted: boolean;
    data: Record<string, unknown>;
}

type ReplicatedDoc<TDoc> = TDoc & { _deleted?: boolean };

function rowOwnerId<TDoc extends { owner_id: string }>(row: JsonbMirrorRow<TDoc>): string {
    const dataOwner = row.data?.owner_id;
    return typeof dataOwner === 'string' && dataOwner.length > 0 ? dataOwner : row.user_id;
}

export function unpackTripRow(row: JsonbMirrorRow<TripDocType>): TripDocType & { _deleted: boolean } {
    return {
        ...(row.data ?? {}),
        id: row.id,
        updated_at: row.updated_at,
        is_deleted: row.deleted,
        _deleted: row.deleted,
        owner_id: rowOwnerId(row),
    } as TripDocType & { _deleted: boolean };
}

export function unpackTripEventRow(row: JsonbMirrorRow<TripEventDocType>): TripEventDocType & { _deleted: boolean } {
    return {
        ...(row.data ?? {}),
        id: row.id,
        updated_at: row.updated_at,
        is_deleted: row.deleted,
        _deleted: row.deleted,
        owner_id: rowOwnerId(row),
    } as TripEventDocType & { _deleted: boolean };
}

export function packTripForSync(doc: ReplicatedDoc<TripDocType>): SyncPayload {
    const { id, updated_at, is_deleted, _deleted, ...rest } = doc;
    void _deleted;
    return {
        id,
        updated_at,
        deleted: is_deleted,
        data: rest as Record<string, unknown>,
    };
}

export function packTripEventForSync(doc: ReplicatedDoc<TripEventDocType>): SyncPayload {
    const { id, updated_at, is_deleted, _deleted, ...rest } = doc;
    void _deleted;
    return {
        id,
        updated_at,
        deleted: is_deleted,
        data: rest as Record<string, unknown>,
    };
}
