import { useState, useEffect } from 'react';
import { differenceInHours, parseISO } from 'date-fns';

// Simple in-memory cache to avoid redundant API calls
const weatherCache: Record<string, any> = {};

export interface SpotWeatherData {
    temp: number;
    code: number; // WMO Weather Code
    isDay: number;
}

export function useSpotWeather(lat?: number, lng?: number, time?: string) {
    const [weather, setWeather] = useState<SpotWeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!lat || !lng) {
            setWeather(null);
            return;
        }

        const fetchWeather = async () => {
            setLoading(true);
            const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

            try {
                // If we have cached data for this location
                if (weatherCache[key]) {
                    processWeatherData(weatherCache[key], time);
                    setLoading(false);
                    return;
                }

                // Fetch from Open-Meteo
                // We request: temperature_2m, weather_code, is_day
                // Forecast for today and tomorrow to cover most planning scenarios? 
                // Using 'forecast_days=3' to be safe.
                const params = new URLSearchParams({
                    latitude: lat.toString(),
                    longitude: lng.toString(),
                    hourly: 'temperature_2m,weather_code,is_day',
                    forecast_days: '3',
                    timezone: 'auto'
                });

                const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
                if (!res.ok) throw new Error('Weather API error');

                const data = await res.json();
                weatherCache[key] = data; // Cache the raw response
                processWeatherData(data, time);

            } catch (err) {
                console.error(err);
                setError('Failed to load weather');
            } finally {
                setLoading(false);
            }
        };

        const processWeatherData = (data: any, targetTime?: string) => {
            if (!data || !data.hourly) return;

            const { time: times, temperature_2m, weather_code, is_day } = data.hourly;

            let index = 0; // Default to current time (or first index)

            if (targetTime) {
                // Find closest hour
                const targetDate = parseISO(targetTime);

                // If target is in the past or too far future where API has no data (OpenMeteo free is 7 days usually)
                // We might fallback to current weather or show nothing.
                // For this MVP, let's try to match.

                // Find index with smallest time difference
                let minDiff = Infinity;

                for (let i = 0; i < times.length; i++) {
                    const forecastTime = new Date(times[i]);
                    const diff = Math.abs(differenceInHours(targetDate, forecastTime));
                    if (diff < minDiff) {
                        minDiff = diff;
                        index = i;
                    }
                }
            } else {
                // Current time index
                // OpenMeteo returns 'time' as ISO strings usually
                // Simple search
                const now = new Date();
                let minDiff = Infinity;
                for (let i = 0; i < times.length; i++) {
                    const forecastTime = new Date(times[i]);
                    const diff = Math.abs(differenceInHours(now, forecastTime));
                    if (diff < minDiff) {
                        minDiff = diff;
                        index = i;
                    }
                }
            }

            setWeather({
                temp: temperature_2m[index],
                code: weather_code[index],
                isDay: is_day[index]
            });
        };

        fetchWeather();

        return () => {
            // Abort controller could be here, but for simple fetch/cache logic we'll skip for brevity 
            // unless strictly needed.
        };
    }, [lat, lng, time]);

    return { weather, loading, error };
}
