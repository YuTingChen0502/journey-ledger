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
import type { TripDocType } from '@/db/tripSchema'

type CreateTripFormData = {
    title: string
    destination: string
    start_date: string
    end_date: string
    timezone: string
    description: string
}

interface CreateTripModalProps {
    ownerId: string
    onCreated?: (tripId: string) => void
}

const defaultTimezone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
    } catch {
        return 'Asia/Tokyo'
    }
}

export function CreateTripModal({ ownerId, onCreated }: CreateTripModalProps) {
    const [open, setOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const collection = useRxCollection<TripDocType>('trips')

    const form = useForm<CreateTripFormData>({
        defaultValues: {
            title: '',
            destination: '',
            start_date: '',
            end_date: '',
            timezone: defaultTimezone(),
            description: '',
        },
    })

    const onSubmit = async (data: CreateTripFormData) => {
        if (!collection) {
            toast.error('Database not ready')
            return
        }
        setIsSaving(true)
        try {
            const now = Date.now()
            const id = uuidv4()
            const trip: TripDocType = {
                id,
                owner_id: ownerId,
                title: DOMPurify.sanitize(data.title.trim()),
                destination: DOMPurify.sanitize(data.destination.trim()),
                start_date: data.start_date,
                end_date: data.end_date,
                timezone: data.timezone.trim() || defaultTimezone(),
                description: DOMPurify.sanitize(data.description.trim()),
                created_at: now,
                updated_at: now,
                is_deleted: false,
            }
            await collection.insert(trip)
            toast.success('Trip created')
            form.reset({
                title: '',
                destination: '',
                start_date: '',
                end_date: '',
                timezone: defaultTimezone(),
                description: '',
            })
            setOpen(false)
            onCreated?.(id)
        } catch (err) {
            console.error('Failed to create trip', err)
            toast.error('Failed to create trip')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" /> New Trip
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a new trip</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            rules={{ required: 'Title is required' }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Kyoto Spring 2027" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="destination"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Destination</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Kyoto, Japan" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="start_date"
                                rules={{ required: 'Start date is required' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="end_date"
                                rules={{ required: 'End date is required' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="timezone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Timezone</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Asia/Tokyo" {...field} />
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
                                        <Textarea placeholder="Optional notes about this trip" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Creating…' : 'Create trip'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
