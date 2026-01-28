import { describe, it, expect } from 'vitest';
import { safeFormatTime } from './dateUtils';

describe('safeFormatTime', () => {
    it('formats valid ISO dates correctly', () => {
        const iso = '2026-02-01T14:30:00.000Z'; // UTC
        // Note: Output depends on local time zone of the runner. 
        // We check if it returns a string and contains logical time formatting
        const result = safeFormatTime(iso, 'HH:mm');
        expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('returns empty string for null/undefined', () => {
        expect(safeFormatTime(null)).toBe('');
        expect(safeFormatTime(undefined)).toBe('');
    });

    it('returns "Invalid" for garbage strings', () => {
        expect(safeFormatTime('garbage-date')).toBe('Invalid');
    });

    it('uses custom format string', () => {
        const iso = '2026-02-01T14:30:00.000Z';
        // 'PP' usually format like 'Feb 1, 2026'
        const result = safeFormatTime(iso, 'yyyy');
        expect(result).toBe('2026'); // Validating year is safe
    });
});
