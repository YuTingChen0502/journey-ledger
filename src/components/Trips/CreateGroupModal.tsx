import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useRxCollection } from 'rxdb-hooks'
import { v4 as uuidv4 } from 'uuid'
import { Plus } from 'lucide-react'
import DOMPurify from 'dompurify'
import { toast } from 'sonner'
import type { GroupDocType } from '@/db/groupSchema'
import { groupWorkspace, type Workspace } from '@/lib/workspace'
import { useTranslation } from '@/hooks/useTranslation'

type CreateGroupFormData = {
    name: string
    description: string
}

interface CreateGroupModalProps {
    ownerId: string
    onCreated?: (workspace: Workspace) => void
}

export function CreateGroupModal({ ownerId, onCreated }: CreateGroupModalProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const collection = useRxCollection<GroupDocType>('groups')

    const form = useForm<CreateGroupFormData>({
        defaultValues: { name: '', description: '' },
    })

    const onSubmit = async (data: CreateGroupFormData) => {
        if (!collection) {
            toast.error(t('group.db_not_ready'))
            return
        }
        setIsSaving(true)
        try {
            const now = Date.now()
            const id = uuidv4()
            const group: GroupDocType = {
                id,
                name: DOMPurify.sanitize(data.name.trim()),
                description: DOMPurify.sanitize(data.description.trim()),
                created_by: ownerId,
                owner_id: ownerId,
                created_at: now,
                updated_at: now,
                is_deleted: false,
            }
            await collection.insert(group)
            toast.success(t('group.created'))
            form.reset({ name: '', description: '' })
            setOpen(false)
            onCreated?.(groupWorkspace(group))
        } catch (err) {
            console.error('Failed to create group', err)
            toast.error(t('group.create_failed'))
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" /> {t('group.create')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('group.create.title')}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            rules={{ required: t('group.field.name_required') }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('group.field.name')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('group.field.name_placeholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('group.field.description')}</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder={t('group.field.description_placeholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('group.create.share_note')}
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                                {t('btn.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? t('group.create.saving') : t('group.create.submit')}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
