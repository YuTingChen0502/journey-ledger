export type WorkspaceViewMode = 'dashboard' | 'overview' | 'planning';
export type WorkspacePlanningView = 'timeline' | 'table';

export type WorkspaceContentBranch =
    | 'dashboard'
    | 'overview'
    | 'planning:timeline'
    | 'planning:table'
    | 'unknown';

/**
 * Runtime-normalize workspace modes. The UI has used user-facing names such as
 * Home/Journal/Plan while the component logic uses dashboard/overview/planning;
 * accepting both prevents a mounted shell with no matching content branch.
 */
export function normalizeWorkspaceMode(mode: string): WorkspaceViewMode | null {
    if (mode === 'dashboard' || mode === 'home') return 'dashboard';
    if (mode === 'overview' || mode === 'journal') return 'overview';
    if (mode === 'planning' || mode === 'plan') return 'planning';
    return null;
}

export function getWorkspaceContentBranch(
    mode: string,
    planningView: WorkspacePlanningView
): WorkspaceContentBranch {
    const normalizedMode = normalizeWorkspaceMode(mode);
    if (normalizedMode === 'dashboard') return 'dashboard';
    if (normalizedMode === 'overview') return 'overview';
    if (normalizedMode === 'planning') {
        return planningView === 'table' ? 'planning:table' : 'planning:timeline';
    }
    return 'unknown';
}
