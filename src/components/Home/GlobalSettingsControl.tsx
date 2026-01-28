import { useSettings } from '../../context/SettingsContext';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Check } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function GlobalSettingsControl() {
    const { language, setLanguage, fontScale, setFontScale } = useSettings();
    const { t } = useTranslation();

    // Map internal scale to translation keys
    const scaleLabelKey = {
        compact: 'settings.font.small',
        comfort: 'settings.font.medium',
        accessible: 'settings.font.large'
    } as const;

    return (
        <div
            className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-full",
                "bg-white/40 backdrop-blur-md border border-white/20 shadow-sm",
                "transition-all duration-300",
                "opacity-70 hover:opacity-100 hover:bg-white/60 hover:shadow-md"
            )}
        >
            {/* 1. Language Switcher (Left) */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="text-xs font-serif font-medium tracking-widest text-foreground/80 hover:text-primary transition-colors uppercase min-w-[3ch] text-center focus:outline-none">
                        {language === 'en' ? 'EN' : '繁'}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32 backdrop-blur-xl bg-white/90 border-muted/30">
                    <DropdownMenuRadioGroup value={language} onValueChange={(v) => setLanguage(v as 'en' | 'zh-TW')}>
                        <DropdownMenuRadioItem value="en" className="text-xs font-serif cursor-pointer">
                            English
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="zh-TW" className="text-xs font-serif cursor-pointer">
                            繁體中文
                        </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Divider (Japanese Minimalist Line) */}
            <div className="w-px h-3 bg-foreground/20 mx-2" />

            {/* 2. Font Scale Switcher (Right) */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="text-xs font-serif font-medium tracking-wider text-foreground/80 hover:text-primary transition-colors min-w-[3ch] text-center focus:outline-none">
                        {t(scaleLabelKey[fontScale])}
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-32 backdrop-blur-xl bg-white/90 border-muted/30">
                    {/* Size Options refined to "Small / Medium / Large" */}
                    {(['compact', 'comfort', 'accessible'] as const).map((scale) => (
                        <DropdownMenuItem
                            key={scale}
                            onClick={() => setFontScale(scale)}
                            className={cn(
                                "flex items-center justify-between cursor-pointer text-xs font-serif py-2",
                                fontScale === scale && "bg-muted/40 font-semibold"
                            )}
                        >
                            <span>{t(scaleLabelKey[scale])}</span>
                            {fontScale === scale && <Check className="w-3 h-3 text-primary ml-2" />}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
