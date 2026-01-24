import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TimelineEvent } from './TimelineEvent';
import type { TripEventDocType } from '@/db/schema';
import { format } from 'date-fns';

interface TimelineDayProps {
    date: Date;
    events: TripEventDocType[];
    dayId: string; // ISO Date String (YYYY-MM-DD)
}

export function TimelineDay({ date, events, dayId }: TimelineDayProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: dayId,
        data: { type: 'day', dateStr: dayId }
    });

    return (
        <div className="flex flex-col gap-2 min-w-[320px] max-w-[320px] max-h-full flex-shrink-0 h-full"> {/* Height fixes for scrolling */}
            <div className={`sticky top-0 z-10 bg-background/95 backdrop-blur py-3 border-b mb-2 ${dayId === 'unscheduled' ? 'border-dashed border-muted-foreground/20' : ''}`}>
                <div className="flex flex-col items-center justify-center w-full">
                    {dayId === 'unscheduled' ? (
                        <h3 className="font-serif font-bold text-muted-foreground tracking-widest uppercase text-sm text-center">
                            Backlog
                        </h3>
                    ) : (
                        <div className="flex flex-col items-center text-center">
                            <h3 className="font-serif font-bold text-lg text-foreground">
                                {format(date, 'MMM d')}
                            </h3>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {format(date, 'EEEE')}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div
                ref={setNodeRef}
                className={`flex-1 min-h-[500px] rounded-lg p-2 transition-colors ${isOver ? 'bg-muted/50' : 'bg-muted/10 border border-dashed border-muted'}`}
            >
                <SortableContext items={events.map(e => e.id)} strategy={verticalListSortingStrategy}>
                    {events.map(event => (
                        <TimelineEvent key={event.id} event={event} />
                    ))}
                    {events.length === 0 && (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic">
                            Drop items here
                        </div>
                    )}
                </SortableContext>
            </div>
        </div>
    );
}
