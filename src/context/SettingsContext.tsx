import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { SettingsContext, type Language, type FontScale } from './settings';

const STORAGE_KEY_LANG = 'journey_ledger_lang';
const STORAGE_KEY_FONT = 'journey_ledger_font_scale';
// Legacy keys (pre-rebrand). Read once as a fallback so existing users keep
// their language / font preference; all writes go to the new keys.
const LEGACY_KEY_LANG = 'nagoya_lang';
const LEGACY_KEY_FONT = 'nagoya_font_scale';

export function SettingsProvider({ children }: { children: ReactNode }) {
    // 1. Initialize State from LocalStorage (new key first, then legacy fallback)
    const [language, setLanguageState] = useState<Language>(() => {
        return (localStorage.getItem(STORAGE_KEY_LANG) as Language)
            || (localStorage.getItem(LEGACY_KEY_LANG) as Language)
            || 'en';
    });

    const [fontScale, setFontScaleState] = useState<FontScale>(() => {
        return (localStorage.getItem(STORAGE_KEY_FONT) as FontScale)
            || (localStorage.getItem(LEGACY_KEY_FONT) as FontScale)
            || 'compact';
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

// `useSettings` and the context object now live in ./settings so this module
// only exports the SettingsProvider component (react-refresh friendly).
