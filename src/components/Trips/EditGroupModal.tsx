import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
import DOMPurify from 'dompurify'
import { toast } from 'sonner'
import type { GroupDocType } from '@/db/groupSchema'
import type { GroupSummary } from '@/lib/workspace'

type EditGroupFormData = {
    name: string
    description: string
}

interface EditGroupModalProps {
    group: GroupSummary | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved?: (next: { id: string; name: string; description: string }) => void
}

/**
 * Owner-only group rename / description edit (Phase 12D.1). Operates on the
 * local-first RxDB `groups` doc (only owned groups exist there); the `groups`
 * table's owner-only UPDATE RLS is the authoritative guard. Does NOT touch group
 * trips/events.
 */
export function EditGroupModal({ group, open, onOpenChange, onSaved }: EditGroupModalProps) {
    const [isSaving, setIsSaving] = useState(false)
    const collection = useRxCollection<GroupDocType>('groups')

    const form = useForm<EditGroupFormData>({
        defaultValues: { name: '', description: '' },
    })

    useEffect(() => {
        if (open && group) {
            form.reset({
                name: group.name ?? '',
                description: group.description ?? '',
            })
        }
    }, [open, group, form])

    const onSubmit = async (data: EditGroupFormData) => {
        if (!collection || !group) {
            toast.error('Could not update the group')
            return
        }
        setIsSaving(true)
        try {
            const doc = await collection.findOne(group.id).exec()
            if (!doc) {
                // Only the owner has a local group doc; if it's missing the user
                // isn't the owner (or it isn't synced yet).
                toast.error('Only the group owner can edit this group')
                return
            }
            const name = DOMPurify.sanitize(data.name.trim())
            const description = DOMPurify.sanitize(data.description.trim())
            // Preserve id / owner_id / created_at; only patch editable fields.
            await doc.incrementalPatch({ name, description, updated_at: Date.now() })
            toast.success('Group updated')
            onSaved?.({ id: group.id, name, description })
            onOpenChange(false)
        } catch (err) {
            console.error('Failed to update group', err)
            toast.error('Could not update the group')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit group</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            rules={{ required: 'Group name is required' }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Group name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
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
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Optional notes about this group" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Saving…' : 'Save changes'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
