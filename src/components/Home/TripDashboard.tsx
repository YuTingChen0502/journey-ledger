import { Button } from "@/components/ui/button"
import { CalendarDays, Map, ChevronLeft } from "lucide-react"
import { format, parseISO } from "date-fns"
import { GlobalSettingsControl } from "./GlobalSettingsControl"
import { useTranslation } from "@/hooks/useTranslation"
import type { TripDocType } from "@/db/tripSchema"

interface TripDashboardProps {
    onBack?: () => void;
    trip?: TripDocType;
}

// Format a YYYY-MM-DD string defensively (falls back to the raw value).
const formatDate = (value: string): string => {
    try {
        return format(parseISO(value), 'MMM d, yyyy');
    } catch {
        return value;
    }
};

export function TripDashboard({ onBack, trip }: TripDashboardProps) {
    const { t } = useTranslation();

    // Phase 3: show the selected trip's details when available, otherwise fall
    // back to the legacy localized copy.
    const title = trip?.title ?? t('trip.title');
    const dateRange = trip
        ? `${formatDate(trip.start_date).toUpperCase()} - ${formatDate(trip.end_date).toUpperCase()}`
        : t('trip.dates');

    return (
        <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col items-center justify-center overflow-y-auto p-6 pb-32 relative space-y-12 animate-in fade-in duration-500">
            {/* Top bar: back to trip library + settings */}
            <div className="w-full max-w-4xl flex justify-between items-center px-4">
                {onBack ? (
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={onBack}>
                        <ChevronLeft className="h-4 w-4" /> All Trips
                    </Button>
                ) : <span />}
                <GlobalSettingsControl />
            </div>

            {/* Header */}
            <div className="text-center space-y-4">
                <h1 className="text-5xl md:text-6xl font-serif font-bold text-primary tracking-tight">
                    {title}
                </h1>
                {trip?.destination && (
                    <p className="text-muted-foreground/80 text-base font-medium">
                        {trip.destination}
                    </p>
                )}
                <div className="flex items-center justify-center gap-3">
                    <div className="h-px w-12 bg-border"></div>
                    <p className="text-muted-foreground text-lg font-medium uppercase tracking-widest">
                        {dateRange}
                    </p>
                    <div className="h-px w-12 bg-border"></div>
                </div>
            </div>

            {/* Trip summary */}
            <div className="w-full max-w-3xl px-4">
                <div className="grid gap-4 rounded-lg border border-border bg-white/80 p-6 text-left shadow-sm md:grid-cols-3">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            <Map className="h-4 w-4" />
                            Destination
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            {trip?.destination || "Not set"}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            <CalendarDays className="h-4 w-4" />
                            Dates
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            {dateRange}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            Workspace
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            Ready
                        </p>
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground/50 absolute bottom-6">
                {t('dashboard.footer')}
            </p>
        </div>
    )
}
