import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TripEventDocType } from '@/db/schema';
import { GripVertical, Trash2 } from 'lucide-react';
// DOMPurify removed
import { useRxCollection } from 'rxdb-hooks';
import { Button } from '@/components/ui/button';
import { safeFormatTime, safeParseISO } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import { addMinutes } from 'date-fns';

interface TimelineEventProps {
    event: TripEventDocType;
    style?: React.CSSProperties; // For absolute positioning
    className?: string;
    isOverlay?: boolean;
    previewTime?: string | null;
    onClick?: () => void;
}

const PPM = 2; // Share this constant or prop it

export function TimelineEvent({ event, style, className, isOverlay, previewTime, onClick }: TimelineEventProps) {
    const collection = useRxCollection<TripEventDocType>('tripevents');
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHeight, setResizeHeight] = useState<number | null>(null);
    const [resizePreviewLabel, setResizePreviewLabel] = useState<string | null>(null);

    // Refs for interaction state
    const resizingState = useRef<{
        startY: number;
        initialHeight: number;
        currentHeight: number;
    } | null>(null);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: event.id,
        data: { ...event },
        disabled: isResizing // Disable Drag when Resizing
    });

    const dragStyle: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : (isResizing ? 40 : 10),
        opacity: isDragging ? 0 : 1, // Hide original when dragging
        ...style,
    };

    const finalStyle = { ...dragStyle };
    if (isResizing && resizeHeight && !isOverlay) {
        finalStyle.height = `${resizeHeight}px`;
        finalStyle.zIndex = 40;
    }
    if (isOverlay) {
        finalStyle.opacity = 0.9;
        finalStyle.cursor = 'grabbing';
        finalStyle.zIndex = 999;
    }

    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const initialHeight = style?.height
            ? parseInt(style.height.toString())
            : 60;

        resizingState.current = {
            startY: e.clientY,
            initialHeight,
            currentHeight: initialHeight
        };

        setIsResizing(true);
        setResizeHeight(initialHeight);

        // Calculate Initial Label
        if (event.start_time) {
            const start = safeParseISO(event.start_time);
            if (start) {
                const durationMins = initialHeight / PPM;
                const end = addMinutes(start, durationMins);
                setResizePreviewLabel(`End: ${safeFormatTime(end.toISOString())}`);
            }
        }

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!resizingState.current) return;

        const { startY, initialHeight } = resizingState.current;
        const deltaY = e.clientY - startY;
        const rawNewHeight = initialHeight + deltaY;

        // Snap to 5m (10px)
        const snapped = Math.round(rawNewHeight / 10) * 10;
        const safeHeight = Math.max(30, snapped); // Min 15m (30px)

        resizingState.current.currentHeight = safeHeight;
        setResizeHeight(safeHeight);

        // Update Label
        if (event.start_time) {
            const start = safeParseISO(event.start_time);
            if (start) {
                const durationMins = safeHeight / PPM;
                const end = addMinutes(start, durationMins);
                setResizePreviewLabel(`End: ${safeFormatTime(end.toISOString())}`);
            }
        }
    };

    const onPointerUp = async () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        if (!resizingState.current) {
            setIsResizing(false);
            return;
        }

        const { initialHeight, currentHeight } = resizingState.current;

        // Commit if changed
        if (currentHeight !== initialHeight) {
            const durationMinutes = currentHeight / PPM;
            const start = safeParseISO(event.start_time);

            if (start) {
                const end = addMinutes(start, durationMinutes);
                const doc = await collection?.findOne(event.id).exec();
                await doc?.incrementalPatch({
                    end_time: end.toISOString(),
                    updated_at: Date.now()
                });
            }
        }

        setIsResizing(false);
        setResizeHeight(null);
        setResizePreviewLabel(null);
        resizingState.current = null;
    };


    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this event?')) {
            const doc = await collection?.findOne(event.id).exec();
            await doc?.incrementalPatch({ is_deleted: true, updated_at: Date.now() });
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={finalStyle}
            className={cn("absolute w-full px-1 cursor-pointer active:scale-[0.98] transition-transform", className)}
            onClick={() => {
                // Prevent click if we were just dragging or resizing (heuristic helpful here)
                // DnD kit might swallow clicks during drag, but let's be safe.
                if (!isDragging && !isResizing && onClick) {
                    console.log('TimelineEvent clicked', event.id);
                    onClick();
                }
            }}
        >
            {/* Time Indicator Badge */}
            {(isOverlay || isResizing) && (
                <Badge
                    variant="secondary"
                    className={cn(
                        "absolute z-50 shadow-md border-primary/50 text-[10px] whitespace-nowrap transition-all",
                        isResizing ? "-bottom-6 left-1/2 -translate-x-1/2" : "-top-3 -left-2"
                    )}
                >
                    {isResizing ? resizePreviewLabel : (previewTime || safeFormatTime(event.start_time))}
                </Badge>
            )}

            <Card className={cn(
                "h-full overflow-hidden transition-shadow select-none relative group",
                (isDragging || isOverlay) ? "shadow-xl ring-2 ring-primary" : "shadow-sm hover:shadow-lg cursor-pointer",
                "bg-card border-l-4 border-l-primary"
            )}>
                <CardContent className="p-2 flex flex-col h-full gap-1">
                    <div className="flex items-start justify-between gap-1">
                        {/* Drag Handle - Only active if NOT resizing */}
                        <div
                            {...attributes}
                            {...listeners}
                            className={cn("cursor-grab active:cursor-grabbing text-muted-foreground p-1 -m-1 hover:bg-muted rounded-full transition-colors", isResizing && "pointer-events-none")}
                            onClick={(e) => e.stopPropagation()} // Keep drag handle from triggering detail view
                        >
                            <GripVertical className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0 font-medium text-xs truncate">
                            {event.title}
                        </div>
                        {!isDragging && !isOverlay && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 -mr-1 -mt-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={handleDelete}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 text-[10px] text-muted-foreground leading-tight">
                        {event.start_time && <div>{safeFormatTime(event.start_time)}</div>}
                    </div>

                    {/* Resize Handle (Bottom) */}
                    {!isDragging && !isOverlay && (
                        <div
                            onPointerDown={handleResizeStart}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-0 left-0 w-full h-6 cursor-ns-resize flex items-end justify-center bg-transparent touch-none pb-1 hover:bg-primary/5 transition-colors"
                        >
                            {/* Always visible grip for mobile */}
                            <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
