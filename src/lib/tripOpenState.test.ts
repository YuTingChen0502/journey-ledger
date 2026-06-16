import { describe, expect, it } from 'vitest';
import { getTripOpenRenderBranch, getTripOpenState } from './tripOpenState';

describe('getTripOpenState', () => {
    it('shows the workspace/list flow when no workspace or trip is selected', () => {
        expect(getTripOpenState({
            selectedWorkspaceId: null,
            selectedTripId: 'trip-1',
            hasSelectedTrip: false,
            isFetching: false,
            groupHydrationPending: false,
        })).toBe('workspace-list');

        expect(getTripOpenState({
            selectedWorkspaceId: 'group-1',
            selectedTripId: null,
            hasSelectedTrip: false,
            isFetching: false,
            groupHydrationPending: false,
        })).toBe('workspace-list');
    });

    it('opens the workspace as soon as the selected local trip is available', () => {
        expect(getTripOpenState({
            selectedWorkspaceId: 'group-1',
            selectedTripId: 'trip-1',
            hasSelectedTrip: true,
            isFetching: true,
            groupHydrationPending: true,
        })).toBe('trip-ready');
    });

    it('keeps a visible loading state while RxDB or group hydration is pending', () => {
        expect(getTripOpenState({
            selectedWorkspaceId: 'group-1',
            selectedTripId: 'trip-1',
            hasSelectedTrip: false,
            isFetching: true,
            groupHydrationPending: false,
        })).toBe('trip-loading');

        expect(getTripOpenState({
            selectedWorkspaceId: 'group-1',
            selectedTripId: 'trip-1',
            hasSelectedTrip: false,
            isFetching: false,
            groupHydrationPending: true,
        })).toBe('trip-loading');
    });

    it('shows a visible unavailable state for a stale or deleted selection', () => {
        expect(getTripOpenState({
            selectedWorkspaceId: 'group-1',
            selectedTripId: 'trip-1',
            hasSelectedTrip: false,
            isFetching: false,
            groupHydrationPending: false,
        })).toBe('trip-unavailable');
    });
});

describe('getTripOpenRenderBranch', () => {
    it('renders the trip library when no trip id is selected', () => {
        expect(getTripOpenRenderBranch(null, 'trip-ready')).toBe('trip-library');
    });

    it('renders the ready workspace branch when the selected local trip is available', () => {
        expect(getTripOpenRenderBranch('trip-1', 'trip-ready')).toBe('trip-ready');
    });

    it('renders visible fallback branches for loading and unavailable selected trips', () => {
        expect(getTripOpenRenderBranch('trip-1', 'trip-loading')).toBe('trip-loading');
        expect(getTripOpenRenderBranch('trip-1', 'trip-unavailable')).toBe('trip-unavailable');
    });

    it('never falls through silently for an inconsistent selected-trip state', () => {
        expect(getTripOpenRenderBranch('trip-1', 'workspace-list')).toBe('trip-unknown');
        expect(getTripOpenRenderBranch('trip-1', 'unexpected-state')).toBe('trip-unknown');
    });
});
