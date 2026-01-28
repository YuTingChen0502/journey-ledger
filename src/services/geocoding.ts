export interface GeocodingResult {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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

    // 1. Try Exact match
    let result = await fetchNominatim(query);
    if (result) return result;

    // 2. Try removing parentheses (e.g. "Centrair (Access Plaza)" -> "Centrair")
    const cleanName = query.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (cleanName !== query) {
        await sleep(500); // polite delay
        result = await fetchNominatim(cleanName);
        if (result) return result;
    }

    // 3. Try splitting by comma (e.g. "Nagoya Station, Aichi, Japan")
    const parts = query.split(',').map(s => s.trim()).filter(s => s.length > 2);
    if (parts.length > 1) {
        // Try the first part (Venue name usually)
        await sleep(500);
        result = await fetchNominatim(parts[0]);
        if (result) return result;

        // Try the last part (City/Region usually) - good for weather fallback
        // Skip if last part is just "Japan" or similar common country name? (Optional optimization)
        await sleep(500);
        const lastPart = parts[parts.length - 1];
        result = await fetchNominatim(lastPart);
        if (result) return result;
    }

    return null;
}
