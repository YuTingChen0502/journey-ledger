import { useMemo, useState } from 'react';
import { useRxData } from 'rxdb-hooks';
import type { TripEventDocType } from '@/db/schema';
import { format, parseISO, addDays } from 'date-fns';
import { MapPin, Info, Cloud } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import DOMPurify from 'dompurify';

interface TripViewerProps {
    tripId: string;
    onEventClick: (id: string) => void;
}

export function TripViewer({ tripId, onEventClick }: TripViewerProps) {
    const { result: events } = useRxData<TripEventDocType>(
        'tripevents',
        collection => collection.find({
            selector: {
                trip_id: { $eq: tripId },
                is_deleted: { $eq: false },
                is_floating: { $eq: false }, // Only scheduled events in Viewer? Or show floating at bottom?
                // For Vertical Timeline, usually only timed events fit well unless we have a section.
                // Let's stick to Scheduled for the main timeline.
            },
            sort: [{ start_time: 'asc' }]
        })
    );

    // Grouping
    // Grouping
    const { days } = useMemo(() => {
        const scheduled: TripEventDocType[] = [];

        events.forEach(e => {
            if (e.start_time) scheduled.push(e);
        });

        const start = new Date(2026, 0, 31); // Jan 31, 2026 (Saturday)

        const dayMap = new Map<string, TripEventDocType[]>();
        const totalDays = 8; // Jan 31 to Feb 7

        for (let i = 0; i < totalDays; i++) {
            const date = addDays(start, i);
            dayMap.set(format(date, 'yyyy-MM-dd'), []);
        }

        scheduled.forEach(e => {
            const k = format(parseISO(e.start_time!), 'yyyy-MM-dd');
            if (dayMap.has(k)) {
                dayMap.get(k)?.push(e);
            }
        });

        return { days: Array.from(dayMap.entries()) };
    }, [events]);

    // State for Tabbed View
    const [selectedDay, setSelectedDay] = useState<string>('2026-01-31');

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Header: Dates & Weather */}
            <div className="flex justify-between items-end px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur z-20 sticky top-0">
                <div>
                    <h1 className="text-3xl font-serif text-primary">Nagoya 2026</h1>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest mt-1">Jan 31 — Feb 07</p>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 px-3 py-1 rounded-full">
                    <Cloud className="h-4 w-4" />
                    <span className="text-sm font-medium">9°C</span>
                </div>
            </div>

            {/* Day Selector (Tabs) */}
            <div className="bg-background/95 backdrop-blur border-b border-border/50 py-2">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex gap-2 px-6">
                        {days.map(([dateStr], index) => {
                            const date = parseISO(dateStr);
                            const label = `Day ${index + 1}`;
                            const sub = format(date, 'MMM d');
                            const isActive = selectedDay === dateStr;

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => setSelectedDay(dateStr)}
                                    className={`flex flex-col items-center justify-center min-w-[70px] px-3 py-2 rounded-lg transition-all border
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
                    <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>
            </div>

            {/* Single Day Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8">
                {(() => {
                    const currentDayData = days.find(d => d[0] === selectedDay);
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
