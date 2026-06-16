import { useState } from 'react';
import type { ImportCandidate } from '@/types';
import { parseRawText } from '@/lib/parser';
import { DraftCard } from './DraftCard';
import { Button } from './ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { useRxCollection } from 'rxdb-hooks';
import type { TripEventDocType } from '@/db/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { canAddEvents, getRemainingEventCapacity, QUOTAS } from '@/lib/quotas';


import { useAuth } from '@/context/AuthContext';

interface ImportModalProps {
    children?: React.ReactNode;
    defaultDate?: Date;
    tripId: string; // We need to know which trip to add to
    workspaceType?: 'personal' | 'group';
    workspaceId?: string;
    tripStartDate?: string; // YYYY-MM-DD — used to keep imports within the trip range
    tripEndDate?: string;   // YYYY-MM-DD
    // userId: string; // Removed, use context
    onImportSuccess?: () => void;
    userId?: string; // Optional for compatibility if passed, but ignored in favor of context
}

export function ImportModal({
    children,
    defaultDate = new Date(),
    tripId,
    workspaceType,
    workspaceId,
    tripStartDate,
    tripEndDate,
    onImportSuccess
}: ImportModalProps) {
    const { user } = useAuth();
    const userId = user?.id || 'guest';
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<'INPUT' | 'STAGING'>('INPUT');
    const [rawText, setRawText] = useState('');
    const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
    const [targetDate, setTargetDate] = useState<Date | undefined>(defaultDate);
    const [isImporting, setIsImporting] = useState(false);

    // RxDB Collection
    const collection = useRxCollection<TripEventDocType>('tripevents');

    const handleAnalyze = () => {
        const parsed = parseRawText(rawText);
        // Apply default date if missing
        const formattedDefault = targetDate ? format(targetDate, "yyyy-MM-dd") : undefined;

        const cached = parsed.map(p => ({
            ...p,
            parsedData: {
                ...p.parsedData,
                date: p.parsedData.date || formattedDefault
            }
        }));

        setCandidates(cached);
        setStep('STAGING');
    };

    const handleUpdateCandidate = (id: string, data: Partial<ImportCandidate['parsedData']>) => {
        setCandidates(prev => prev.map(c =>
            c.id === id ? { ...c, parsedData: { ...c.parsedData, ...data } } : c
        ));
    };

    const handleToggleSelect = (id: string) => {
        setCandidates(prev => prev.map(c =>
            c.id === id ? { ...c, isSelected: !c.isSelected } : c
        ));
    };

    const handleCommit = async (mode: 'SCHEDULE' | 'BACKLOG') => {
        if (isImporting) return; // guard against double-submit
        console.log("Starting Import Commit (RxDB Local-First)...", { mode, candidatesCount: candidates.length });
        const selected = candidates.filter(c => c.isSelected);

        if (selected.length === 0) {
            toast.error("No items selected for import");
            return;
        }

        // Quota guard (UX only): block the WHOLE batch if it would exceed the
        // per-trip event cap. No partial import.
        const existingEvents = await collection?.find({
            selector: { trip_id: { $eq: tripId }, is_deleted: { $eq: false } }
        }).exec();
        const currentCount = existingEvents?.length ?? 0;
        if (!canAddEvents(currentCount, selected.length)) {
            const remaining = getRemainingEventCapacity(currentCount);
            toast.error(`Import blocked: ${remaining} of ${QUOTAS.maxEventsPerTrip} event slots left in this trip, but ${selected.length} selected.`);
            return;
        }

        const eventsToInsert: TripEventDocType[] = selected.map(c => {
            let startTime = null;
            let isFloating = true;

            // Determine Date Logic
            if (mode === 'SCHEDULE') {
                const dateString = c.parsedData.date || (targetDate ? format(targetDate, "yyyy-MM-dd") : null);

                if (dateString && c.parsedData.time) {
                    try {
                        // Phase 4: keep imports inside the selected trip's range. A
                        // scheduled date outside [tripStartDate, tripEndDate] is sent
                        // to the backlog (floating) instead of landing on a wrong day.
                        const inRange =
                            !tripStartDate || !tripEndDate ||
                            (dateString >= tripStartDate && dateString <= tripEndDate);

                        if (inRange) {
                            const [hours, minutes] = c.parsedData.time.split(':').map(Number);
                            const date = new Date(dateString);
                            date.setHours(hours, minutes, 0, 0);
                            startTime = date.toISOString();
                            isFloating = false;
                        } else {
                            isFloating = true;
                        }
                    } catch (e) {
                        console.error("Date parsing error", e);
                        // Fallback to floating if date parse fails
                        isFloating = true;
                    }
                } else {
                    // If no date/time found, force to floating (Backlog)
                    isFloating = true;
                }
            } else {
                // BACKLOG mode always floating
                isFloating = true;
            }

            return {
                id: nanoid(),
                trip_id: tripId,
                owner_id: userId,
                title: c.parsedData.title,
                description: c.parsedData.note || '', // Ensure not undefined
                location: c.parsedData.location || '',
                is_floating: isFloating,
                start_time: startTime || '', // Schema might expect string
                sort_order: 'n',
                created_at: Date.now(),
                updated_at: Date.now(),
                is_deleted: false,
                workspace_type: workspaceType,
                workspace_id: workspaceId
            };
        });

        console.log("Prepared Events for RxDB Insert:", JSON.stringify(eventsToInsert, null, 2));

        if (eventsToInsert.length > 0 && collection) {
            setIsImporting(true);
            try {
                // Bulk Insert to RxDB
                await collection.bulkInsert(eventsToInsert);

                console.log("RxDB Insert Success");
                toast.success(`Successfully imported ${eventsToInsert.length} items to local DB`);
                setIsOpen(false);
                // Reset state
                setStep('INPUT');
                setRawText('');
                setCandidates([]);

                // Trigger Redirect
                if (onImportSuccess) {
                    onImportSuccess();
                }
            } catch (err: unknown) {
                console.error("RxDB Insert Error:", err);
                const message = err instanceof Error ? err.message : 'Unknown Db Error';
                toast.error(`Import failed: ${message}`);
            } finally {
                setIsImporting(false);
            }
        } else if (!collection) {
            console.error("RxDB Collection not found");
            toast.error("Database connection not ready");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children || <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> {t('btn.import')}</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('import.title')}</DialogTitle>
                </DialogHeader>

                {step === 'INPUT' && (
                    <div className="flex flex-col gap-4 flex-1">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">{t('import.date_label')}</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[240px] justify-start text-left font-normal",
                                            !targetDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {targetDate ? format(targetDate, "PPP") : <span>{t('import.pick_date')}</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={targetDate}
                                        onSelect={setTargetDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="text-xs text-muted-foreground">{t('import.fallback_hint')}</span>
                        </div>
                        <Textarea
                            placeholder={t('import.placeholder')}
                            className="flex-1 min-h-[300px] font-mono"
                            value={rawText}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRawText(e.target.value)}
                        />
                        <div className="flex justify-end">
                            <Button onClick={handleAnalyze} disabled={!rawText.trim()}>
                                {t('import.btn.analyze')}
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'STAGING' && (
                    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
                        <div className="flex items-center justify-between border-b pb-4">
                            <h3 className="font-semibold">{t('import.review.title')}</h3>
                            <Button variant="ghost" onClick={() => setStep('INPUT')}>
                                {t('import.btn.back')}
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-1">
                            {Object.entries(
                                candidates.reduce((acc, candidate) => {
                                    const key = candidate.parsedData.date || 'Unscheduled';
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(candidate);
                                    return acc;
                                }, {} as Record<string, ImportCandidate[]>)
                            ).sort((a, b) => a[0].localeCompare(b[0])).map(([dateKey, groupCandidates]) => (
                                <div key={dateKey} className="mb-6">
                                    <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                        {dateKey === 'Unscheduled' ? (
                                            <span className="bg-muted px-2 py-0.5 rounded text-xs">Unscheduled</span>
                                        ) : (
                                            <>
                                                <CalendarIcon className="w-3 h-3" />
                                                {format(new Date(dateKey), 'EEEE, MMMM do')}
                                            </>
                                        )}
                                        <span className="text-xs font-normal opacity-50">({groupCandidates.length} items)</span>
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {groupCandidates.map(candidate => (
                                            <DraftCard
                                                key={candidate.id}
                                                candidate={candidate}
                                                onUpdate={handleUpdateCandidate}
                                                onToggleSelect={handleToggleSelect}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="secondary" onClick={() => handleCommit('BACKLOG')} disabled={isImporting}>
                                {t('import.btn.backlog')}
                            </Button>
                            <Button onClick={() => handleCommit('SCHEDULE')} disabled={!targetDate || isImporting}>
                                {t('import.btn.schedule')}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
