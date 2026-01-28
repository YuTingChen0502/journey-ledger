import { format, isValid, parseISO } from 'date-fns';

/**
 * Safely formats an ISO date string to "HH:mm" or "PP p".
 * Returns fallback string if invalid.
 */
export const safeFormatTime = (isoString: string | null | undefined, dateFormat: string = 'HH:mm'): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Invalid';
        return format(date, dateFormat);
    } catch (e) {
        return 'Error';
    }
};

/**
 * Safely parses an ISO string, returning null if invalid.
 */
export const safeParseISO = (isoString: string | null | undefined): Date | null => {
    if (!isoString) return null;
    try {
        const date = parseISO(isoString);
        return isValid(date) ? date : null;
    } catch {
        return null;
    }
};
