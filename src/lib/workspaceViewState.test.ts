import { describe, expect, it } from 'vitest';
import { getWorkspaceContentBranch, normalizeWorkspaceMode } from './workspaceViewState';

describe('normalizeWorkspaceMode', () => {
    it('accepts canonical workspace modes', () => {
        expect(normalizeWorkspaceMode('dashboard')).toBe('dashboard');
        expect(normalizeWorkspaceMode('overview')).toBe('overview');
        expect(normalizeWorkspaceMode('planning')).toBe('planning');
    });

    it('accepts legacy or label-like aliases', () => {
        expect(normalizeWorkspaceMode('home')).toBe('dashboard');
        expect(normalizeWorkspaceMode('journal')).toBe('overview');
        expect(normalizeWorkspaceMode('plan')).toBe('planning');
    });

    it('flags unknown modes instead of silently matching content', () => {
        expect(normalizeWorkspaceMode('bogus')).toBeNull();
    });
});

describe('getWorkspaceContentBranch', () => {
    it('maps dashboard/home to the dashboard branch', () => {
        expect(getWorkspaceContentBranch('dashboard', 'timeline')).toBe('dashboard');
        expect(getWorkspaceContentBranch('home', 'timeline')).toBe('dashboard');
    });

    it('maps overview/journal to the journal overview branch', () => {
        expect(getWorkspaceContentBranch('overview', 'timeline')).toBe('overview');
        expect(getWorkspaceContentBranch('journal', 'timeline')).toBe('overview');
    });

    it('maps planning aliases to the selected planning sub-branch', () => {
        expect(getWorkspaceContentBranch('planning', 'timeline')).toBe('planning:timeline');
        expect(getWorkspaceContentBranch('plan', 'table')).toBe('planning:table');
    });

    it('uses a visible unknown branch for unsupported runtime modes', () => {
        expect(getWorkspaceContentBranch('missing', 'timeline')).toBe('unknown');
    });
});
