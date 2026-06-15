import { createContext, useContext } from 'react';

export type Language = 'en' | 'zh-TW';
export type FontScale = 'compact' | 'comfort' | 'accessible';

export interface SettingsContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    fontScale: FontScale;
    setFontScale: (scale: FontScale) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
