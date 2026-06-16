// Group membership / invite service (Phase 12C).
//
// Membership and invite codes are AUTH/SECURITY data, not local-first journal
// content, so they intentionally bypass RxDB and talk to Supabase directly:
//   * Joined groups (member but not owner) can't be pulled into RxDB without an
//     ownership push-back conflict, so they're fetched online here.
//   * Invite codes are owner-managed rows guarded by RLS.
//   * Joining is done through a SECURITY DEFINER RPC.
// See supabase/migrations/20260617_group_members_invites.sql.

import { supabase } from './supabase';
import type { GroupSummary } from '../lib/workspace';
import { generateInviteCode } from '../lib/inviteCode';

interface GroupRow {
    id: string;
    deleted: boolean;
    data: { name?: string; description?: string; owner_id?: string };
}

function rowToSummary(row: GroupRow): GroupSummary {
    return {
        id: row.id,
        name: row.data?.name ?? 'Group',
        description: row.data?.description,
        owner_id: row.data?.owner_id ?? '',
        is_deleted: row.deleted,
    };
}

/**
 * All non-deleted groups visible to the current user (owner OR active member),
 * via the widened `groups` SELECT RLS policy. Returns [] on error/offline so
 * the caller can still fall back to the local-first owned-groups list.
 */
export async function fetchVisibleGroups(): Promise<GroupSummary[]> {
    const { data, error } = await supabase
        .from('groups')
        .select('id, deleted, data')
        .eq('deleted', false);

    if (error) {
        console.warn('fetchVisibleGroups failed (offline or groups table missing?):', error.message);
        return [];
    }
    return (data as GroupRow[]).map(rowToSummary);
}

/** Fetch a single visible group by id (used after a successful join). */
export async function fetchGroupById(groupId: string): Promise<GroupSummary | null> {
    const { data, error } = await supabase
        .from('groups')
        .select('id, deleted, data')
        .eq('id', groupId)
        .maybeSingle();

    if (error || !data) return null;
    return rowToSummary(data as GroupRow);
}

/**
 * Owner-only: return an existing active invite code for the group, or create
 * one (client-generated, inserted under owner RLS). Retries once on the rare
 * unique-code collision.
 */
export async function getOrCreateInviteCode(groupId: string, ownerId: string): Promise<string> {
    const { data: existing, error: selErr } = await supabase
        .from('group_invites')
        .select('code')
        .eq('group_id', groupId)
        .eq('revoked', false)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!selErr && existing && existing.length > 0) {
        return (existing[0] as { code: string }).code;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        const code = generateInviteCode();
        const { error: insErr } = await supabase
            .from('group_invites')
            .insert({ group_id: groupId, code, created_by: ownerId });
        if (!insErr) return code;
        // 23505 = unique_violation -> regenerate and retry once.
        if ((insErr as { code?: string }).code !== '23505') {
            throw insErr;
        }
    }
    throw new Error('Could not generate a unique invite code, please try again.');
}

export type JoinGroupErrorReason =
    | 'invalid'
    | 'expired'
    | 'revoked'
    | 'not_authenticated'
    | 'network';

export class JoinGroupError extends Error {
    reason: JoinGroupErrorReason;
    constructor(reason: JoinGroupErrorReason, message: string) {
        super(message);
        this.reason = reason;
        this.name = 'JoinGroupError';
    }
}

function mapJoinError(rawMessage: string): JoinGroupError {
    const msg = rawMessage || '';
    if (msg.includes('INVALID_CODE')) return new JoinGroupError('invalid', 'That invite code is not valid.');
    if (msg.includes('EXPIRED_CODE')) return new JoinGroupError('expired', 'That invite code has expired.');
    if (msg.includes('REVOKED_CODE')) return new JoinGroupError('revoked', 'That invite code has been revoked.');
    if (msg.includes('NOT_AUTHENTICATED')) return new JoinGroupError('not_authenticated', 'Please sign in again.');
    return new JoinGroupError('network', 'Could not join the group. Check your connection and try again.');
}

/**
 * Redeem an invite code via the SECURITY DEFINER RPC. On success returns the
 * joined group's summary (so the caller can open its workspace). Throws a
 * {@link JoinGroupError} with a friendly reason on failure.
 */
export async function joinGroupByInviteCode(code: string): Promise<GroupSummary> {
    const { data, error } = await supabase.rpc('join_group_by_invite_code', { invite_code: code });
    if (error) throw mapJoinError(error.message);

    const groupId = data as string | null;
    if (!groupId) throw new JoinGroupError('invalid', 'That invite code is not valid.');

    const group = await fetchGroupById(groupId);
    if (!group) {
        // Joined, but the group row isn't readable yet (replication lag / RLS).
        return { id: groupId, name: 'Group', owner_id: '' };
    }
    return group;
}
