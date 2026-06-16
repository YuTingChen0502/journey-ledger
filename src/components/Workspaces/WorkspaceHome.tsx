import { LogOut, User, Users, Plus, LogIn } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getPersonalWorkspace, type Workspace } from '@/lib/workspace'

interface WorkspaceHomeProps {
    userId: string
    onSelectWorkspace: (workspace: Workspace) => void
    signOut: () => Promise<void>
}

export function WorkspaceHome({ userId, onSelectWorkspace, signOut }: WorkspaceHomeProps) {
    const personal = getPersonalWorkspace(userId)

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

                {/* Groups (coming soon — not functional in this phase) */}
                <section className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Groups</h2>
                    <Card className="border-dashed border bg-muted/20 p-6 flex flex-col items-center text-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-serif font-semibold text-foreground">Group workspaces are coming soon</h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                                Share trips and plan together with others. This is not available yet.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <Button variant="outline" size="sm" className="gap-2" disabled>
                                <Plus className="w-4 h-4" /> Create Group
                            </Button>
                            <Button variant="outline" size="sm" className="gap-2" disabled>
                                <LogIn className="w-4 h-4" /> Join Group
                            </Button>
                        </div>
                    </Card>
                </section>
            </div>
        </div>
    )
}
