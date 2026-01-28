import { useState, useMemo } from 'react';
import { useRxData, useRxCollection } from 'rxdb-hooks';
import type { TripEventDocType } from '@/db/schema';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    useDroppable,
    PointerSensor,
    type DragEndEvent,
    type DragStartEvent,
    type DragMoveEvent,
    type Modifier,
} from '@dnd-kit/core';
import { DayColumn } from './DayColumn';
import { TimelineEvent } from './TimelineEvent';
import { addDays, format, parseISO, differenceInMinutes, addMinutes } from 'date-fns';
import { safeParseISO, safeFormatTime } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface TimelineViewProps {
    tripId: string;
}

const PPM = 2; // Pixels per minute
const START_HOUR = 6; // 06:00 AM
const DAY_START_MINUTES = START_HOUR * 60;

// Snap Modifier: 5 minutes = 10px
const snapToGridModifier: Modifier = ({ transform }) => {
    return {
        ...transform,
        y: Math.round(transform.y / 10) * 10,
        x: Math.round(transform.x / 1),
    };
};

// Sub-component for Backlog Droppable
function BacklogArea({ children }: { children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'backlog',
    });
    return (
        <div ref={setNodeRef} className={`flex-1 overflow-y-auto p-2 ${isOver ? 'bg-accent/20' : ''}`}>
            {children}
        </div>
    );
}

