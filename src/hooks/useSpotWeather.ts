import { useState, useEffect } from 'react';
import { differenceInHours, parseISO } from 'date-fns';

const CACHE_KEY = 'trip-weather-cache-v2'; // Invalidate old cache for new data structure
const CACHE_DURATION = 1000 * 60 * 60; // 1 Hour

export interface SpotWeatherData {
    temp: number;
    code: number; // WMO Weather Code
    isDay: number;
}

// Helper to get/set cache
const getCache = (): Record<string, { data: any; timestamp: number }> => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const setCache = (key: string, data: any) => {
    try {
        const cache = getCache();
        cache[key] = { data, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('Cache Storage Error', e);
    }
};

export interface SpotWeatherData {
    temp: number;
    code: number;
    isDay: number;
    hourly: {
        time: string[];
        temperature_2m: number[];
        weather_code: number[];
        is_day: number[];
    };
    daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
        sunrise: string[];
        sunset: string[];
    };
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
            const cache = getCache();

            try {
                // Check Cache (Valid for 1 hour)
                if (cache[key] && (Date.now() - cache[key].timestamp < CACHE_DURATION)) {
                    processWeatherData(cache[key].data, time);
                    setLoading(false);
                    return;
                }

                // Fetch from Open-Meteo
                // Expanded for Detail View: Daily + Hourly
                const params = new URLSearchParams({
                    latitude: lat.toString(),
                    longitude: lng.toString(),
                    hourly: 'temperature_2m,weather_code,is_day',
                    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
                    forecast_days: '10', // Secure enough data for "Next 7 Days excluding today"
                    timezone: 'auto'
                });

                const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
                if (!res.ok) throw new Error('Weather API error');

                const data = await res.json();

                // Update Cache
                setCache(key, data);

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

            // Find Current/Target Temp
            let index = 0;
            const targetDate = targetTime ? parseISO(targetTime) : new Date();

            let minDiff = Infinity;
            for (let i = 0; i < times.length; i++) {
                const forecastTime = new Date(times[i]);
                const diff = Math.abs(differenceInHours(targetDate, forecastTime));
                if (diff < minDiff) {
                    minDiff = diff;
                    index = i;
                }
            }

            setWeather({
                temp: temperature_2m[index],
                code: weather_code[index],
                isDay: is_day[index],
                hourly: data.hourly,
                daily: data.daily
            });
        };

        fetchWeather();

        return () => { };
    }, [lat, lng, time]);

    return { weather, loading, error };
}
