// Group workspace convergence helpers (Phase 12D.2).
//
// Group trips/events share the same RxDB collections as personal content and a
// single global `updated_at` replication checkpoint. That checkpoint can be
// AHEAD of a group's pre-existing rows (e.g. a member who joins while already
// logged in), so those rows are delivered by `hydrateGroupWorkspaceContent`
// (a direct, RLS-scoped backfill) rather than by the incremental pull.
//
// Conflict / convergence policy = LAST-WRITE-WINS by `updated_at`:
//   * The server sync RPCs apply an incoming write iff its `updated_at` is >=
//     the stored row's (ties → the writer that reaches the server last).
//   * Hydration must mirror this so it never clobbers a locally-newer, not-yet-
//     pushed offline edit with an older server snapshot. It applies a fetched
//     row only when there is no local copy or the fetched row is strictly newer.

/**
 * Whether a server row fetched during hydration should overwrite the local copy.
 * Apply when there is no local copy, or the server row is strictly newer than
 * the local one (so an unpushed local offline edit, which has a newer
 * `updated_at`, is preserved and allowed to push later).
 */
export function shouldHydrateRow(
    localUpdatedAt: number | undefined,
    incomingUpdatedAt: number
): boolean {
    if (localUpdatedAt === undefined || localUpdatedAt === null) return true;
    return incomingUpdatedAt > localUpdatedAt;
}
