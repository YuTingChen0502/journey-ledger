import type { ImportCandidate } from '../types';

export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function parseRawText(text: string): ImportCandidate[] {
    const candidates: ImportCandidate[] = [];
    const lines = text.split('\n').filter(line => line.trim() !== '');

    // Try JSON first
    try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
            return json.map(item => createCandidate({
                title: item.title || "Untitled",
                time: item.time,
                date: item.date,
                note: item.note,
                location: item.location
            }, JSON.stringify(item)));
        } else if (typeof json === 'object') {
            return [createCandidate({
                title: json.title || "Untitled",
                time: json.time,
                date: json.date,
                note: json.note,
                location: json.location
            }, JSON.stringify(json))];
        }
    } catch (e) {
        // Not JSON, continue to Regex
    }

    // Regex Patterns
    // 1. Date Header: "Date: 2026-01-31" with whitespace tolerance
    const dateHeaderPattern = /^\s*Date\s*:\s*(\d{4}-\d{2}-\d{2})/i;
    // 2. "10:30 Visit Castle" or "09:00 - Breakfast"
    const timeTitlePattern = /^\s*(\d{1,2}:\d{2})\s+(.*)$/;

    let currentDate: string | undefined;

    for (const line of lines) {
        const trimmed = line.trim();

        // Check for Date Header
        const dateMatch = trimmed.match(dateHeaderPattern);
        if (dateMatch) {
            currentDate = dateMatch[1];
            continue; // Skip adding this line as a candidate
        }

        const match = trimmed.match(timeTitlePattern);

        if (match) {
            candidates.push(createCandidate({
                time: match[1],
                title: match[2].trim(),
                date: currentDate // Assign current date context
            }, trimmed));
        } else {
            // Fallback: Treat as title only (Backlog item)
            candidates.push(createCandidate({
                title: trimmed,
                date: currentDate // Even backlog items might want a date if they are under a header? 
                // Requirement says "If no date... assign to Unscheduled". 
                // But if under a header, maybe it belongs to that day? 
                // Let's attach date if present, ImportModal decided if floating or not.
            }, trimmed));
        }
    }

    return candidates;
}

function createCandidate(data: Partial<ImportCandidate['parsedData']>, originalText: string): ImportCandidate {
    return {
        id: generateUUID(),
        originalText,
        parsedData: {
            title: data.title || "Untitled",
            ...data
        },
        isSelected: true
    };
}
