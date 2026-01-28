import { useSettings } from '../context/SettingsContext';
import { translations, type TranslationKey } from '../i18n/translations';
export type { TranslationKey };

export function useTranslation() {
    const { language } = useSettings();

    const t = (key: TranslationKey): string => {
        return translations[language][key] || key;
    };

    return { t, language };
}
