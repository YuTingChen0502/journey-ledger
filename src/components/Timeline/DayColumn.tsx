import { useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
// import { CSSProperties } from 'react';

interface DayColumnProps {
    date: Date;
    children?: React.ReactNode;
    className?: string;
    hourHeight?: number; // px per hour (responsive); defaults to desktop density
}

const START_HOUR = 6;
const HOURS_IN_DAY = 18; // 06:00 to 23:00

export function DayColumn({ date, children, className, hourHeight = 120 }: DayColumnProps) {
    const dayId = `day-${format(date, 'yyyy-MM-dd')}`;
    const { setNodeRef, isOver } = useDroppable({
        id: dayId,
        data: {
            type: 'day-column',
            date: date,
        },
    });

    // Grid lines for every hour
    const hours = Array.from({ length: HOURS_IN_DAY }, (_, i) => i + START_HOUR);

    return (
        <div
            ref={setNodeRef}
            style={{ height: `${hourHeight * HOURS_IN_DAY}px` }}
            className={cn(
                "relative flex-1 min-w-[120px] sm:min-w-[150px] border-r border-border/50",
                isOver ? "bg-accent/20" : "bg-background",
                className
            )}
        >
            {/* Background Grid Lines */}
            <div className="absolute inset-0 pointer-events-none">
                {hours.map((hour) => (
                    <div
                        key={hour}
                        className="absolute w-full border-t border-border/30 text-[10px] text-muted-foreground/30 pl-1"
                        style={{ top: `${(hour - START_HOUR) * hourHeight}px` }}
                    >
                        {/* Label could go here or in sidebar, keeping simple horizontal line */}
                    </div>
                ))}
            </div>

            {/* Events Layer */}
            <div className="relative w-full h-full">
                {children}
            </div>
        </div>
    );
}
