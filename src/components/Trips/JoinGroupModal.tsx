import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { groupWorkspace, type Workspace } from '@/lib/workspace'
import { isValidInviteCodeFormat, normalizeInviteCode } from '@/lib/inviteCode'
import { joinGroupByInviteCode, JoinGroupError } from '@/services/groups'

interface JoinGroupModalProps {
    onJoined: (workspace: Workspace) => void
}

export function JoinGroupModal({ onJoined }: JoinGroupModalProps) {
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState('')
    const [isJoining, setIsJoining] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleJoin = async () => {
        if (isJoining) return
        const normalized = normalizeInviteCode(code)
        if (!isValidInviteCodeFormat(normalized)) {
            setError('Enter a valid invite code.')
            return
        }
        setError(null)
        setIsJoining(true)
        try {
            const group = await joinGroupByInviteCode(normalized)
            toast.success(`Joined ${group.name}`)
            setCode('')
            setOpen(false)
            onJoined(groupWorkspace({ id: group.id, name: group.name }))
        } catch (err) {
            const message = err instanceof JoinGroupError
                ? err.message
                : 'Could not join the group. Please try again.'
            setError(message)
            toast.error(message)
        } finally {
            setIsJoining(false)
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next)
                if (!next) { setError(null); setCode('') }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                    <LogIn className="w-4 h-4" /> Join Group
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Join a group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="invite-code" className="text-sm font-medium">Invite code</label>
                        <Input
                            id="invite-code"
                            placeholder="e.g. AB23CD45"
                            value={code}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(e) => { setCode(e.target.value); if (error) setError(null) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleJoin() } }}
                            disabled={isJoining}
                        />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <p className="text-xs text-muted-foreground">
                            Ask a group owner for their invite code. You can leave a group later.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isJoining}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleJoin} disabled={isJoining || !code.trim()}>
                            {isJoining ? 'Joining…' : 'Join group'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
