import { describe, it, expect } from 'vitest';
import { shouldHydrateRow } from './groupSync';

describe('shouldHydrateRow (Phase 12D.2 last-write-wins backfill)', () => {
    it('applies a fetched row when there is no local copy', () => {
        expect(shouldHydrateRow(undefined, 1000)).toBe(true);
    });

    it('applies a strictly-newer server row over an older local copy', () => {
        expect(shouldHydrateRow(1000, 2000)).toBe(true);
    });

    it('does NOT clobber a locally-newer (unpushed offline) edit', () => {
        // Local offline edit bumped updated_at to 2000; server still has 1000.
        expect(shouldHydrateRow(2000, 1000)).toBe(false);
    });

    it('skips an equal-timestamp row (already in sync — avoids redundant push)', () => {
        expect(shouldHydrateRow(1500, 1500)).toBe(false);
    });

    it('treats a null local timestamp as missing', () => {
        expect(shouldHydrateRow(null as unknown as undefined, 1)).toBe(true);
    });
});
