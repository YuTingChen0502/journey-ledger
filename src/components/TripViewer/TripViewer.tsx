import { useMemo, useState } from 'react';
import { useRxData } from 'rxdb-hooks';
import type { TripEventDocType } from '@/db/schema';
import type { TripDocType } from '@/db/tripSchema';
import { format, parseISO, isValid } from 'date-fns';
import { MapPin, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import DOMPurify from 'dompurify';
import { buildTripDays } from '@/lib/dateRange';
import { tripEventsSelector } from '@/lib/tripScoping';

interface TripViewerProps {
    trip: TripDocType;
    onEventClick: (id: string) => void;
}

// Phase 9: the legacy mock weather (keyed to Nagoya 2026 dates) was removed.
// TripViewer no longer shows trip-level weather — it would be fake for arbitrary
// trips. Event-level weather (real, coordinate-based via Open-Meteo) lives in
// EventDetailView. Real trip-level forecast is deferred future work.

export function TripViewer({ trip, onEventClick }: TripViewerProps) {
    const { result: events } = useRxData<TripEventDocType>(
        'tripevents',
        collection => collection.find({
            selector: {
                ...tripEventsSelector(trip.id),
                is_floating: { $eq: false }, // Scheduled events only in the journal view
            },
            sort: [{ start_time: 'asc' }]
        })
    );

    // Build days from the selected trip's date range (no hardcoded 2026 window).
    const { days } = useMemo(() => {
        const dayMap = new Map<string, TripEventDocType[]>();
        buildTripDays(trip.start_date, trip.end_date).forEach(date => {
            dayMap.set(format(date, 'yyyy-MM-dd'), []);
        });

        events.forEach(e => {
            if (!e.start_time) return;
            const date = parseISO(e.start_time);
            if (!isValid(date)) return;
            const k = format(date, 'yyyy-MM-dd');
            if (dayMap.has(k)) {
                dayMap.get(k)?.push(e);
            }
            // Events outside the trip range are intentionally not shown on a day.
        });

        return { days: Array.from(dayMap.entries()) };
    }, [events, trip.start_date, trip.end_date]);

    // State for Tabbed View — default to the trip's first day.
    const [selectedDay, setSelectedDay] = useState<string>(() => format(buildTripDays(trip.start_date, trip.end_date)[0], 'yyyy-MM-dd'));

    // Derive the effective day during render: if the stored selection is not in
    // the current trip's days (e.g. after switching trips), fall back to day 1.
    // (Avoids a setState-in-effect.)
    const effectiveDay = days.some(([d]) => d === selectedDay) ? selectedDay : (days[0]?.[0] ?? selectedDay);

    const tripDateRange = useMemo(() => {
        const list = buildTripDays(trip.start_date, trip.end_date);
        const first = list[0];
        const last = list[list.length - 1];
        return `${format(first, 'MMM d')} — ${format(last, 'MMM d')}`;
    }, [trip.start_date, trip.end_date]);

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Header: Trip title & date range */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur z-20 sticky top-0">
                <div>
                    <h1 className="text-3xl font-serif text-primary">{trip.title}</h1>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest mt-1">{tripDateRange}</p>
                </div>
            </div>

            {/* Day Selector (Tabs) */}
            <div className="bg-background/95 backdrop-blur border-b border-border/50 py-2">
                <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex min-w-max gap-2 px-4 sm:px-6">
                        {days.map(([dateStr], index) => {
                            const date = parseISO(dateStr);
                            const label = `Day ${index + 1}`;
                            const sub = format(date, 'MMM d');
                            const isActive = effectiveDay === dateStr;

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => setSelectedDay(dateStr)}
                                    className={`flex min-w-[84px] flex-col items-center justify-center rounded-lg border px-3 py-2 transition-all sm:min-w-[96px]
                                        ${isActive
                                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                            : 'bg-card hover:bg-muted border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
                                    <span className="text-sm font-serif font-semibold">{sub}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Single Day Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8 pb-32">
                {(() => {
                    const currentDayData = days.find(d => d[0] === effectiveDay);
                    if (!currentDayData) return null;
                    const [dateStr, dayEvents] = currentDayData;
                    const date = parseISO(dateStr);

                    return (
                        <div key={dateStr} className="relative animate-in fade-in duration-300 slide-in-from-bottom-2">
                            {/* Day Header */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20"></div>
                                <h2 className="text-xl font-serif text-foreground">
                                    {format(date, 'EEEE, MMMM do')}
                                </h2>
                            </div>

                            {/* Events List */}
                            <div className="ml-[5px] pl-8 border-l-2 border-dashed border-border space-y-6 pb-2">
                                {dayEvents.length === 0 && (
                                    <div className="text-muted-foreground italic text-sm py-4">
                                        No events planned for this day.
                                    </div>
                                )}
                                {dayEvents.map(event => (
                                    <div key={event.id} className="relative group">
                                        {/* Timeline Node */}
                                        <div className="absolute -left-[39px] top-4 h-2 w-2 rounded-full bg-muted-foreground/50 group-hover:bg-primary transition-colors"></div>

                                        {/* Event Card */}
                                        <Card
                                            className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-card overflow-hidden active:scale-[0.99] transition-transform"
                                            onClick={() => onEventClick(event.id)}
                                        >
                                            <div className="flex">
                                                {/* Time Column */}
                                                <div className="bg-muted/30 p-3 min-w-[70px] flex flex-col items-center justify-center border-r border-border/50 text-muted-foreground">
                                                    <span className="text-sm font-bold">{format(parseISO(event.start_time!), 'HH:mm')}</span>
                                                </div>

                                                {/* Content */}
                                                <div className="p-3 flex-1 flex flex-col justify-center">
                                                    <h3 className="font-semibold text-foreground text-sm md:text-base">{event.title}</h3>
                                                    {event.location && (
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                                            <MapPin className="h-3 w-3 text-primary/70" />
                                                            <span className="truncate">{DOMPurify.sanitize(event.location)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action/Icon */}
                                                <div className="p-3 flex items-center justify-center text-muted-foreground/30">
                                                    <Info className="h-5 w-5" />
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                ))}
                            </div>

                            {/* End of Day Indicator */}
                            <div className="flex items-center gap-4 ml-[6px] mt-8">
                                <div className="h-2 w-2 rounded-full bg-border"></div>
                                <span className="text-sm text-muted-foreground italic">End of Day</span>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
