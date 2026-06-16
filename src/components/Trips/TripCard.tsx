import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, CalendarDays, Pencil, Trash2 } from 'lucide-react'
import type { TripDocType } from '@/db/tripSchema'
import { useTranslation } from '@/hooks/useTranslation'

interface TripCardProps {
    trip: TripDocType
    onSelect: (tripId: string) => void
    onEdit: (trip: TripDocType) => void
    onDelete: (trip: TripDocType) => void
    canManage?: boolean
}

export function TripCard({ trip, onSelect, onEdit, onDelete, canManage = true }: TripCardProps) {
    const { t } = useTranslation()

    return (
        <Card
            role="button"
            tabIndex={0}
            onClick={() => onSelect(trip.id)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(trip.id)
                }
            }}
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-none bg-white/80 p-6 flex flex-col gap-4 min-h-[180px]"
        >
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-serif font-semibold text-foreground leading-snug">
                    {trip.title}
                </h3>
                {/* Action buttons — stopPropagation so they don't open the trip. */}
                {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title={t('trip.action.edit')}
                            aria-label={t('trip.action.edit')}
                            onClick={(e) => { e.stopPropagation(); onEdit(trip) }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title={t('trip.action.delete')}
                            aria-label={t('trip.action.delete')}
                            onClick={(e) => { e.stopPropagation(); onDelete(trip) }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {trip.destination && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-[#0f766e]" />
                    <span className="truncate">{trip.destination}</span>
                </div>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-auto">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#c2410c]" />
                <span>
                    {trip.start_date} <span className="opacity-50">→</span> {trip.end_date}
                </span>
            </div>
        </Card>
    )
}
