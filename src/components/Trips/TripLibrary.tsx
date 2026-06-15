import { useRxData } from 'rxdb-hooks'
import { LogOut, Luggage } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TripDocType } from '@/db/tripSchema'
import { useAuth } from '@/context/AuthContext'
import { TripCard } from './TripCard'
import { CreateTripModal } from './CreateTripModal'

interface TripLibraryProps {
    onSelectTrip: (tripId: string) => void
    signOut: () => Promise<void>
}

export function TripLibrary({ onSelectTrip, signOut }: TripLibraryProps) {
    const { user } = useAuth()
    const ownerId = user?.id ?? ''

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
                            Your Trips
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
                                Create your first trip to start planning your journey.
                            </p>
                        </div>
                        <CreateTripModal ownerId={ownerId} onCreated={onSelectTrip} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trips.map((trip) => (
                            <TripCard key={trip.id} trip={trip} onSelect={onSelectTrip} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
