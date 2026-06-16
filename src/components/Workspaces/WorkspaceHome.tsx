import { useEffect, useMemo, useState } from 'react'
import { useRxData } from 'rxdb-hooks'
import { LogOut, User, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { GroupDocType } from '@/db/groupSchema'
import {
    getPersonalWorkspace, groupWorkspace, mergeGroupsById,
    type GroupSummary, type Workspace,
} from '@/lib/workspace'
import { CreateGroupModal } from '@/components/Trips/CreateGroupModal'
import { JoinGroupModal } from '@/components/Trips/JoinGroupModal'
import { GroupInviteButton } from '@/components/Trips/GroupInviteButton'
import { fetchVisibleGroups } from '@/services/groups'

interface WorkspaceHomeProps {
    userId: string
    onSelectWorkspace: (workspace: Workspace) => void
    signOut: () => Promise<void>
}

export function WorkspaceHome({ userId, onSelectWorkspace, signOut }: WorkspaceHomeProps) {
    const personal = getPersonalWorkspace(userId)

    // Owned groups (local-first, works offline).
    const { result: ownedGroups, isFetching } = useRxData<GroupDocType>('groups', (collection) =>
        collection.find({
            selector: {
                is_deleted: { $eq: false },
                owner_id: { $eq: userId },
            },
            sort: [{ updated_at: 'desc' }],
        })
    )

    // Joined groups (member but not owner) — resolved online via Supabase, since
    // they're intentionally not pulled into the owner-scoped RxDB collection.
    const [memberGroups, setMemberGroups] = useState<GroupSummary[]>([])
    useEffect(() => {
        let cancelled = false
        fetchVisibleGroups().then((groups) => {
            if (!cancelled) setMemberGroups(groups)
        })
        return () => { cancelled = true }
    }, [userId])

    const groups = useMemo(() => {
        const owned: GroupSummary[] = ownedGroups.map((g) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            owner_id: g.owner_id,
            is_deleted: g.is_deleted,
        }))
        // Local-first owned groups first so they win on dedupe.
        return mergeGroupsById(owned, memberGroups)
    }, [ownedGroups, memberGroups])

    return (
        <div className="h-full w-full overflow-y-auto bg-background">
            <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-serif font-bold text-primary tracking-tight">
                            Journey Ledger
                        </h1>
                        <p className="text-sm text-muted-foreground uppercase tracking-widest">
                            Workspaces
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign Out">
                        <LogOut className="w-4 h-4 text-muted-foreground" />
                    </Button>
                </div>

                {/* Personal */}
                <section className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Personal</h2>
                    <Card
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectWorkspace(personal)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onSelectWorkspace(personal)
                            }
                        }}
                        className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-none bg-white/80 p-6 flex items-center gap-4"
                    >
                        <div className="h-12 w-12 rounded-full bg-[rgba(20,184,166,0.1)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <User className="h-6 w-6 text-[#0f766e]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-serif font-semibold text-foreground">Personal Trips</h3>
                            <p className="text-sm text-muted-foreground">Your own trips, private to your account.</p>
                        </div>
                    </Card>
                </section>

                {/* Groups */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Groups</h2>
                        <div className="flex items-center gap-2">
                            <CreateGroupModal ownerId={userId} onCreated={onSelectWorkspace} />
                            <JoinGroupModal onJoined={onSelectWorkspace} />
                        </div>
                    </div>

                    {isFetching && groups.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Loading groups…</p>
                    ) : groups.length === 0 ? (
                        <Card className="border-dashed border bg-muted/20 p-6 flex flex-col items-center text-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                <Users className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-base font-serif font-semibold text-foreground">No groups yet</h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Create a group and share its invite code, or join one with a code from another member.
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {groups.map((group) => {
                                const isOwner = group.owner_id === userId
                                return (
                                    <Card
                                        key={group.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelectWorkspace(groupWorkspace(group))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                onSelectWorkspace(groupWorkspace(group))
                                            }
                                        }}
                                        className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-none bg-white/80 p-5 flex items-center gap-4"
                                    >
                                        <div className="h-11 w-11 rounded-full bg-[rgba(249,115,22,0.1)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <Users className="h-5 w-5 text-[#c2410c]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-base font-serif font-semibold text-foreground truncate">{group.name}</h3>
                                            {group.description
                                                ? <p className="text-sm text-muted-foreground truncate">{group.description}</p>
                                                : <p className="text-sm text-muted-foreground/70">{isOwner ? 'Owner' : 'Member'}</p>}
                                        </div>
                                        {isOwner && <GroupInviteButton groupId={group.id} ownerId={userId} />}
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
