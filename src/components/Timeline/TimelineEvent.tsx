import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TripEventDocType } from '@/db/schema';
import { format } from 'date-fns';
import { GripVertical, Trash2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useRxCollection } from 'rxdb-hooks';
import { Button } from '@/components/ui/button';

interface TimelineEventProps {
    event: TripEventDocType;
}

// Helper for safe date formatting
const safeFormatTime = (isoString: string | null | undefined) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Invalid';
        return format(date, 'HH:mm');
    } catch (e) {
        return 'Error';
    }
};

export function TimelineEvent({ event }: TimelineEventProps) {
    const collection = useRxCollection<TripEventDocType>('tripevents');

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

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent drag start or card click
        if (confirm('Delete this event?')) {
            const doc = await collection?.findOne(event.id).exec();
            await doc?.incrementalPatch({ is_deleted: true, updated_at: Date.now() });
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-2 relative group touch-none">
            <Card className="hover:shadow-md transition-shadow cursor-default bg-card">
                <CardContent className="p-3 flex items-start gap-3">
                    <div {...attributes} {...listeners} className="mt-1 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing">
                        <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-sm truncate">{event.title}</h4>
                            <div className="flex items-center gap-1">
                                {event.is_floating && <Badge variant="outline" className="text-[10px] px-1 h-5">Unscheduled</Badge>}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors"
                                    onClick={handleDelete}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                            {!event.is_floating && event.start_time && (
                                <span>{safeFormatTime(event.start_time)}</span>
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
