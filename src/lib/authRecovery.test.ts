import { describe, expect, it } from 'vitest';
import {
    MIN_RESET_PASSWORD_LENGTH,
    getPasswordResetRedirectUrl,
    isValidEmailAddress,
    validateResetPassword,
} from './authRecovery';

describe('getPasswordResetRedirectUrl', () => {
    it('appends the reset password path to an origin', () => {
        expect(getPasswordResetRedirectUrl('https://journey.example')).toBe('https://journey.example/reset-password');
    });

    it('removes a trailing slash from the origin', () => {
        expect(getPasswordResetRedirectUrl('http://localhost:5173/')).toBe('http://localhost:5173/reset-password');
    });
});

describe('isValidEmailAddress', () => {
    it('accepts ordinary email addresses', () => {
        expect(isValidEmailAddress('traveler@example.com')).toBe(true);
        expect(isValidEmailAddress(' traveler@example.com ')).toBe(true);
    });

    it('rejects missing or malformed addresses', () => {
        expect(isValidEmailAddress('')).toBe(false);
        expect(isValidEmailAddress('traveler')).toBe(false);
        expect(isValidEmailAddress('traveler@example')).toBe(false);
    });
});

describe('validateResetPassword', () => {
    it('accepts matching passwords at the minimum length', () => {
        const password = 'a'.repeat(MIN_RESET_PASSWORD_LENGTH);
        expect(validateResetPassword(password, password)).toEqual({ ok: true });
    });

    it('requires a password', () => {
        expect(validateResetPassword('', '')).toEqual({ ok: false, message: 'Enter a new password.' });
    });

    it('requires a reasonable minimum length', () => {
        expect(validateResetPassword('short', 'short')).toEqual({
            ok: false,
            message: `Password must be at least ${MIN_RESET_PASSWORD_LENGTH} characters.`,
        });
    });

    it('requires confirmation to match', () => {
        expect(validateResetPassword('long-enough', 'different')).toEqual({
            ok: false,
            message: 'Passwords do not match.',
        });
    });
});
