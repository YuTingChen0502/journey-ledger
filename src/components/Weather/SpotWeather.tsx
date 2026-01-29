import { useState } from 'react';
import { useSpotWeather } from '@/hooks/useSpotWeather';
import { useTranslation } from '@/hooks/useTranslation';
import { Sun, Cloud, CloudRain, Snowflake, CloudFog, CloudLightning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeatherDetailSheet } from './WeatherDetailSheet';

interface SpotWeatherProps {
    lat?: number;
    lng?: number;
    time?: string;
    className?: string;
    locationName?: string; // Opt
}

export function SpotWeather({ lat, lng, time, className, locationName }: SpotWeatherProps) {
    const { weather, loading } = useSpotWeather(lat, lng, time);
    const { t } = useTranslation();
    const [detailOpen, setDetailOpen] = useState(false);

    if (!lat || !lng) return null;

    // Initial fade-in logic
    if (loading) {
        return (
            <div className="animate-pulse bg-muted/20 h-6 w-24 rounded-sm" />
        );
    }

    if (!weather) return null;

    // Icon Mapping
    const getIcon = (code: number) => {
        if (code === 0 || code === 1) return { icon: Sun, color: 'text-amber-600/90' };
        if (code >= 2 && code <= 3) return { icon: Cloud, color: 'text-slate-500' };
        if (code >= 45 && code <= 48) return { icon: CloudFog, color: 'text-slate-400' };
        if (code >= 51 && code <= 67) return { icon: CloudRain, color: 'text-indigo-900/70' };
        if (code >= 71 && code <= 77) return { icon: Snowflake, color: 'text-sky-300' };
        if (code >= 80 && code <= 82) return { icon: CloudRain, color: 'text-blue-600' };
        if (code >= 95) return { icon: CloudLightning, color: 'text-purple-600' };
        return { icon: Cloud, color: 'text-muted-foreground' };
    };

    const { icon: WeatherIcon, color } = getIcon(weather.code);

    return (
        <>
            <div
                className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border border-dashed border-border/60 rounded-sm shadow-[1px_1px_2px_rgba(0,0,0,0.05)] transform -rotate-1 select-none animate-in fade-in zoom-in-95 duration-500 cursor-pointer hover:bg-white/80 transition-colors active:scale-95",
                    className
                )}
                onClick={(e) => {
                    e.stopPropagation(); // Prevent parent clicks
                    setDetailOpen(true);
                }}
            >
                <WeatherIcon className={cn("w-3.5 h-3.5", color)} />
                <span className={cn("text-xs font-mono font-medium", color)}>
                    {weather.temp}°C
                </span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide ml-1 border-l border-border/50 pl-2">
                    {t(`wmo.${weather.code}` as any) || t('wmo.0' as any)}
                </span>
            </div>

            <WeatherDetailSheet
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                data={weather}
                locationName={locationName || "Forecast"}
            />
        </>
    );
}
