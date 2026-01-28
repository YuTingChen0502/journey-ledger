import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

type Language = 'en' | 'zh-TW';
type FontScale = 'compact' | 'comfort' | 'accessible';

interface SettingsContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    fontScale: FontScale;
    setFontScale: (scale: FontScale) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY_LANG = 'nagoya_lang';
const STORAGE_KEY_FONT = 'nagoya_font_scale';

export function SettingsProvider({ children }: { children: ReactNode }) {
    // 1. Initialize State from LocalStorage
    const [language, setLanguageState] = useState<Language>(() => {
        return (localStorage.getItem(STORAGE_KEY_LANG) as Language) || 'en';
    });

    const [fontScale, setFontScaleState] = useState<FontScale>(() => {
        return (localStorage.getItem(STORAGE_KEY_FONT) as FontScale) || 'compact';
    });

    // 2. Persist & Side Effects
    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem(STORAGE_KEY_LANG, lang);

        // Toast Feedback
        const label = lang === 'en' ? 'English' : '繁體中文';
        toast.success(`Language changed to ${label}`, {
            duration: 2000,
            className: 'text-xs font-serif tracking-wide border-muted/20 bg-background/80 backdrop-blur-md'
        });
    };

    const setFontScale = (scale: FontScale) => {
        setFontScaleState(scale);
        localStorage.setItem(STORAGE_KEY_FONT, scale);

        // Toast Feedback
        const label = scale.charAt(0).toUpperCase() + scale.slice(1);
        toast.info(`Typography: ${label}`, {
            duration: 2000,
            className: 'text-xs font-serif tracking-wide border-muted/20 bg-background/80 backdrop-blur-md'
        });
    };

    // 3. Apply to DOM (Critical for CSS Variables)
    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    useEffect(() => {
        document.documentElement.setAttribute('data-font-scale', fontScale);
    }, [fontScale]);

    return (
        <SettingsContext.Provider value={{ language, setLanguage, fontScale, setFontScale }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
