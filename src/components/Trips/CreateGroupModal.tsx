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

type CreateGroupFormData = {
    name: string
    description: string
}

interface CreateGroupModalProps {
    ownerId: string
    onCreated?: (workspace: Workspace) => void
}

export function CreateGroupModal({ ownerId, onCreated }: CreateGroupModalProps) {
    const [open, setOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const collection = useRxCollection<GroupDocType>('groups')

    const form = useForm<CreateGroupFormData>({
        defaultValues: { name: '', description: '' },
    })

    const onSubmit = async (data: CreateGroupFormData) => {
        if (!collection) {
            toast.error('Database not ready')
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
            toast.success('Group created')
            form.reset({ name: '', description: '' })
            setOpen(false)
            onCreated?.(groupWorkspace(group))
        } catch (err) {
            console.error('Failed to create group', err)
            toast.error('Failed to create group')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" /> Create Group
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a group</DialogTitle>
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
                                        <Input placeholder="e.g. Family Holiday 2027" {...field} />
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
                        <p className="text-xs text-muted-foreground">
                            Groups are private to your account for now. Sharing and invites are coming in a later phase.
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Creating…' : 'Create group'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
