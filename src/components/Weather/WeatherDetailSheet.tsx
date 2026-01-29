import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Cloud, CloudFog, CloudLightning, CloudRain, Snowflake, Sun } from 'lucide-react';
import type { SpotWeatherData } from '@/hooks/useSpotWeather';
import { format, parseISO, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface WeatherDetailSheetProps {
    open: boolean;
    onClose: () => void;
    data: SpotWeatherData | null;
    locationName?: string;
}

export function WeatherDetailSheet({ open, onClose, data, locationName }: WeatherDetailSheetProps) {
    const { t } = useTranslation();

    if (!data) return null;

    // Helper: Icon Mapping (Reused)
    const getIcon = (code: number) => {
        if (code === 0 || code === 1) return { icon: Sun, color: 'text-amber-400' }; // Brighter for dark mode
        if (code >= 2 && code <= 3) return { icon: Cloud, color: 'text-gray-400' };
        if (code >= 45 && code <= 48) return { icon: CloudFog, color: 'text-gray-300' };
        if (code >= 51 && code <= 67) return { icon: CloudRain, color: 'text-blue-400' };
        if (code >= 71 && code <= 77) return { icon: Snowflake, color: 'text-cyan-300' };
        if (code >= 80 && code <= 82) return { icon: CloudRain, color: 'text-blue-500' };
        if (code >= 95) return { icon: CloudLightning, color: 'text-purple-400' };
        return { icon: Cloud, color: 'text-gray-400' };
    };

    // Prepare Daily Data (Exclude Today, Show Next 7 Days)
    const today = new Date();
    const dailyIndices = (data.daily?.time || []).map((t, i) => ({ t, i }))
        .filter(({ t }) => {
            const date = parseISO(t);
            // Compare YYYY-MM-DD strings for stability across timezones
            return format(date, 'yyyy-MM-dd') > format(today, 'yyyy-MM-dd');
        })
        .slice(0, 7);

    // Find Index for Today (for Header H/L)
    const todayIndex = (data.daily?.time || []).findIndex(t =>
        format(parseISO(t), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    );
    // Fallback to 0 if today not found (unlikely) or just use 0 if data starts today
    const safeDailyIndex = todayIndex >= 0 ? todayIndex : 0;

    // Hourly Data (Next 24 Hours)
    // Filter hourly to start from now or close to now
    // Fix: Ensure we don't accidentally filter everything if timezones drift.
    // Logic: t >= currentHourISO
    const currentHourISO = new Date().toISOString().slice(0, 13); // "2024-01-30T10"
    const hourlyIndices = (data.hourly?.time || []).map((t, i) => ({ t, i }))
        .filter(({ t }) => t >= currentHourISO)
        .slice(0, 24);

    const currentIcon = getIcon(data.code);
    const WeatherIcon = currentIcon.icon;

    // Precipitation Logic
    const popToday = data.daily?.precipitation_probability_max?.[safeDailyIndex] ?? 0;
    const showRainChance = popToday > 20 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(data.code);

    return (
        <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
            <SheetContent
                side="bottom"
                className="h-[85vh] w-full max-w-none sm:max-w-md mx-auto p-0 border-t-0 rounded-t-[2rem] bg-gradient-to-br from-[#581c26] to-[#1a0509] text-white border-white/10 shadow-2xl"
            >
                {/* Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-1 shrink-0 z-10 relative">
                    <div className="w-12 h-1.5 rounded-full bg-white/20" />
                </div>

                <div className="flex flex-col h-full w-full overflow-hidden relative">
                    {/* Background Noise Texture (Subtle) */}
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>

                    {/* Main Content - Native Scroll for Mobile Robustness */}
                    <div className="flex-1 overflow-y-auto px-5 pb-10 space-y-6 scrollbar-hide w-full relative z-10 overscroll-contain">

                        {/* Header: Main Status (Now integrated into scroll view) */}
                        <div className="flex flex-col items-center justify-center py-6 space-y-2 shrink-0 relative z-10 w-full">
                            <div className="text-2xl font-serif font-medium tracking-wide text-white/90 drop-shadow-sm">
                                {locationName || "Location"}
                            </div>
                            <div className="flex flex-col items-center">
                                {/* Gold Accent for Icon */}
                                <WeatherIcon className={cn("w-20 h-20 mb-2 drop-shadow-md", data.code <= 1 ? "text-amber-300" : currentIcon.color)} />
                                <div className="text-8xl font-thin tracking-tighter text-white drop-shadow-lg">
                                    {Math.round(data.temp)}°
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className="text-xl font-medium text-white/80 font-serif">
                                        {t(`wmo.${data.code}` as any) || "Clear"}
                                    </div>
                                    {showRainChance && (
                                        <div className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold tracking-wide flex items-center gap-1">
                                            <CloudRain className="w-3 h-3" />
                                            {popToday}% Chance
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-6 text-base font-medium text-white/60 mt-3">
                                    <span className="flex items-center gap-1"><span className="text-white/40">H:</span> {Math.round(data.daily?.temperature_2m_max[safeDailyIndex] ?? 0)}°</span>
                                    <span className="flex items-center gap-1"><span className="text-white/40">L:</span> {Math.round(data.daily?.temperature_2m_min[safeDailyIndex] ?? 0)}°</span>
                                </div>
                            </div>
                        </div>

                        {/* Short Text Summary */}
                        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 text-sm leading-relaxed border border-white/10 shadow-sm">
                            <span className="font-serif text-amber-200/80 block mb-1 text-xs uppercase tracking-widest">Forecast</span>
                            {t(`wmo.${data.hourly?.weather_code[hourlyIndices[0]?.i || 0]}` as any) || "Clear"} conditions expected around 12:00 AM.
                            Wind gusts up to {10} km/h.
                        </div>

                        {/* Hourly Forecast (Scroll) */}
                        <div className="py-2 border-y border-white/5 -mx-5 px-5">
                            <ScrollArea className="w-full whitespace-nowrap pb-2">
                                <div className="flex gap-7 px-1">
                                    {hourlyIndices.map(({ t: timeStr, i }) => {
                                        const code = data.hourly.weather_code[i];
                                        const { icon: HIcon, color: HColor } = getIcon(code);
                                        // Gold accent override for sun in hourly
                                        const finalColor = code <= 1 ? "text-amber-300/90" : HColor;

                                        return (
                                            <div key={timeStr} className="flex flex-col items-center gap-3 min-w-[3.5rem] py-2">
                                                <span className="text-xs font-semibold text-white/70">
                                                    {format(parseISO(timeStr), 'h a')}
                                                </span>
                                                <HIcon className={cn("w-7 h-7", finalColor)} />
                                                <span className="text-lg font-bold text-white/90">
                                                    {Math.round(data.hourly.temperature_2m[i])}°
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <ScrollBar orientation="horizontal" className="bg-white/5 h-1.5" />
                            </ScrollArea>
                        </div>

                        {/* 7-Day Forecast */}
                        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 space-y-5 shadow-sm">
                            <div className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2 mb-1">
                                <Cloud className="w-3 h-3" /> 7-Day Forecast
                            </div>

                            {dailyIndices.map(({ t: timeStr, i }) => {
                                const code = data.daily.weather_code[i];
                                const min = data.daily.temperature_2m_min[i];
                                const max = data.daily.temperature_2m_max[i];
                                const pop = data.daily.precipitation_probability_max[i];
                                const { icon: DIcon, color: DColor } = getIcon(code);
                                const finalColor = code <= 1 ? "text-amber-300/80" : DColor;

                                // Bar Visualization
                                const range = 40;
                                const leftPct = ((min + 5) / range) * 100;
                                const widthPct = ((max - min) / range) * 100;

                                return (
                                    <div key={timeStr} className="flex items-center justify-between h-9 group">
                                        <div className="w-14 font-semibold text-white/90 text-sm">
                                            {isSameDay(parseISO(timeStr), today) ? "Today" : format(parseISO(timeStr), 'eee')}
                                        </div>

                                        <div className="flex items-center justify-center w-10 flex-col gap-0.5">
                                            <DIcon className={cn("w-5 h-5", finalColor)} />
                                            {/* Always show rain % if > 0 for this row */}
                                            {pop > 0 && (
                                                <span className="text-[9px] font-bold text-blue-300">{pop}%</span>
                                            )}
                                        </div>

                                        <div className="flex-1 flex items-center gap-3 ml-4">
                                            <span className="text-sm font-medium text-white/50 w-6 text-right">{Math.round(min)}°</span>

                                            {/* Temp Bar (Gold/Gradient) */}
                                            <div className="flex-1 h-1 bg-white/10 rounded-full relative overflow-hidden">
                                                <div
                                                    className="absolute h-full rounded-full bg-gradient-to-r from-amber-200/60 to-amber-500/80 opacity-90 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                                                    style={{
                                                        left: `${Math.max(0, leftPct)}%`,
                                                        width: `${Math.max(5, widthPct)}%`
                                                    }}
                                                />
                                            </div>

                                            <span className="text-sm font-medium text-white w-6 text-left">{Math.round(max)}°</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
