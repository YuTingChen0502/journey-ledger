export interface ImportCandidate {
    id: string;          // Temporary UUID
    originalText: string;
    parsedData: {
        title: string;
        date?: string;     // YYYY-MM-DD
        time?: string;     // HH:mm
        location?: string;
        note?: string;
    };
    isSelected: boolean; // Default true
}

export type ParseError = {
    line: string;
    error: string;
};
