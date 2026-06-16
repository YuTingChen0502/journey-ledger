// Invite-code helpers (Phase 12C).
//
// Codes are generated on the owner's client and stored in `group_invites`
// (owner-only RLS). Redeemed through the `join_group_by_invite_code` RPC.
// Pure / side-effect-free so they are unit-testable.

// Crockford-ish alphabet: no 0/O/1/I/L to avoid ambiguity when typed by hand.
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_FORMAT = /^[A-Z0-9]{6,12}$/;

/** Random integer in [0, max) using crypto when available, else Math.random. */
function randomInt(max: number): number {
    const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
    if (cryptoObj?.getRandomValues) {
        const buf = new Uint32Array(1);
        cryptoObj.getRandomValues(buf);
        return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
}

/** Generate a new invite code (uppercase, unambiguous alphabet). */
export function generateInviteCode(length: number = INVITE_CODE_LENGTH): string {
    let out = '';
    for (let i = 0; i < length; i++) {
        out += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
    }
    return out;
}

/** Normalize user input: trim, uppercase, strip anything but A-Z/0-9. */
export function normalizeInviteCode(raw: string): string {
    return (raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Whether a (normalized) code is structurally plausible before hitting the API. */
export function isValidInviteCodeFormat(code: string): boolean {
    return INVITE_CODE_FORMAT.test(normalizeInviteCode(code));
}
