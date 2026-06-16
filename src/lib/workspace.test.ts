import { describe, it, expect } from 'vitest';
import {
    getPersonalWorkspace,
    getTripWorkspace,
    isTripInWorkspace,
} from './workspace';

const USER = 'user-123';

describe('getPersonalWorkspace', () => {
    it('builds a personal workspace id from the user id', () => {
        const ws = getPersonalWorkspace(USER);
        expect(ws).toEqual({ type: 'personal', id: 'personal:user-123', name: 'Personal' });
    });
});

describe('getTripWorkspace (fallback)', () => {
    it('treats a trip with no workspace fields as the user Personal workspace', () => {
        const ws = getTripWorkspace({}, USER);
        expect(ws.id).toBe('personal:user-123');
        expect(ws.type).toBe('personal');
    });

    it('treats an explicitly personal trip as Personal', () => {
        const ws = getTripWorkspace({ workspace_type: 'personal', workspace_id: 'personal:user-123' }, USER);
        expect(ws.id).toBe('personal:user-123');
    });

    it('returns the group workspace id for a group trip', () => {
        const ws = getTripWorkspace({ workspace_type: 'group', workspace_id: 'group:abc' }, USER);
        expect(ws.type).toBe('group');
        expect(ws.id).toBe('group:abc');
    });

    it('falls back to Personal when workspace_type is group but workspace_id is missing', () => {
        const ws = getTripWorkspace({ workspace_type: 'group' }, USER);
        expect(ws.id).toBe('personal:user-123');
    });
});

describe('isTripInWorkspace', () => {
    const personal = getPersonalWorkspace(USER);

    it('matches a legacy (untagged) trip to Personal', () => {
        expect(isTripInWorkspace({}, personal, USER)).toBe(true);
    });

    it('matches an explicitly-personal trip to Personal', () => {
        expect(isTripInWorkspace({ workspace_type: 'personal', workspace_id: 'personal:user-123' }, personal, USER)).toBe(true);
    });

    it('does NOT match a group trip to the Personal workspace (no leak)', () => {
        expect(isTripInWorkspace({ workspace_type: 'group', workspace_id: 'group:abc' }, personal, USER)).toBe(false);
    });

    it('matches a group trip to its own group workspace', () => {
        const group = { type: 'group' as const, id: 'group:abc', name: 'Group' };
        expect(isTripInWorkspace({ workspace_type: 'group', workspace_id: 'group:abc' }, group, USER)).toBe(true);
    });
});
