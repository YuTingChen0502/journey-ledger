import { useState, useEffect, useCallback } from 'react';
import { useRxCollection } from 'rxdb-hooks';
import type { TripEventDocType, TodoItem } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
    Calendar as CalendarIcon,
    Clock,
    Trash2,
    Ticket,
    Navigation,
    CheckSquare,
    Plus,
} from 'lucide-react';
import { generateNavUrl } from '@/lib/navigationUtils';
import { format } from 'date-fns';
import { safeParseISO } from '@/lib/dateUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SpotWeather } from '@/components/Weather/SpotWeather';
import { searchLocation } from '@/services/geocoding';
import { toast } from 'sonner';
import { canAddChecklistItem, isMemoWithinLimit, QUOTAS } from '@/lib/quotas';

interface EventDetailViewProps {
    eventId: string | null;
    open: boolean;
    onClose: () => void;
}

import { useTranslation, type TranslationKey } from '@/hooks/useTranslation';

// Categories moved inside component or mapped dynamically because they need `t` context
// But simpler: keep static values, map labels during render.
const CATEGORY_KEYS: { value: string, labelKey: TranslationKey, color: string }[] = [
    { value: 'sightseeing', labelKey: 'cat.sightseeing', color: 'bg-blue-100 text-blue-800' },
    { value: 'food', labelKey: 'cat.food', color: 'bg-orange-100 text-orange-800' },
    { value: 'shopping', labelKey: 'cat.shopping', color: 'bg-pink-100 text-pink-800' },
    { value: 'activity', labelKey: 'cat.activity', color: 'bg-green-100 text-green-800' },
    { value: 'transport', labelKey: 'cat.transport', color: 'bg-gray-100 text-gray-800' },
    { value: 'other', labelKey: 'cat.other', color: 'bg-slate-100 text-slate-800' },
];

