import { describe, it, expect } from 'vitest';
import {
    generateInviteCode,
    normalizeInviteCode,
    isValidInviteCodeFormat,
    INVITE_CODE_ALPHABET,
    INVITE_CODE_LENGTH,
} from './inviteCode';

describe('generateInviteCode', () => {
    it('produces a code of the default length from the allowed alphabet', () => {
        const code = generateInviteCode();
        expect(code).toHaveLength(INVITE_CODE_LENGTH);
        for (const ch of code) {
            expect(INVITE_CODE_ALPHABET).toContain(ch);
        }
    });

    it('respects a custom length', () => {
        expect(generateInviteCode(10)).toHaveLength(10);
    });

    it('always passes its own format validation', () => {
        for (let i = 0; i < 50; i++) {
            expect(isValidInviteCodeFormat(generateInviteCode())).toBe(true);
        }
    });

    it('is very unlikely to repeat (sanity uniqueness check)', () => {
        const seen = new Set<string>();
        for (let i = 0; i < 200; i++) seen.add(generateInviteCode());
        expect(seen.size).toBeGreaterThan(195);
    });
});

describe('normalizeInviteCode', () => {
    it('trims, uppercases, and strips separators/spaces', () => {
        expect(normalizeInviteCode('  ab-cd ef ')).toBe('ABCDEF');
    });

    it('drops disallowed characters', () => {
        expect(normalizeInviteCode('a*b@c#1')).toBe('ABC1');
    });

    it('handles empty / nullish input safely', () => {
        expect(normalizeInviteCode('')).toBe('');
        // @ts-expect-error testing defensive nullish handling
        expect(normalizeInviteCode(undefined)).toBe('');
    });
});

describe('isValidInviteCodeFormat', () => {
    it('accepts 6-12 char alphanumeric codes (after normalization)', () => {
        expect(isValidInviteCodeFormat('ABC123')).toBe(true);
        expect(isValidInviteCodeFormat('abc-123')).toBe(true); // normalized -> ABC123
        expect(isValidInviteCodeFormat('ABCDEFGH2345')).toBe(true);
    });

    it('rejects too-short and too-long codes', () => {
        expect(isValidInviteCodeFormat('AB12')).toBe(false);
        expect(isValidInviteCodeFormat('ABCDEFGH23456')).toBe(false);
    });

    it('rejects empty input', () => {
        expect(isValidInviteCodeFormat('')).toBe(false);
    });
});
