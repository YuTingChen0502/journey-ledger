// Workspace abstraction (Phase 12A foundation).
//
// A "workspace" is the container above All Trips. Today only the Personal
// workspace is real; Group workspaces are a future phase. Trips carry optional
// `workspace_type` / `workspace_id` metadata; trips written before this phase
// (or without those fields) fall back to the owner's Personal workspace.

export type WorkspaceType = 'personal' | 'group';

export interface Workspace {
    type: WorkspaceType;
    id: string;
    name: string;
}

// Minimal shape needed to classify a trip's workspace (keeps helpers testable
// without constructing a full TripDocType).
export interface WorkspaceTaggable {
    workspace_type?: WorkspaceType;
    workspace_id?: string;
}

export const PERSONAL_PREFIX = 'personal:';

/** The Personal workspace for a given user. */
export function getPersonalWorkspace(userId: string): Workspace {
    return {
        type: 'personal',
        id: `${PERSONAL_PREFIX}${userId}`,
        name: 'Personal',
    };
}

/** A group workspace built from a group record. */
export function groupWorkspace(group: { id: string; name: string }): Workspace {
    return {
        type: 'group',
        id: group.id,
        name: group.name,
    };
}

/** Whether a workspace id refers to a personal workspace. */
export function isPersonalWorkspaceId(id: string): boolean {
    return id.startsWith(PERSONAL_PREFIX);
}

/**
 * Whether a user OWNS a group. (An owner is always a member.) Useful on the
 * client where we only have the group record, not the membership table — e.g.
 * to gate owner-only actions like generating an invite code.
 */
export function isGroupOwner(
    group: { owner_id: string; is_deleted?: boolean },
    userId: string
): boolean {
    return !group.is_deleted && group.owner_id === userId;
}

/**
 * Whether a user is a member of a group.
 *
 * NOTE: real membership (Phase 12C) lives in the `group_members` table and is
 * resolved server-side (the join RPC + member-aware RLS). With only a group
 * record on hand we can confirm ownership, which always implies membership.
 * Kept for the cases where ownership is the relevant question.
 */
export function isGroupMember(
    group: { owner_id: string; is_deleted?: boolean },
    userId: string
): boolean {
    return isGroupOwner(group, userId);
}

/** Minimal group shape for listing/merging in WorkspaceHome. */
export interface GroupSummary {
    id: string;
    name: string;
    description?: string;
    owner_id: string;
    is_deleted?: boolean;
}

/**
 * Merge several group lists into one visible list (Phase 12C). Used to combine
 * the user's own groups (local-first, RxDB) with groups they've joined
 * (resolved online via Supabase). Soft-deleted groups are dropped; duplicates
 * are deduped by id, keeping the first occurrence (so the local-first copy
 * wins). Order is preserved from the input order.
 */
export function mergeGroupsById(...lists: GroupSummary[][]): GroupSummary[] {
    const seen = new Set<string>();
    const out: GroupSummary[] = [];
    for (const list of lists) {
        for (const group of list) {
            if (group.is_deleted) continue;
            if (seen.has(group.id)) continue;
            seen.add(group.id);
            out.push(group);
        }
    }
    return out;
}

/**
 * The workspace a trip belongs to. Backward-compatible: a trip missing
 * `workspace_type`/`workspace_id` (or explicitly `personal`) is treated as the
 * current user's Personal workspace.
 */
export function getTripWorkspace(trip: WorkspaceTaggable, userId: string): Workspace {
    if (trip.workspace_type === 'group' && trip.workspace_id) {
        // Group name is not known from the trip alone in 12A; resolved later.
        return { type: 'group', id: trip.workspace_id, name: 'Group' };
    }
    return getPersonalWorkspace(userId);
}

/** Whether a trip belongs to the given workspace (with personal fallback). */
export function isTripInWorkspace(
    trip: WorkspaceTaggable,
    workspace: Workspace,
    userId: string
): boolean {
    return getTripWorkspace(trip, userId).id === workspace.id;
}
