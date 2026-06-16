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
