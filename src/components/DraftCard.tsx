import type { ImportCandidate } from '@/types';
import { Card, CardContent, CardHeader } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from './ui/label';

interface DraftCardProps {
    candidate: ImportCandidate;
    onUpdate: (id: string, data: Partial<ImportCandidate['parsedData']>) => void;
    onToggleSelect: (id: string) => void;
}

export function DraftCard({ candidate, onUpdate, onToggleSelect }: DraftCardProps) {
    return (
        <Card className={`relative transition-colors ${candidate.isSelected ? 'border-primary' : 'opacity-70'}`}>
            <div className="absolute top-3 left-3 z-10">
                <Checkbox
                    checked={candidate.isSelected}
                    onCheckedChange={() => onToggleSelect(candidate.id)}
                />
            </div>
            <CardHeader className="pb-2 pl-10 pt-3">
                <div className="flex gap-2">
                    <div className="w-24 shrink-0">
                        <Label htmlFor={`time-${candidate.id}`} className="sr-only">Time</Label>
                        <Input
                            id={`time-${candidate.id}`}
                            value={candidate.parsedData.time || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(candidate.id, { time: e.target.value })}
                            placeholder="Time"
                            className="h-8"
                        />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Input
                                type="date"
                                className="h-6 w-32 text-[10px] px-1 py-0 font-mono"
                                value={candidate.parsedData.date || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(candidate.id, { date: e.target.value })}
                            />
                            <Label htmlFor={`title-${candidate.id}`} className="sr-only">Title</Label>
                        </div>
                        <Input
                            id={`title-${candidate.id}`}
                            value={candidate.parsedData.title}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(candidate.id, { title: e.target.value })}
                            placeholder="Event Title"
                            className="h-8 font-medium"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pb-3 pl-10">
                <Textarea
                    value={candidate.parsedData.note || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate(candidate.id, { note: e.target.value })}
                    placeholder="Notes..."
                    className="min-h-[60px] text-sm resize-none"
                />
            </CardContent>
        </Card>
    );
}
