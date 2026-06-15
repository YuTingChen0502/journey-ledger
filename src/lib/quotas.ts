// Frontend quota limits (MVP).
//
// IMPORTANT: these are a UX guard only, NOT a security boundary. They prevent
// accidental runaway local growth and give users clear feedback, but they are
// enforced purely client-side. Backend/RLS-level quota enforcement is future
// work (see CLAUDE.md "recommended next small phases").

export const QUOTAS = {
    maxTripsPerUser: 10,
    maxEventsPerTrip: 500,
    maxChecklistItemsPerEvent: 50,
    maxMemoLength: 5000,
} as const;

/** Whether another trip can be created given the current non-deleted trip count. */
export function canCreateTrip(currentTripCount: number): boolean {
    return currentTripCount < QUOTAS.maxTripsPerUser;
}

/**
 * Whether `incomingEventCount` new events can be added to a trip that already
 * has `currentEventCount` non-deleted events without exceeding the per-trip cap.
 * Used for both single-event creation (incoming = 1) and batch import.
 */
export function canAddEvents(currentEventCount: number, incomingEventCount: number): boolean {
    if (incomingEventCount <= 0) return true;
    return currentEventCount + incomingEventCount <= QUOTAS.maxEventsPerTrip;
}

/** Whether another checklist item can be added to an event. */
export function canAddChecklistItem(currentChecklistCount: number): boolean {
    return currentChecklistCount < QUOTAS.maxChecklistItemsPerEvent;
}

/** Whether a memo string is within the allowed length. */
export function isMemoWithinLimit(memo: string): boolean {
    return memo.length <= QUOTAS.maxMemoLength;
}

/** Remaining event slots for a trip (never negative). */
export function getRemainingEventCapacity(currentEventCount: number): number {
    return Math.max(0, QUOTAS.maxEventsPerTrip - currentEventCount);
}
