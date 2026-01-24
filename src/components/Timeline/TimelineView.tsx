import { useState, useMemo } from 'react';
import { useRxData, useRxCollection } from 'rxdb-hooks';
import type { TripEventDocType } from '@/db/schema';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { TimelineDay } from './TimelineDay';
import { TimelineEvent } from './TimelineEvent';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ListFilter } from 'lucide-react';
import { generateRankBetween } from '@/lib/lexorank';
import { addDays, format, parseISO } from 'date-fns';

interface TimelineViewProps {
    tripId: string;
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
            sort: [{ start_time: 'asc' }, { sort_order: 'asc' }]
        })
    );

    const [activeId, setActiveId] = useState<string | null>(null);

    // Grouping Logic
    const { days, floatingEvents } = useMemo(() => {
        // Strict Date Range: Jan 31, 2026 to Feb 7, 2026
        const startDate = new Date('2026-01-31');
        const endDate = new Date('2026-02-07');

        const dayMap = new Map<string, TripEventDocType[]>();

        // Initialize Map with all dates in range
        let currentDate = startDate;
        while (currentDate <= endDate) {
            dayMap.set(format(currentDate, 'yyyy-MM-dd'), []);
            currentDate = addDays(currentDate, 1);
        }

        const floating: TripEventDocType[] = [];

        events.forEach(event => {
            if (event.is_floating || !event.start_time) {
                floating.push(event);
            } else {
                const dayKey = format(parseISO(event.start_time), 'yyyy-MM-dd');
                if (dayMap.has(dayKey)) {
                    dayMap.get(dayKey)?.push(event);
                } else {
                    // unexpected date, treat as floating for now to avoid data loss
                    floating.push(event);
                }
            }
        });

        // Lexorank sort within groups
        for (const [_, dayEvents] of dayMap) {
            dayEvents.sort((a, b) => a.sort_order.localeCompare(b.sort_order));
        }

        const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        // Sort floating by sort_order
        floating.sort((a, b) => a.sort_order.localeCompare(b.sort_order));

        return { days: sortedDays, floatingEvents: floating };
    }, [events]);

    const [isBacklogOpen, setIsBacklogOpen] = useState(false);

    // Sensor Configuration for Mobile (Long Press to Drag)
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 250, // 250ms delay for long press
                tolerance: 5, // 5px tolerance
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        // If coming from sheet, we might need to close it? 
        // dnd-kit usually handles overlay well. 
        // UX decision: keep sheet open or close? Let's keep it open for now.
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id;
        // const overId = over.id; // This might be a day container or another item

        // If dropped on the same container/index, no change needed usually, 
        // unless container changed. But dnd-kit handles logic.

        // Implementation detail:
        // We need to know:
        // 1. Source Item
        // 2. Target Day (if changed)
        // 3. New Rank (based on neighbors in target)

        // Finding the item
        const activeItem = events.find(e => e.id === activeId);
        if (!activeItem) return;

        const containerId = over.data.current?.sortable?.containerId || over.id;

        if (containerId === 'unscheduled') {
            // Moving to backlog
            await moveToBacklog(activeItem, over.id as string);
        } else {
            // Moving to a Day
            await moveToDay(activeItem, containerId as string, over.id as string);
        }
    };

    const moveToBacklog = async (item: TripEventDocType, overId: string) => {
        // Logic to calculate new rank in floating list
        // This requires finding prev/next in the `floatingEvents` array specifically
        // Simple optimization: just rank at end if over container, or between if over item
        let newRank = item.sort_order;
        const overIndex = floatingEvents.findIndex(e => e.id === overId);

        if (overId === 'unscheduled') {
            // Dropped on container, move to end?
            const last = floatingEvents[floatingEvents.length - 1];
            newRank = generateRankBetween(last?.sort_order, undefined);
        } else if (overIndex !== -1) {
            const overItem = floatingEvents[overIndex];
            // Determine if above or below? dnd-kit sortable usually handles index swap.
            // We need to calculate rank.
            // Let's rely on finding neighbors in the *sorted* list we have locally.
            // If we drop *over* item X, usually means taking X's place.
            // We need to check useSortable indices.

            // Simplification for prototype: always put after `over` item for now, 
            // but correct Lexorank logic needs index.
            // Let's leave simple logic:
            newRank = generateRankBetween(overItem.sort_order, floatingEvents[overIndex + 1]?.sort_order);
        }

        // Update DB
        if (item.is_floating) {
            // Just reorder
            if (item.sort_order !== newRank) {
                const doc = await collection?.findOne(item.id).exec();
                await doc?.incrementalPatch({ sort_order: newRank, updated_at: Date.now() });
            }
        } else {
            // Change type
            const doc = await collection?.findOne(item.id).exec();
            await doc?.incrementalPatch({
                is_floating: true,
                start_time: '',
                // Schema allows optional string.
                sort_order: newRank,
                updated_at: Date.now()
            });
        }
    }

    const moveToDay = async (item: TripEventDocType, dateKey: string, overId: string) => {
        const dayEvents = days.find(d => d[0] === dateKey)?.[1] || [];
        dayEvents.sort((a, b) => a.sort_order.localeCompare(b.sort_order));

        let newRank = item.sort_order;

        if (overId === dateKey) {
            // Dropped on empty day or container
            const last = dayEvents[dayEvents.length - 1];
            newRank = generateRankBetween(last?.sort_order, undefined);
        } else {
            // Dropped on specific item
            const overIndex = dayEvents.findIndex(e => e.id === overId);
            if (overIndex !== -1) {
                // If dragging downwards, placed after. Upwards, before. 
                // dnd-kit complicates this. 
                // Strategy: If active.id != over.id, we are effectively inserting "before" overId if we treat it as list insertion?
                // Let's assume insert BEFORE overId for standard DnD.

                const prev = dayEvents[overIndex - 1];
                const next = dayEvents[overIndex];
                newRank = generateRankBetween(prev?.sort_order, next?.sort_order);
            }
        }

        // Date update
        let newStartTime = item.start_time;
        // If "Moving between Days" -> Update Date part of start_time
        if (!item.start_time || !item.start_time.startsWith(dateKey)) {
            // Keep time, change date. Default to 09:00 if no time.
            const timePart = item.start_time ? parseISO(item.start_time).toTimeString().substring(0, 5) : '09:00';
            newStartTime = `${dateKey}T${timePart}:00.000Z`; // Simple ISO construction
            // Better to use date-fns to be safe with timezone? 
            // Actually, storing as string is ambiguous if not Full ISO. 
            // Let's stick to simple string replacement for Phase 3 Proof of Concept, 
            // ensuring we respect the YYYY-MM-DD from the group key.
        }

        const doc = await collection?.findOne(item.id).exec();
        await doc?.incrementalPatch({
            is_floating: false,
            start_time: newStartTime,
            sort_order: newRank,
            updated_at: Date.now()
        });
    }

    // Mobile Backlog Sheet Component
    const MobileBacklogSheet = () => (
        <Sheet open={isBacklogOpen} onOpenChange={setIsBacklogOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden fixed bottom-4 right-4 z-50 rounded-full shadow-lg h-12 w-12 p-0 bg-primary text-primary-foreground">
                    <ListFilter className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[350px] p-0 flex flex-col">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle>Unscheduled Events</SheetTitle>
                    <SheetDescription>Drag these items to your timeline.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
                    <TimelineDay
                        dayId="unscheduled"
                        date={new Date(0)}
                        events={floatingEvents}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );

    const activeItem = events.find(e => e.id === activeId);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="relative flex h-[calc(100vh-140px)] gap-4 overflow-hidden">
                {/* Desktop Backlog Sidebar */}
                <div className="hidden md:flex w-64 flex-shrink-0 flex-col border-r bg-muted/10 p-2">
                    <h3 className="font-bold mb-2 px-2 text-sm uppercase text-muted-foreground tracking-wider">Unscheduled</h3>
                    <TimelineDay
                        dayId="unscheduled"
                        date={new Date(0)}
                        events={floatingEvents}
                    />
                </div>

                {/* Main Timeline Days (Horizontal Scroll) */}
                <div className="flex-1 overflow-x-auto flex gap-4 p-2 pb-20 md:pb-2">
                    {days.map(([dateStr, dayEvents]) => (
                        <TimelineDay
                            key={dateStr}
                            dayId={dateStr}
                            date={parseISO(dateStr)}
                            events={dayEvents}
                        />
                    ))}
                </div>

                {/* Mobile Trigger & Sheet */}
                <MobileBacklogSheet />
            </div>

            <DragOverlay>
                {activeItem ? <TimelineEvent event={activeItem} /> : null}
            </DragOverlay>
        </DndContext>
    );
}
