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
