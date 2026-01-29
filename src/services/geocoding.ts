export interface GeocodingResult {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country: string;
}

// Open-Meteo Geocoding API (Fast, Reliable, No Heavy Rate Limiting)
async function fetchOpenMeteo(q: string): Promise<GeocodingResult | null> {
    try {
        const params = new URLSearchParams({
            name: q,
            count: '1',
            language: 'en',
            format: 'json'
        });

        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
        if (!res.ok) return null;

        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
            const item = data.results[0];
            return {
                id: item.id,
                name: item.name,
                latitude: item.latitude,
                longitude: item.longitude,
                country: item.country || ''
            };
        }
        return null;
    } catch {
        return null;
    }
}

// Fallback to Nominatim (Slower, but good for specific addresses)
async function fetchNominatim(q: string): Promise<GeocodingResult | null> {
    try {
        const params = new URLSearchParams({
            q: q,
            format: 'json',
            limit: '1',
            addressdetails: '1'
        });

        // Nominatim requires User-Agent
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
        if (!res.ok) return null;

        const data = await res.json();
        if (data && data.length > 0) {
            const item = data[0];
            return {
                id: parseInt(item.place_id),
                name: item.name || item.display_name.split(',')[0],
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                country: item.address?.country || ''
            };
        }
        return null;
    } catch {
        return null;
    }
}

export async function searchLocation(query: string): Promise<GeocodingResult | null> {
    if (!query || query.length < 2) return null;

    // 1. Try Open-Meteo first (Fastest)
    // It handles fuzzy search well for cities and venues
    let result = await fetchOpenMeteo(query);
    if (result) return result;

    // 2. Fallback: Try specific parts with OpenMeteo again (often faster than Nominatim retry)
    // E.g. "Nagoya Station, Aichi" -> "Nagoya Station"
    const parts = query.split(',').map(s => s.trim()).filter(s => s.length > 2);
    if (parts.length > 1) {
        result = await fetchOpenMeteo(parts[0]); // Venue name
        if (result) return result;

        result = await fetchOpenMeteo(parts[parts.length - 1]); // City name (High confidence for weather)
        if (result) return result;
    }

    // 3. Last Resort: Nominatim (Address specific)
    // Only call if really needed, to save time
    result = await fetchNominatim(query);

    return result;
}
