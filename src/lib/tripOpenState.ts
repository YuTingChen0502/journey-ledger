export type TripOpenState =
    | 'workspace-list'
    | 'trip-ready'
    | 'trip-loading'
    | 'trip-unavailable';

export type TripOpenRenderBranch =
    | 'trip-library'
    | 'trip-ready'
    | 'trip-loading'
    | 'trip-unavailable'
    | 'trip-unknown';

export interface TripOpenStateInput {
    selectedWorkspaceId: string | null | undefined;
    selectedTripId: string | null | undefined;
    hasSelectedTrip: boolean;
    isFetching: boolean;
    groupHydrationPending: boolean;
}

/**
 * Decide which top-level view should render while opening a selected trip.
 * Keeping this pure prevents a missing local group-trip doc from collapsing
 * into an ambiguous blank/loading UI.
 */
export function getTripOpenState({
    selectedWorkspaceId,
    selectedTripId,
    hasSelectedTrip,
    isFetching,
    groupHydrationPending,
}: TripOpenStateInput): TripOpenState {
    if (!selectedWorkspaceId || !selectedTripId) return 'workspace-list';
    if (hasSelectedTrip) return 'trip-ready';
    if (isFetching || groupHydrationPending) return 'trip-loading';
    return 'trip-unavailable';
}

/**
 * Total selected-trip render resolver. If a trip id is selected, callers must
 * render either the workspace or a visible fallback, never an empty shell.
 */
export function getTripOpenRenderBranch(
    selectedTripId: string | null | undefined,
    tripOpenState: TripOpenState | string
): TripOpenRenderBranch {
    if (!selectedTripId) return 'trip-library';
    if (
        tripOpenState === 'trip-ready'
        || tripOpenState === 'trip-loading'
        || tripOpenState === 'trip-unavailable'
    ) {
        return tripOpenState;
    }
    return 'trip-unknown';
}
