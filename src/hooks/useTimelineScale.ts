import { useSyncExternalStore } from 'react';

// Pixels-per-minute for the planning timeline, responsive to viewport width.
// Desktop is kept at the original density; tablet/mobile are compacted so users
// see more of the day at once. Values are chosen so a 5-minute step is an integer
// number of pixels (clean drag/resize snapping):
//   desktop (>=1024px): 2.0 px/min -> 120 px/hour, 10 px / 5 min
//   tablet  (>=640px):  1.0 px/min ->  60 px/hour,  5 px / 5 min
//   mobile  (<640px):   0.8 px/min ->  48 px/hour,  4 px / 5 min
const DESKTOP_PPM = 2;
const TABLET_PPM = 1;
const MOBILE_PPM = 0.8;

const QUERY_TABLET = '(min-width: 640px)';
const QUERY_DESKTOP = '(min-width: 1024px)';

function subscribe(callback: () => void): () => void {
    if (typeof window === 'undefined' || !window.matchMedia) return () => { };
    const queries = [window.matchMedia(QUERY_TABLET), window.matchMedia(QUERY_DESKTOP)];
    queries.forEach((q) => q.addEventListener('change', callback));
    return () => queries.forEach((q) => q.removeEventListener('change', callback));
}

function getSnapshot(): number {
    if (typeof window === 'undefined' || !window.matchMedia) return DESKTOP_PPM;
    if (window.matchMedia(QUERY_DESKTOP).matches) return DESKTOP_PPM;
    if (window.matchMedia(QUERY_TABLET).matches) return TABLET_PPM;
    return MOBILE_PPM;
}

export interface TimelineScale {
    ppm: number;        // pixels per minute
    hourHeight: number; // pixels per hour
    snapPx: number;     // pixels per 5-minute snap step
}

/**
 * Responsive timeline scale. A single source of truth so the grid, hour axis,
 * event positioning, drag deltas, and resize math all stay consistent.
 */
export function useTimelineScale(): TimelineScale {
    const ppm = useSyncExternalStore(subscribe, getSnapshot, () => DESKTOP_PPM);
    return { ppm, hourHeight: ppm * 60, snapPx: ppm * 5 };
}
