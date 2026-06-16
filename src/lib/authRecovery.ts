export const PASSWORD_RESET_PATH = '/reset-password';
export const MIN_RESET_PASSWORD_LENGTH = 8;

export type ResetPasswordValidation =
    | { ok: true }
    | { ok: false; message: string };

export function getPasswordResetRedirectUrl(origin: string): string {
    return `${origin.trim().replace(/\/+$/, '')}${PASSWORD_RESET_PATH}`;
}

export function isValidEmailAddress(email: string): boolean {
    const trimmed = email.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function validateResetPassword(password: string, confirmPassword: string): ResetPasswordValidation {
    if (!password) {
        return { ok: false, message: 'Enter a new password.' };
    }
    if (password.length < MIN_RESET_PASSWORD_LENGTH) {
        return { ok: false, message: `Password must be at least ${MIN_RESET_PASSWORD_LENGTH} characters.` };
    }
    if (password !== confirmPassword) {
        return { ok: false, message: 'Passwords do not match.' };
    }
    return { ok: true };
}

// --- Reset-email error classification (Phase 12D.1) -------------------------
//
// Supabase's built-in email provider has a very low send limit; repeated signup
// confirmation or password-recovery requests can return an "email rate limit
// exceeded" error (HTTP 429). We surface a friendly message instead of the raw
// provider string. We do
// NOT attempt to bypass the limit in any way — see docs/DEPLOYMENT.md (configure
// Custom SMTP + Auth rate limits in the Supabase Dashboard to raise capacity).

export interface SupabaseLikeError {
    message?: string;
    status?: number | string;
    code?: string;
}

export const RATE_LIMIT_EMAIL_MESSAGE =
    'Too many emails were requested. Please wait about an hour and try again.';

// Backward-compatible alias for older phase notes/tests.
export const RATE_LIMIT_RESET_MESSAGE = RATE_LIMIT_EMAIL_MESSAGE;

/** Whether a Supabase auth error represents an email/send rate limit (incl. 429). */
export function isRateLimitError(error: SupabaseLikeError | null | undefined): boolean {
    if (!error) return false;
    if (Number(error.status) === 429) return true;
    const text = `${error.message ?? ''} ${error.code ?? ''}`.toLowerCase();
    return text.includes('email rate limit') || text.includes('rate limit') || text.includes('rate_limit');
}

/** Map a reset-email error to a friendly, user-facing message. */
export function describeResetEmailError(error: SupabaseLikeError | null | undefined): string {
    if (isRateLimitError(error)) {
        return RATE_LIMIT_EMAIL_MESSAGE;
    }
    const message = (error?.message ?? '').toLowerCase();
    if (message.includes('network') || message.includes('failed to fetch')) {
        return 'Could not send a reset email. Check your connection and try again.';
    }
    return error?.message || 'Could not send a reset email. Please try again.';
}

/** Map signup errors, especially confirmation-email rate limits, to user copy. */
export function describeSignUpError(error: SupabaseLikeError | null | undefined): string {
    if (isRateLimitError(error)) {
        return RATE_LIMIT_EMAIL_MESSAGE;
    }
    return error?.message || 'Could not create your account. Please try again.';
}
