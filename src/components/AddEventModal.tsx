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
import { useRxCollection } from 'rxdb-hooks'
import { v4 as uuidv4 } from 'uuid'
import { Plus } from 'lucide-react'
import DOMPurify from 'dompurify'

type FormData = {
    title: string
    location: string
    start_time: string
    end_time: string
}

export function AddEventModal({ userId }: { userId: string }) {
    const [open, setOpen] = useState(false)
    const collection = useRxCollection('tripevents')

    const form = useForm<FormData>({
        defaultValues: {
            title: '',
            location: '',
            start_time: '',
            end_time: ''
        }
    })

    const onSubmit = async (data: FormData) => {
        try {
            await collection?.insert({
                id: uuidv4(),
                trip_id: 'default-trip', // Placeholder for now
                owner_id: userId,
                title: DOMPurify.sanitize(data.title),
                location: DOMPurify.sanitize(data.location),
                is_floating: false, // Default to scheduled for now
                start_time: data.start_time ? new Date(data.start_time).toISOString() : '',
                end_time: data.end_time ? new Date(data.end_time).toISOString() : undefined,
                sort_order: '0', // TODO: Implement Lexorank
                created_at: Date.now(),
                updated_at: Date.now(),
                is_deleted: false,
                description: ''
            });
            setOpen(false);
            form.reset();
        } catch (error) {
            console.error('Failed to add event', error);
            alert('Failed to add event');
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add Event</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Event</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Event title" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="location"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Location</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Location" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="start_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Time</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="end_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Time</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <Button type="submit">Save</Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
