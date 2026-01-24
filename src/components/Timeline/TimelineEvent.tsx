import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TripEventDocType } from '@/db/schema';
import { format } from 'date-fns';
import { GripVertical } from 'lucide-react';
import DOMPurify from 'dompurify';

interface TimelineEventProps {
    event: TripEventDocType;
}

export function TimelineEvent({ event }: TimelineEventProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: event.id, data: { ...event } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Sanitize display content (though React escapes by default, this is good for rich text if added)
    // const cleanDescription = DOMPurify.sanitize(event.description || '');

    return (
        <div ref={setNodeRef} style={style} className="mb-2">
            <Card className="hover:shadow-md transition-shadow cursor-default bg-card">
                <CardContent className="p-3 flex items-start gap-3">
                    <div {...attributes} {...listeners} className="mt-1 cursor-grab text-muted-foreground hover:text-foreground">
                        <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-sm truncate">{event.title}</h4>
                            {event.is_floating && <Badge variant="outline" className="text-[10px] px-1 h-5">Unscheduled</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                            {!event.is_floating && event.start_time && (
                                <span>{format(new Date(event.start_time), 'HH:mm')}</span>
                            )}
                            {event.location && (
                                <span className="truncate max-w-[150px]">{DOMPurify.sanitize(event.location)}</span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
