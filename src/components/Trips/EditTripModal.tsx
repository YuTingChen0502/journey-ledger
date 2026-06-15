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
import type { TripDocType } from '@/db/tripSchema'
import { isValidTripDateRange } from '@/lib/dateRange'
import { useTranslation } from '@/hooks/useTranslation'

type EditTripFormData = {
    title: string
    destination: string
    start_date: string
    end_date: string
    timezone: string
    description: string
}

interface EditTripModalProps {
    trip: TripDocType | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditTripModal({ trip, open, onOpenChange }: EditTripModalProps) {
    const { t } = useTranslation()
    const [isSaving, setIsSaving] = useState(false)
    const collection = useRxCollection<TripDocType>('trips')

    const form = useForm<EditTripFormData>({
        defaultValues: {
            title: '',
            destination: '',
            start_date: '',
            end_date: '',
            timezone: '',
            description: '',
        },
    })

    // Sync the form with the trip being edited whenever it (or open state) changes.
    useEffect(() => {
        if (open && trip) {
            form.reset({
                title: trip.title ?? '',
                destination: trip.destination ?? '',
                start_date: trip.start_date ?? '',
                end_date: trip.end_date ?? '',
                timezone: trip.timezone ?? '',
                description: trip.description ?? '',
            })
        }
    }, [open, trip, form])

    const onSubmit = async (data: EditTripFormData) => {
        if (!collection || !trip) {
            toast.error(t('trip.update_failed'))
            return
        }
        if (!isValidTripDateRange(data.start_date, data.end_date)) {
            form.setError('end_date', { message: t('trip.invalid_date_range') })
            return
        }
        setIsSaving(true)
        try {
            const doc = await collection.findOne(trip.id).exec()
            if (!doc) {
                toast.error(t('trip.update_failed'))
                return
            }
            // Preserve id / owner_id / created_at; only patch editable fields.
            await doc.incrementalPatch({
                title: DOMPurify.sanitize(data.title.trim()),
                destination: DOMPurify.sanitize(data.destination.trim()),
                start_date: data.start_date,
                end_date: data.end_date,
                timezone: data.timezone.trim(),
                description: DOMPurify.sanitize(data.description.trim()),
                updated_at: Date.now(),
            })
            toast.success(t('trip.updated'))
            onOpenChange(false)
        } catch (err) {
            console.error('Failed to update trip', err)
            toast.error(t('trip.update_failed'))
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('trip.edit.title')}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            rules={{ required: 'Title is required' }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('modal.label.title')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
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
                                    <FormLabel>{t('detail.label.destination')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
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
                                        <FormLabel>{t('modal.label.start_time')}</FormLabel>
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
                                        <FormLabel>{t('modal.label.end_time')}</FormLabel>
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
                                        <Textarea {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                                {t('btn.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? t('trip.btn.saving') : t('trip.btn.save')}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