export function EventDetailView({ eventId, open, onClose }: EventDetailViewProps) {
    const { t } = useTranslation();
    const collection = useRxCollection<TripEventDocType>('tripevents');
    const [event, setEvent] = useState<TripEventDocType | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState<string>('other');
    const [image, setImage] = useState<string | null>(null);
    const [lat, setLat] = useState<number | undefined>(undefined);
    const [lng, setLng] = useState<number | undefined>(undefined);
    const [memo, setMemo] = useState('');
    const [todos, setTodos] = useState<TodoItem[]>([]);

    // Fetch Event
    useEffect(() => {
        // When closed or with no event, the component renders null anyway, so we
        // simply skip fetching (avoids a synchronous setState in the effect).
        if (!eventId || !open) {
            return;
        }

        const fetchEvent = async () => {
            const doc = await collection?.findOne(eventId).exec();
            if (doc) {
                const data = doc.toJSON() as TripEventDocType;
                setEvent(data);
                setTitle(data.title || '');
                setDescription(data.description || '');
                setLocation(data.location || '');
                setCategory(data.category || 'other');
                setImage(data.image || null);
                setLat(data.lat);
                setLng(data.lng);
                setMemo(data.memo || '');

                // Initialize checks with 3 empty items if empty
                // Fix readonly array issue by creating copy
                const initialTodos = data.todos && data.todos.length > 0 ? [...data.todos] : [
                    { id: crypto.randomUUID(), text: '', is_checked: false },
                    { id: crypto.randomUUID(), text: '', is_checked: false },
                    { id: crypto.randomUUID(), text: '', is_checked: false }
                ];
                setTodos(initialTodos);
            }
        };

        fetchEvent();
        fetchEvent();
    }, [eventId, open, collection]);

    // Atomic Updates. Declared (memoized) before the effects that use it so it
    // can be a stable dependency.
    const updateField = useCallback(async (field: Partial<TripEventDocType>) => {
        if (!event || !collection) return;

        try {
            const doc = await collection.findOne(event.id).exec();
            await doc?.incrementalPatch({
                ...field,
                updated_at: Date.now()
            });
            // We rely on the next open to re-fetch; local state gives instant
            // feedback in the meantime.
        } catch (err) {
            console.error('Failed to update event', err);
        }
    }, [event, collection]);

    // Added: Auto-geocoding on mount if location is set but no coords (covers legacy data)
    useEffect(() => {
        if (open && location && (!lat || !lng)) {
            // Smart Auto-Geocoding (tries venue, then cleaner strings, then city)
            searchLocation(location).then(result => {
                if (result) {
                    setLat(result.latitude);
                    setLng(result.longitude);
                    updateField({ lat: result.latitude, lng: result.longitude });
                }
            }).catch(() => { });
        }
    }, [open, eventId, location, lat, lng, updateField]);

    const handleTitleChange = (v: string) => {
        setTitle(v);
        // Debounce could be added here, but for now simple onBlur or immediate update is fine.
    };

    const handleBlurTitle = () => updateField({ title });
    const handleBlurDesc = () => updateField({ description });
    const handleChangeCategory = (val: string) => {
        setCategory(val);
        updateField({ category: val });
    };

    const handleBlurLoc = async () => {
        updateField({ location });

        // Auto-Geocoding if lat/lng are missing
        if (location && (!lat || !lng)) {
            searchLocation(location).then(result => {
                if (result) {
                    setLat(result.latitude);
                    setLng(result.longitude);
                    updateField({ lat: result.latitude, lng: result.longitude });
                }
            });
        }
    };

    const handleBlurMemo = () => {
        if (!isMemoWithinLimit(memo)) {
            toast.error(`Memo is too long (max ${QUOTAS.maxMemoLength} characters).`);
            return;
        }
        updateField({ memo });
    };

    const handleTodoChange = (id: string, text: string) => {
        const newTodos = todos.map(t => t.id === id ? { ...t, text } : t);
        setTodos(newTodos);
    };

    const handleTodoToggle = (id: string) => {
        const newTodos = todos.map(t => t.id === id ? { ...t, is_checked: !t.is_checked } : t);
        setTodos(newTodos);
        updateField({ todos: newTodos });
    };

    const handleTodoBlur = () => {
        // Filter out empty ones only if we have too many? No, user wants them.
        // Just save everything.
        updateField({ todos });
    };

    const handleAddTodo = () => {
        if (!canAddChecklistItem(todos.length)) {
            toast.error(`Checklist limit reached (max ${QUOTAS.maxChecklistItemsPerEvent} items).`);
            return;
        }
        const newTodos = [...todos, { id: crypto.randomUUID(), text: '', is_checked: false }];
        setTodos(newTodos);
        // Don't save yet, wait for blur
    };

    const handleDeleteTodo = (id: string) => {
        const newTodos = todos.filter(t => t.id !== id);
        setTodos(newTodos);
        updateField({ todos: newTodos });
    };



    // Phase 5: photo/base64 upload removed (non-core). Existing `image` data is
    // still read-only below for backward compatibility; no new images are written.

    const handleDelete = async () => {
        if (!event || !collection) return;
        if (confirm(t('detail.confirm_delete'))) {
            const doc = await collection.findOne(event.id).exec();
            await doc?.incrementalPatch({ is_deleted: true, updated_at: Date.now() });
            onClose();
        }
    };

    const navUrl = generateNavUrl(event?.place_id, location);

    if (!open) return null;

    return (
        <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
            <SheetContent
                className="w-full sm:max-w-xl p-0 gap-0 overflow-y-auto bg-background/95 backdrop-blur-md border-l border-border/50 shadow-2xl"
            // Prevent auto-focus on open to keep the 'journal' feel calm
            // onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {/* Scroll Lock Wrapper handled by Sheet automatically usually, but we ensure structure */}
                <div className="flex flex-col min-h-full sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border/40">

                    {/* LEFT COLUMN: Entry Data (Journal Side) */}
                    <div className="flex-1 p-6 flex flex-col gap-6 relative">
                        {/* Close button provided by Sheet usually, but we can customize or let default be */}

                        {/* Header: Date - Category - Weather Row */}
                        <div className="flex items-end gap-4 flex-wrap sm:flex-nowrap">
                            {/* 1. Date */}
                            <div className="flex flex-col shrink-0">
                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">
                                    {t('detail.label.date')}
                                </span>
                                <div className="text-sm font-semibold text-foreground flex items-center gap-2 whitespace-nowrap h-9">
                                    <CalendarIcon className="w-4 h-4 text-primary/70" />
                                    {event?.start_time ? format(safeParseISO(event.start_time)!, 'MMM d, yyyy') : 'No Date'}
                                </div>
                            </div>

                            {/* 2. Category */}
                            <Select value={category} onValueChange={handleChangeCategory}>
                                <SelectTrigger className="w-[140px] h-9 border-dashed border-2 rounded-sm bg-secondary/20 hover:bg-secondary/40 transition-colors focus:ring-0 text-xs font-medium uppercase tracking-wide shrink-0">
                                    <SelectValue placeholder={t('detail.category.placeholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORY_KEYS.map(c => (
                                        <SelectItem key={c.value} value={c.value} className="text-xs">
                                            {t(c.labelKey)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* 3. Weather */}
                            {((lat && lng) || location) && (
                                <div className="shrink-0 pb-1">
                                    {lat && lng ? (
                                        <SpotWeather lat={lat} lng={lng} time={event?.start_time} />
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground animate-pulse px-3 py-1.5 bg-muted/30 rounded-full whitespace-nowrap">
                                            Loading...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>



                        {/* Title Section */}



                        {/* Title Section */}
                        <div className="space-y-2">
                            <Input
                                className="text-3xl font-serif font-bold bg-transparent border-0 px-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40 leading-tight"
                                placeholder={t('detail.title.placeholder')}
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                onBlur={handleBlurTitle}
                            />
                            <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                                <Clock className="w-4 h-4" />
                                {event?.start_time ? format(safeParseISO(event.start_time)!, 'HH:mm') : '--:--'}
                                {' - '}
                                {event?.end_time ? format(safeParseISO(event.end_time)!, 'HH:mm') : '--:--'}
                            </div>
                        </div>

                        {/* Navigation Ticket */}
                        <div className="bg-card/50 rounded-lg border-2 border-dashed border-border p-4 relative group">
                            {/* Visual Notches */}
                            <div className="absolute top-1/2 -left-2 w-4 h-4 bg-background rounded-full -translate-y-1/2 border-r border-border" />
                            <div className="absolute top-1/2 -right-2 w-4 h-4 bg-background rounded-full -translate-y-1/2 border-l border-border" />

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                                    <Ticket className="w-3 h-3" />
                                    {t('detail.label.destination')}
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        className="bg-transparent border-0 border-b border-border rounded-none px-0 h-8 focus-visible:ring-0 focus-visible:border-primary font-medium"
                                        placeholder={t('detail.location.placeholder')}
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        onBlur={handleBlurLoc}
                                    />
                                </div>


                                <Button
                                    className="w-full mt-2 bg-primary/90 hover:bg-primary shadow-sm active:scale-[0.98] transition-all"
                                    onClick={() => window.open(navUrl, '_blank', 'noopener,noreferrer')}
                                    title={!navigator.onLine ? "You are offline" : "Open in Google Maps"}
                                >
                                    <Navigation className="w-4 h-4 mr-2" />
                                    {t('detail.btn.start_journey')}
                                </Button>
                            </div>
                        </div>





                        {/* Journal Notes (Dot Grid) */}
                        <div className="flex-1 min-h-[150px] relative rounded-md overflow-hidden bg-muted/5 group">
                            {/* Dot Grid Pattern */}
                            <div className="absolute inset-0 opacity-[0.15] pointer-events-none"
                                style={{
                                    backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
                                    backgroundSize: '20px 20px'
                                }}
                            />
                            <Textarea
                                className="w-full h-full bg-transparent border-0 resize-none focus-visible:ring-0 p-4 text-sm leading-relaxed"
                                placeholder={t('detail.notes.placeholder')}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                onBlur={handleBlurDesc}
                            />
                        </div>

                        {/* Checklist Section */}
                        <div className="flex flex-col gap-2 relative group/checklist">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                                <CheckSquare className="w-4 h-4" />
                                {t('detail.label.checklist') || 'Checklist'}
                            </div>
                            <div className="flex flex-col gap-2">
                                {todos.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleTodoToggle(item.id)}
                                            className={`w-4 h-4 rounded-sm border transition-colors flex items-center justify-center ${item.is_checked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'}`}
                                        >
                                            {item.is_checked && <CheckSquare className="w-3 h-3" />}
                                        </button>
                                        <div className="flex-1 relative">
                                            <Input
                                                className={`bg-transparent border-0 border-b border-border/40 rounded-none px-0 h-7 text-sm focus-visible:ring-0 focus-visible:border-primary ${item.is_checked ? 'text-muted-foreground line-through decoration-muted-foreground/50' : ''}`}
                                                value={item.text}
                                                onChange={(e) => handleTodoChange(item.id, e.target.value)}
                                                onBlur={handleTodoBlur}
                                                placeholder={t('detail.checklist.placeholder') || "Item..."}
                                            />
                                            {/* Delete button appears on hover */}
                                            <button
                                                onClick={() => handleDeleteTodo(item.id)}
                                                className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/checklist:opacity-100 hover:text-destructive transition-opacity p-1"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="self-start text-xs text-muted-foreground/60 hover:text-primary gap-1 pl-0 h-6"
                                    onClick={handleAddTodo}
                                >
                                    <Plus className="w-3 h-3" /> Add Item
                                </Button>
                            </div>
                        </div>

                        {/* Memo Section */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                {t('detail.label.memo') || 'Memo'}
                            </div>
                            <Textarea
                                className="bg-muted/10 border-border/40 min-h-[100px] resize-none focus-visible:ring-0 focus-visible:border-primary"
                                placeholder={t('detail.memo.placeholder') || "Write notes here..."}
                                value={memo}
                                maxLength={QUOTAS.maxMemoLength}
                                onChange={(e) => setMemo(e.target.value)}
                                onBlur={handleBlurMemo}
                            />
                        </div>

                        {/* Footer Action */}
                        <div className="flex justify-end pt-2">
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive text-xs" onClick={handleDelete}>
                                <Trash2 className="w-3 h-3 mr-1" />
                                {t('detail.btn.remove')}
                            </Button>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Souvenir (Polaroid Side) */}
                    {/* Phase 5: photo upload removed. Existing images render read-only. */}
                    <div className="sm:w-[40%] bg-muted/10 p-6 flex flex-col items-center justify-center gap-6 border-l border-dashed border-border/50">
                        {image && (
                            <div className="relative transition-transform duration-500 rotate-1">
                                <div className="bg-white dark:bg-zinc-100 p-3 pb-8 shadow-xl rounded-sm w-48 sm:w-56">
                                    <div className="aspect-square bg-zinc-100 dark:bg-zinc-200 overflow-hidden relative rounded-sm border border-zinc-200">
                                        <img src={image} alt="Memory" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                {/* Tape effect (purely decorative CSS) */}
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-yellow-100/30 dark:bg-white/10 backdrop-blur-sm -rotate-2 shadow-sm border border-white/10" />
                            </div>
                        )}

                        <div className="text-center space-y-1">
                            <p className="text-xs text-muted-foreground italic">
                                "{t('detail.quote')}"
                            </p>
                        </div>
                    </div>
                </div >
            </SheetContent >
        </Sheet >
    );
}
