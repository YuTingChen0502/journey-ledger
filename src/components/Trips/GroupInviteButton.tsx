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
import { Copy, UserPlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { getOrCreateInviteCode } from '@/services/groups'

interface GroupInviteButtonProps {
    groupId: string
    ownerId: string
}

/** Owner-only: reveal / generate and copy an invite code for a group. */
export function GroupInviteButton({ groupId, ownerId }: GroupInviteButtonProps) {
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    const loadCode = async () => {
        setLoading(true)
        try {
            const c = await getOrCreateInviteCode(groupId, ownerId)
            setCode(c)
        } catch (err) {
            console.error('Failed to get invite code', err)
            toast.error('Could not get an invite code. Is the migration applied?')
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = async () => {
        if (!code) return
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            toast.success('Invite code copied')
            setTimeout(() => setCopied(false), 1500)
        } catch {
            toast.error('Could not copy; select and copy manually.')
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next)
                if (next && !code) loadCode()
                if (!next) setCopied(false)
            }}
        >
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Invite to group"
                    onClick={(e) => e.stopPropagation()}
                >
                    <UserPlus className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Invite to this group</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Share this code. Anyone with it can join the group and see it in their Workspaces.
                    </p>
                    <div className="flex items-center gap-2">
                        <Input
                            readOnly
                            value={loading ? 'Loading...' : (code ?? '')}
                            className="font-mono tracking-widest text-center text-lg"
                            onFocus={(e) => e.currentTarget.select()}
                        />
                        <Button type="button" onClick={handleCopy} disabled={!code || loading} className="gap-2 shrink-0">
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? 'Copied' : 'Copy'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Active members can see shared group trips and events once the Phase 12D migration is applied.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