export function TimelineView({ tripId }: TimelineViewProps) {
    const collection = useRxCollection<TripEventDocType>('tripevents');
    const { result: events } = useRxData<TripEventDocType>(
        'tripevents',
        collection => collection.find({
            selector: {
                trip_id: { $eq: tripId },
                is_deleted: { $eq: false }
            },
            sort: [{ start_time: 'asc' }]
        })
    );

    const [activeId, setActiveId] = useState<string | null>(null);
    const [showBacklog, setShowBacklog] = useState(false); // Default collapsed
    const [previewTime, setPreviewTime] = useState<string | null>(null);

    // Date Range: Jan 31 - Feb 7
    // Use local time constructor to avoid UTC timezone shifts
    const startDate = new Date(2026, 0, 31); // Jan 31, 2026 00:00:00 Local
    const days = Array.from({ length: 8 }, (_, i) => addDays(startDate, i));

    // Group Events by Day
    const { dayEvents, floatingEvents } = useMemo(() => {
        const map = new Map<string, TripEventDocType[]>();
        const floating: TripEventDocType[] = [];

        days.forEach(d => map.set(format(d, 'yyyy-MM-dd'), []));

        events.forEach(event => {
            if (event.is_floating || !event.start_time) {
                floating.push(event);
            } else {
                const date = safeParseISO(event.start_time);
                if (date) {
                    const key = format(date, 'yyyy-MM-dd');
                    if (map.has(key)) {
                        map.get(key)?.push(event);
                    } else {
                        floating.push(event); // Out of range
                    }
                } else {
                    floating.push(event);
                }
            }
        });

        return { dayEvents: map, floatingEvents: floating };
    }, [events]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        const activeEvent = events.find(e => e.id === event.active.id);
        if (activeEvent?.start_time) {
            setPreviewTime(safeFormatTime(activeEvent.start_time));
        }
    };

    const handleDragMove = (event: DragMoveEvent) => {
        const { active, over, delta } = event;

        if (over && (over.id as string).startsWith('day-')) {
            const activeEvent = events.find(e => e.id === active.id);
            if (activeEvent && activeEvent.start_time) {
                const start = safeParseISO(activeEvent.start_time);
                if (start) {
                    // Start relative to DayStart (e.g., 6:00 AM)
                    // We need to calculate based on Original Time + Delta
                    const currentMinutes = (start.getHours() * 60) + start.getMinutes();

                    // Apply Delta (rounded to 5 mins / 10px)
                    const deltaMinutes = Math.round((delta.y / PPM) / 5) * 5;

                    let newMinutes = currentMinutes + deltaMinutes;

                    // Clamp
                    newMinutes = Math.max(DAY_START_MINUTES, Math.min(23 * 60 + 55, newMinutes));

                    // Format for Preview
                    const h = Math.floor(newMinutes / 60);
                    const m = newMinutes % 60;
                    setPreviewTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                    return;
                }
            }
        }
        setPreviewTime(null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over, delta } = event;
        setActiveId(null);
        setPreviewTime(null);

        if (!over) return;

        const activeEvent = events.find(e => e.id === active.id);
        if (!activeEvent) return;

        const overId = over.id as string;

        if (overId.startsWith('day-')) {
            const dateStr = overId.replace('day-', '');

            let currentMinutes = 0;
            if (activeEvent.start_time && !activeEvent.is_floating) {
                const dt = safeParseISO(activeEvent.start_time);
                if (dt) {
                    currentMinutes = (dt.getHours() * 60) + dt.getMinutes();
                }
            } else {
                currentMinutes = 9 * 60; // Default 9 AM
            }

            // Delta in minutes
            const deltaMinutes = Math.round((delta.y / PPM) / 5) * 5;
            let newMinutes = currentMinutes + deltaMinutes;

            // Round Result to 5 minutes (Absolute Snap)
            newMinutes = Math.round(newMinutes / 5) * 5;

            // Clamp
            newMinutes = Math.max(DAY_START_MINUTES, Math.min(23 * 60 + 55, newMinutes));

            const targetDate = parseISO(dateStr);
            // Add Minutes to Target Date (Midnight)
            const newDateObj = addMinutes(targetDate, newMinutes);
            const newISO = newDateObj.toISOString();

            if (newISO !== activeEvent.start_time) {
                // Preserve Duration Logic
                let duration = 60; // Default
                if (activeEvent.start_time && activeEvent.end_time) {
                    const s = safeParseISO(activeEvent.start_time);
                    const e = safeParseISO(activeEvent.end_time);
                    if (s && e) {
                        duration = differenceInMinutes(e, s);
                    }
                }

                const newEndObj = addMinutes(newDateObj, duration);

                const doc = await collection?.findOne(activeEvent.id).exec();
                await doc?.incrementalPatch({
                    start_time: newISO,
                    end_time: newEndObj.toISOString(), // Update End Time
                    is_floating: false,
                    updated_at: Date.now()
                });
            }

        } else if (overId === 'backlog') {
            const doc = await collection?.findOne(activeEvent.id).exec();
            await doc?.incrementalPatch({
                is_floating: true,
                start_time: '',
                updated_at: Date.now()
            });
        }
    };

    const activeItem = events.find(e => e.id === activeId);

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full overflow-hidden bg-background relative">
                {/* Fixed Time Sidebar */}
                <div className="w-16 flex-shrink-0 border-r bg-muted/30 overflow-hidden relative border-t">
                    {/* Corner Header Block to match Date Rows */}
                    <div className="h-8 border-b bg-muted/50 w-full" />
                    <div className="relative w-full h-full">
                        {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
                            <div key={h} className="absolute w-full text-right pr-2 text-xs text-muted-foreground" style={{ top: `${(h - 6) * 120}px` }}>
                                {`${h}:00`}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Grid Scroll Area */}
                <ScrollArea className="flex-1 h-full">
                    <div className="flex min-w-max h-[2160px]">
                        {days.map(day => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const dayList = dayEvents.get(dateKey) || [];

                            return (
                                <div key={dateKey} className="flex flex-col w-[200px] border-r">
                                    {/* Header */}
                                    <div className="h-8 flex items-center justify-center border-b font-medium text-sm bg-muted/50 sticky top-0 z-20">
                                        {format(day, 'EEE d')}
                                    </div>
                                    {/* Column */}
                                    <DayColumn date={day}>
                                        {dayList.map(event => {
                                            const start = safeParseISO(event.start_time);
                                            // Explicit Date Matching Check
                                            if (start && format(start, 'yyyy-MM-dd') !== dateKey) {
                                                return null;
                                            }

                                            let top = 0;
                                            let height = 60 * PPM; // Default 1 hour

                                            if (start) {
                                                const minutes = (start.getHours() * 60) + start.getMinutes();
                                                top = (minutes - DAY_START_MINUTES) * PPM;

                                                if (event.end_time) {
                                                    const end = safeParseISO(event.end_time);
                                                    if (end) {
                                                        const duration = differenceInMinutes(end, start);
                                                        height = Math.max(30, duration) * PPM;
                                                    }
                                                }
                                            }

                                            return (
                                                <TimelineEvent
                                                    key={event.id}
                                                    event={event}
                                                    style={{
                                                        top: `${top}px`,
                                                        height: `${height}px`
                                                    }}
                                                />
                                            );
                                        })}
                                    </DayColumn>
                                </div>
                            );
                        })}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>

                {/* Right Floating Sidebar (Backlog) - Collapsible */}
                <div className={`border-l bg-muted/10 flex flex-col transition-all duration-300 ease-in-out ${showBacklog ? 'w-64' : 'w-0 overflow-hidden'}`}>
                    <div className="p-2 border-b font-semibold text-sm flex items-center justify-between">
                        <span className="truncate">Unscheduled</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowBacklog(false)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <BacklogArea>
                        {floatingEvents.map(event => (
                            <div key={event.id} className="relative mb-2 h-24">
                                <TimelineEvent
                                    event={event}
                                    className="static h-full w-full"
                                    style={{ transform: 'none' }}
                                />
                            </div>
                        ))}
                    </BacklogArea>
                </div>

                {/* Floating Toggle Button (Visible when sidebar collapsed) */}
                {!showBacklog && (
                    <Button
                        variant="outline"
                        size="icon"
                        className="absolute top-2 right-2 z-50 shadow-md bg-background"
                        onClick={() => setShowBacklog(true)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <DragOverlay modifiers={[snapToGridModifier]}>
                {activeItem ? (
                    <TimelineEvent
                        event={activeItem}
                        isOverlay={true}
                        previewTime={previewTime}
                        style={{
                            height: `${(
                                activeItem.start_time && activeItem.end_time
                                    ? differenceInMinutes(safeParseISO(activeItem.end_time)!, safeParseISO(activeItem.start_time)!)
                                    : 60
                            ) * PPM}px`
                        }}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
