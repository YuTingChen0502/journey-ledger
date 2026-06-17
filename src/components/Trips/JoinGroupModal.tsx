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
import { useTranslation } from '@/hooks/useTranslation'

interface JoinGroupModalProps {
    onJoined: (workspace: Workspace) => void
}

export function JoinGroupModal({ onJoined }: JoinGroupModalProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState('')
    const [isJoining, setIsJoining] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleJoin = async () => {
        if (isJoining) return
        const normalized = normalizeInviteCode(code)
        if (!isValidInviteCodeFormat(normalized)) {
            setError(t('group.join.invalid_code'))
            return
        }
        setError(null)
        setIsJoining(true)
        try {
            const group = await joinGroupByInviteCode(normalized)
            toast.success(`${t('group.joined')} ${group.name}`)
            setCode('')
            setOpen(false)
            onJoined(groupWorkspace({ id: group.id, name: group.name }))
        } catch (err) {
            const message = err instanceof JoinGroupError
                ? err.message
                : t('group.join.failed')
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
                    <LogIn className="w-4 h-4" /> {t('group.join')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('group.join.title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="invite-code" className="text-sm font-medium">{t('group.join.code_label')}</label>
                        <Input
                            id="invite-code"
                            placeholder={t('group.join.code_placeholder')}
                            value={code}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(e) => { setCode(e.target.value); if (error) setError(null) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleJoin() } }}
                            disabled={isJoining}
                        />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <p className="text-xs text-muted-foreground">
                            {t('group.join.hint')}
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isJoining}>
                            {t('btn.cancel')}
                        </Button>
                        <Button type="button" onClick={handleJoin} disabled={isJoining || !code.trim()}>
                            {isJoining ? t('group.join.joining') : t('group.join.submit')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
