import { useState, useEffect } from 'react';
import { useRxCollection } from 'rxdb-hooks';
import type { TripEventDocType } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
    Calendar as CalendarIcon,
    Clock,
    Trash2,
    Image as ImageIcon,
    Ticket,
    Navigation,
} from 'lucide-react';
import { generateNavUrl } from '@/lib/navigationUtils';
import { format } from 'date-fns';
import { safeParseISO } from '@/lib/dateUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EventDetailViewProps {
    eventId: string | null;
    open: boolean;
    onClose: () => void;
}

const CATEGORIES = [
    { value: 'sightseeing', label: 'Sightseeing', color: 'bg-blue-100 text-blue-800' },
    { value: 'food', label: 'Food', color: 'bg-orange-100 text-orange-800' },
    { value: 'shopping', label: 'Shopping', color: 'bg-pink-100 text-pink-800' },
    { value: 'activity', label: 'Activity', color: 'bg-green-100 text-green-800' },
    { value: 'transport', label: 'Transport', color: 'bg-gray-100 text-gray-800' },
    { value: 'other', label: 'Other', color: 'bg-slate-100 text-slate-800' },
];

export function EventDetailView({ eventId, open, onClose }: EventDetailViewProps) {
    const collection = useRxCollection<TripEventDocType>('tripevents');
    const [event, setEvent] = useState<TripEventDocType | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState<string>('other');
    const [image, setImage] = useState<string | null>(null);

    // Fetch Event
    useEffect(() => {
        if (!eventId || !open) {
            setEvent(null);
            return;
        }

        const fetchEvent = async () => {
            const doc = await collection?.findOne(eventId).exec();
            if (doc) {
                const data = doc.toJSON();
                setEvent(data);
                setTitle(data.title || '');
                setDescription(data.description || '');
                setLocation(data.location || '');
                setCategory(data.category || 'other');
                setImage(data.image || null);
            }
        };

        fetchEvent();
    }, [eventId, open, collection]);

    // Atomic Updates
    const updateField = async (field: Partial<TripEventDocType>) => {
        if (!event || !collection) return;

        try {
            const doc = await collection.findOne(event.id).exec();
            await doc?.incrementalPatch({
                ...field,
                updated_at: Date.now()
            });
            // Update local state to reflect change immediately if needed, 
            // though RxDB usually propagates this via subscription if we were using it.
            // Here we just rely on the fact that next open will re-fetch, 
            // but for instant feedback in fields we use local state.
        } catch (err) {
            console.error('Failed to update event', err);
        }
    };

    const handleTitleChange = (v: string) => {
        setTitle(v);
        // Debounce could be added here, but for now simple onBlur or immediate update is fine.
    };

    const handleBlurTitle = () => updateField({ title });
    const handleBlurDesc = () => updateField({ description });
    const handleBlurLoc = () => updateField({ location });
    const handleChangeCategory = (val: string) => {
        setCategory(val);
        updateField({ category: val });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setImage(base64);
                updateField({ image: base64 });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDelete = async () => {
        if (!event || !collection) return;
        if (confirm('Are you sure you want to delete this event?')) {
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

                        {/* Header: Date Badge & Category Stamp */}
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                                    Date
                                </span>
                                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4" />
                                    {event?.start_time ? format(safeParseISO(event.start_time)!, 'MMM d, yyyy') : 'No Date'}
                                </div>
                            </div>

                            <Select value={category} onValueChange={handleChangeCategory}>
                                <SelectTrigger className="w-[140px] h-8 border-dashed border-2 rounded-sm bg-secondary/20 hover:bg-secondary/40 transition-colors focus:ring-0 text-xs font-medium uppercase tracking-wide">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => (
                                        <SelectItem key={c.value} value={c.value} className="text-xs">
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Title Section */}
                        <div className="space-y-2">
                            <Input
                                className="text-3xl font-serif font-bold bg-transparent border-0 px-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40 leading-tight"
                                placeholder="Event Title..."
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
                                    Destination
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        className="bg-transparent border-0 border-b border-border rounded-none px-0 h-8 focus-visible:ring-0 focus-visible:border-primary font-medium"
                                        placeholder="Location Name"
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
                                    Start Journey
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
                                placeholder="Jot down your memories or extensive notes here..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                onBlur={handleBlurDesc}
                            />
                        </div>

                        {/* Footer Action */}
                        <div className="flex justify-end pt-2">
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive text-xs" onClick={handleDelete}>
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove Entry
                            </Button>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Souvenir (Polaroid Side) */}
                    <div className="sm:w-[40%] bg-muted/10 p-6 flex flex-col items-center justify-center gap-6 border-l border-dashed border-border/50">
                        {/* Polaroid Frame */}
                        <div className="relative group cursor-pointer transition-transform duration-500 hover:rotate-0 rotate-1">
                            <div className="bg-white dark:bg-zinc-100 p-3 pb-8 shadow-xl rounded-sm w-48 sm:w-56 transition-all hover:shadow-2xl hover:scale-[1.02]">
                                <div className="aspect-square bg-zinc-100 dark:bg-zinc-200 overflow-hidden relative rounded-sm border border-zinc-200">
                                    {image ? (
                                        <img src={image} alt="Memory" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300">
                                            <ImageIcon className="w-8 h-8 mb-2" />
                                            <span className="text-[10px] uppercase tracking-wide">Add Photo</span>
                                        </div>
                                    )}
                                    {/* Invisible File Input Overlay */}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleImageUpload}
                                    />
                                </div>
                            </div>
                            {/* Tape effect (purely decorative CSS) */}
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-yellow-100/30 dark:bg-white/10 backdrop-blur-sm -rotate-2 shadow-sm border border-white/10" />
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-xs text-muted-foreground italic">
                                "Collect moments, not things."
                            </p>
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                                Nagoya, 2026
                            </p>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
