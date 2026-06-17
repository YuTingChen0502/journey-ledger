import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarDays, Map, ChevronLeft } from "lucide-react"
import { format, parseISO } from "date-fns"
import { useTranslation } from "@/hooks/useTranslation"
import type { TripDocType } from "@/db/tripSchema"

interface TripDashboardProps {
    onNavigate: (view: 'overview' | 'table' | 'planner') => void;
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

export function TripDashboard({ onNavigate, onBack, trip }: TripDashboardProps) {
    const { t } = useTranslation();

    // Phase 3: show the selected trip's details when available, otherwise fall
    // back to the legacy localized copy.
    const title = trip?.title ?? t('trip.title');
    const dateRange = trip
        ? `${formatDate(trip.start_date).toUpperCase()} - ${formatDate(trip.end_date).toUpperCase()}`
        : t('trip.dates');

    return (
        <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col items-center justify-center overflow-y-auto p-6 pb-32 relative space-y-12 animate-in fade-in duration-500">
            {/* Top bar: back to trip library */}
            <div className="w-full max-w-4xl flex justify-start items-center px-4">
                {onBack && (
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={onBack}>
                        <ChevronLeft className="h-4 w-4" /> {t('nav.all_trips')}
                    </Button>
                )}
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

            {/* Main sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
                <Card
                    className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-none bg-white/80 p-8 flex flex-col items-center justify-center gap-6 min-h-[280px]"
                    onClick={() => onNavigate('overview')}
                >
                    <div className="h-20 w-20 rounded-full bg-[rgba(20,184,166,0.1)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Map className="h-10 w-10 text-[#0f766e]" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-serif font-semibold text-foreground">{t('dashboard.overview.title')}</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px] leading-relaxed">
                            {t('dashboard.overview.desc')}
                        </p>
                    </div>
                </Card>

                <Card
                    className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-none bg-white/80 p-8 flex flex-col items-center justify-center gap-6 min-h-[280px]"
                    onClick={() => onNavigate('planner')}
                >
                    <div className="h-20 w-20 rounded-full bg-[rgba(249,115,22,0.1)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <CalendarDays className="h-10 w-10 text-[#c2410c]" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-serif font-semibold text-foreground">{t('dashboard.planning.title')}</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px] leading-relaxed">
                            {t('dashboard.planning.desc')}
                        </p>
                    </div>
                </Card>
            </div>

            <p className="text-xs text-muted-foreground/50 absolute bottom-6">
                {t('dashboard.footer')}
            </p>
        </div>
    )
}
