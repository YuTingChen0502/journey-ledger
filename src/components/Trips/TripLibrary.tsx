import { useState } from 'react'
import { useRxData, useRxCollection } from 'rxdb-hooks'
import { LogOut, Luggage } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import type { TripDocType } from '@/db/tripSchema'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from '@/hooks/useTranslation'
import { loadSelectedTripId, clearSelectedTripId } from '@/lib/selectedTrip'
import { TripCard } from './TripCard'
import { CreateTripModal } from './CreateTripModal'
import { EditTripModal } from './EditTripModal'

interface TripLibraryProps {
    onSelectTrip: (tripId: string) => void
    signOut: () => Promise<void>
}

export function TripLibrary({ onSelectTrip, signOut }: TripLibraryProps) {
    const { user } = useAuth()
    const { t } = useTranslation()
    const ownerId = user?.id ?? ''
    const collection = useRxCollection<TripDocType>('trips')

    const [editingTrip, setEditingTrip] = useState<TripDocType | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [tripPendingDelete, setTripPendingDelete] = useState<TripDocType | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleEdit = (trip: TripDocType) => {
        setEditingTrip(trip)
        setEditOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!collection || !tripPendingDelete) return
        setIsDeleting(true)
        try {
            const doc = await collection.findOne(tripPendingDelete.id).exec()
            if (doc) {
                // Soft-delete only: hide the trip, never hard-delete. Events are
                // intentionally left untouched (kept under their trip_id).
                await doc.incrementalPatch({ is_deleted: true, updated_at: Date.now() })
            }
            // If the deleted trip was the persisted selection, forget it so a
            // future reload starts at the library instead of failing to resolve.
            if (loadSelectedTripId() === tripPendingDelete.id) {
                clearSelectedTripId()
            }
            toast.success(t('trip.deleted'))
            setTripPendingDelete(null)
        } catch (err) {
            console.error('Failed to delete trip', err)
            toast.error(t('trip.delete_failed'))
        } finally {
            setIsDeleting(false)
        }
    }

    // Only this user's non-deleted trips. Replication already scopes by user via
    // RLS, but we filter locally too for correctness and clarity.
    const { result: trips, isFetching } = useRxData<TripDocType>('trips', (collection) =>
        collection.find({
            selector: {
                is_deleted: { $eq: false },
                owner_id: { $eq: ownerId },
            },
            sort: [{ start_date: 'asc' }],
        })
    )

    return (
        <div className="h-full w-full overflow-y-auto bg-background">
            <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-serif font-bold text-primary tracking-tight">
                            Journey Ledger
                        </h1>
                        <p className="text-sm text-muted-foreground uppercase tracking-widest">
                            All Trips
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                            Your local-first travel journal &amp; planner — pick a trip or start a new one.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <CreateTripModal ownerId={ownerId} onCreated={onSelectTrip} />
                        <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign Out">
                            <LogOut className="w-4 h-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                {isFetching ? (
                    <p className="text-muted-foreground text-sm">Loading trips…</p>
                ) : trips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center gap-4 py-20">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                            <Luggage className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-serif font-semibold text-foreground">No trips yet</h2>
                            <p className="text-sm text-muted-foreground max-w-sm">
                                Journey Ledger keeps a journal and plan for each trip. Create your first trip to get started — everything works offline and syncs when you reconnect.
                            </p>
                        </div>
                        <CreateTripModal ownerId={ownerId} onCreated={onSelectTrip} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trips.map((trip) => (
                            <TripCard
                                key={trip.id}
                                trip={trip}
                                onSelect={onSelectTrip}
                                onEdit={handleEdit}
                                onDelete={setTripPendingDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Edit trip */}
            <EditTripModal trip={editingTrip} open={editOpen} onOpenChange={setEditOpen} />

            {/* Soft-delete confirmation */}
            <AlertDialog open={!!tripPendingDelete} onOpenChange={(open) => !open && setTripPendingDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('trip.delete.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('trip.delete.desc')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{t('btn.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleConfirmDelete() }}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {t('trip.delete.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
