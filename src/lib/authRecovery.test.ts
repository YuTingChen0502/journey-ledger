import { describe, expect, it } from 'vitest';
import {
    MIN_RESET_PASSWORD_LENGTH,
    RATE_LIMIT_EMAIL_MESSAGE,
    RATE_LIMIT_RESET_MESSAGE,
    describeResetEmailError,
    describeSignUpError,
    getPasswordResetRedirectUrl,
    isRateLimitError,
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

describe('isRateLimitError', () => {
    it('detects an HTTP 429 status', () => {
        expect(isRateLimitError({ status: 429 })).toBe(true);
        expect(isRateLimitError({ status: '429' })).toBe(true);
    });

    it('detects the built-in provider "email rate limit exceeded" message', () => {
        expect(isRateLimitError({ message: 'Email rate limit exceeded' })).toBe(true);
    });

    it('detects an over_email_send_rate_limit code', () => {
        expect(isRateLimitError({ code: 'over_email_send_rate_limit' })).toBe(true);
    });

    it('is false for unrelated errors and nullish input', () => {
        expect(isRateLimitError({ message: 'Invalid email' })).toBe(false);
        expect(isRateLimitError(null)).toBe(false);
        expect(isRateLimitError(undefined)).toBe(false);
    });
});

describe('describeResetEmailError', () => {
    it('returns the friendly wait-an-hour message for rate-limit errors', () => {
        expect(RATE_LIMIT_RESET_MESSAGE).toBe(RATE_LIMIT_EMAIL_MESSAGE);
        expect(describeResetEmailError({ status: 429 })).toBe(RATE_LIMIT_EMAIL_MESSAGE);
        expect(describeResetEmailError({ message: 'email rate limit exceeded' })).toBe(RATE_LIMIT_EMAIL_MESSAGE);
    });

    it('returns a connection hint for network errors', () => {
        expect(describeResetEmailError({ message: 'Failed to fetch' })).toMatch(/connection/i);
    });

    it('passes through other provider messages, with a generic fallback', () => {
        expect(describeResetEmailError({ message: 'User not found' })).toBe('User not found');
        expect(describeResetEmailError({})).toMatch(/could not send a reset email/i);
        expect(describeResetEmailError(null)).toMatch(/could not send a reset email/i);
    });
});

describe('describeSignUpError', () => {
    it('returns the shared email rate-limit message for signup email limits', () => {
        expect(describeSignUpError({ message: 'email rate limit exceeded' })).toBe(RATE_LIMIT_EMAIL_MESSAGE);
        expect(describeSignUpError({ code: 'over_email_send_rate_limit' })).toBe(RATE_LIMIT_EMAIL_MESSAGE);
    });

    it('passes through non-rate-limit signup errors, with a generic fallback', () => {
        expect(describeSignUpError({ message: 'Password should be at least 6 characters' })).toBe(
            'Password should be at least 6 characters'
        );
        expect(describeSignUpError(null)).toMatch(/could not create your account/i);
    });
});
