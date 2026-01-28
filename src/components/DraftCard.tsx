import { useState } from 'react';
import type { ImportCandidate } from '@/types';
import { Card, CardContent, CardHeader } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraftCardProps {
    candidate: ImportCandidate;
    onUpdate: (id: string, data: Partial<ImportCandidate['parsedData']>) => void;
    onToggleSelect: (id: string) => void;
}

export function DraftCard({ candidate, onUpdate, onToggleSelect }: DraftCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <Card className={cn("relative transition-all duration-300", candidate.isSelected ? 'border-primary shadow-sm' : 'opacity-70 grayscale-[0.5]')}>
            <div className="absolute top-3 left-3 z-10">
                <Checkbox
                    checked={candidate.isSelected}
                    onCheckedChange={() => onToggleSelect(candidate.id)}
                />
            </div>
            <CardHeader className="pb-2 pl-10 pt-3 pr-3">
                <div className="flex gap-2">
                    <div className="w-20 shrink-0">
                        <Label htmlFor={`time-${candidate.id}`} className="sr-only">Time</Label>
                        <Input
                            id={`time-${candidate.id}`}
                            value={candidate.parsedData.time || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(candidate.id, { time: e.target.value })}
                            placeholder="--:--"
                            className="h-8 text-xs font-mono text-center"
                        />
                    </div>
                    <div className="flex-1 space-y-2">
                        {/* Title & Date */}
                        <div className="flex items-center gap-2">
                            <Input
                                id={`title-${candidate.id}`}
                                value={candidate.parsedData.title}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(candidate.id, { title: e.target.value })}
                                placeholder="Event Title"
                                className="h-8 font-semibold text-sm"
                            />
                        </div>

                        {/* Location Field */}
                        <div className="relative">
                            <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                            <Input
                                value={candidate.parsedData.location || ''}
                                onChange={(e) => onUpdate(candidate.id, { location: e.target.value })}
                                placeholder="Add location..."
                                className="h-7 pl-7 text-xs bg-muted/20 border-dashed focus:bg-background focus:border-solid transition-colors"
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pb-3 pl-10 pr-3">
                <div className="relative">
                    <Textarea
                        value={candidate.parsedData.note || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate(candidate.id, { note: e.target.value })}
                        placeholder="Description or notes..."
                        className={cn(
                            "min-h-[60px] text-xs resize-none transition-all duration-300",
                            !isExpanded && "line-clamp-2 h-[60px] overflow-hidden"
                        )}
                    />
                    {/* Expand Toggle */}
                    {(candidate.parsedData.note && candidate.parsedData.note.length > 50) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute bottom-1 right-1 h-5 w-5 bg-background/80 hover:bg-background shadow-sm rounded-full"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
