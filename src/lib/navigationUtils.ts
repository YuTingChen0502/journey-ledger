/**
 * Generates a Google Maps direction URL.
 * 
 * @param placeId - (Optional) The Google Maps Place ID.
 * @param destinationName - The name of the destination/query.
 * @returns The formatted Google Maps URL string.
 */
export function generateNavUrl(placeId?: string, destinationName?: string): string {
    const baseUrl = 'https://www.google.com/maps/dir/?api=1';

    // Explicitly do not set 'origin' to let the app/browser use current GPS.

    let params = '';

    if (placeId) {
        params += `&destination_place_id=${placeId}`;
    }

    if (destinationName) {
        // Fallback or primary if placeId missing.
        // Google Maps usually prefers 'destination' as query if place_id is used too.
        params += `&destination=${encodeURIComponent(destinationName)}`;
    }

    if (!destinationName && !placeId) {
        // If nothing provided, just open the map (unlikely case)
        return 'https://www.google.com/maps';
    }

    return `${baseUrl}${params}`;
}
