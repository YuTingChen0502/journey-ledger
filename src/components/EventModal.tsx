import { useState, useEffect } from 'react'
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
import { toast } from 'sonner'
import type { TripEventDocType } from '@/db/schema'
import { useTranslation } from '@/hooks/useTranslation'
import { canAddEvents, QUOTAS } from '@/lib/quotas'


type FormData = {
    title: string
    location: string
    start_time: string
    end_time: string
}

interface EventModalProps {
    userId: string
    tripId: string
    eventId?: string | null
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
    defaultDate?: Date
}

export function EventModal({ userId, tripId, eventId, isOpen: externalIsOpen, onOpenChange, defaultDate }: EventModalProps) {
    const { t } = useTranslation()
    // Internal state for when used as a trigger-based modal (Create Mode mainly)
    const [internalOpen, setInternalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Derived state
    const isControlled = typeof externalIsOpen !== 'undefined'
    const open = isControlled ? externalIsOpen : internalOpen
    const setOpen = isControlled ? (onOpenChange || (() => { })) : setInternalOpen

    const collection = useRxCollection<TripEventDocType>('tripevents')
    const isEditMode = !!eventId

    const form = useForm<FormData>({
        defaultValues: {
            title: '',
            location: '',
            start_time: '',
            end_time: ''
        }
    })

    // Fetch Event Data if in Edit Mode
    useEffect(() => {
        if (isEditMode && open && collection && eventId) {
            const fetchEvent = async () => {
                setIsLoading(true); // Start loading
                try {
                    const doc = await collection.findOne(eventId).exec();
                    if (doc) {
                        form.reset({
                            title: doc.title || '',
                            location: doc.location || '',
                            start_time: doc.start_time ? new Date(doc.start_time).toISOString().slice(0, 16) : '',
                            end_time: doc.end_time ? new Date(doc.end_time).toISOString().slice(0, 16) : ''
                        });
                    } else {
                        toast.error("Event not found");
                        setOpen(false);
                    }
                } catch (err) {
                    console.error("Failed to fetch event", err);
                    toast.error("Failed to load event");
                } finally {
                    setIsLoading(false); // End loading
                }
            };
            fetchEvent();
        } else if (!isEditMode && open) {
            // Reset for Create Mode
            form.reset({
                title: '',
                location: '',
                start_time: defaultDate ? defaultDate.toISOString().slice(0, 16) : '',
                end_time: ''
            });
            setIsLoading(false);
        }
    }, [isEditMode, open, eventId, collection, form, defaultDate, setOpen]);

    const onSubmit = async (data: FormData) => {
        try {
            if (isEditMode && eventId) {
                // UPDATE
                const doc = await collection?.findOne(eventId).exec();
                if (doc) {
                    await doc.incrementalPatch({
                        title: DOMPurify.sanitize(data.title),
                        location: DOMPurify.sanitize(data.location),
                        start_time: data.start_time ? new Date(data.start_time).toISOString() : '',
                        end_time: data.end_time ? new Date(data.end_time).toISOString() : undefined,
                        updated_at: Date.now()
                    });
                    toast.success("Event updated");
                }
            } else {
                // CREATE — quota guard (UX only): cap non-deleted events per trip.
                const existingEvents = await collection?.find({
                    selector: { trip_id: { $eq: tripId }, is_deleted: { $eq: false } }
                }).exec()
                if (existingEvents && !canAddEvents(existingEvents.length, 1)) {
                    toast.error(`This trip has reached the maximum of ${QUOTAS.maxEventsPerTrip} events.`)
                    return
                }
                await collection?.insert({
                    id: uuidv4(),
                    trip_id: tripId,
                    owner_id: userId,
                    title: DOMPurify.sanitize(data.title),
                    location: DOMPurify.sanitize(data.location),
                    is_floating: !data.start_time,
                    start_time: data.start_time ? new Date(data.start_time).toISOString() : '',
                    end_time: data.end_time ? new Date(data.end_time).toISOString() : undefined,
                    sort_order: 'n',
                    created_at: Date.now(),
                    updated_at: Date.now(),
                    is_deleted: false,
                    description: ''
                });
                toast.success("Event created");
            }
            setOpen(false);
            if (!isEditMode) form.reset();
        } catch (error) {
            console.error('Failed to save event', error);
            toast.error('Failed to save event');
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> {t('modal.btn.add')}</Button>
                </DialogTrigger>
            )}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEditMode ? t('modal.edit_title') : t('modal.add_title')}</DialogTitle>
                </DialogHeader>
                {isLoading ? (
                    <div className="flex justify-center p-8">Loading...</div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('modal.label.title')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('modal.placeholder.title')} {...field} />
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
                                        <FormLabel>{t('modal.label.location')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('modal.placeholder.location')} {...field} />
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
                                            <FormLabel>{t('modal.label.start_time')}</FormLabel>
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
                                            <FormLabel>{t('modal.label.end_time')}</FormLabel>
                                            <FormControl>
                                                <Input type="datetime-local" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <Button type="submit">{isEditMode ? t('modal.btn.save') : t('modal.btn.create')}</Button>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    )
}
