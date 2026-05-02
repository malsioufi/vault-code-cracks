import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';

interface LanguageToggleProps {
  className?: string;
}

/**
 * Compact, consistent language toggle used across all pages.
 * Shows an icon + short abbreviation of the *target* language (i.e. what
 * you'll switch to), so it stays small and never overlaps header content.
 */
const LanguageToggle: React.FC<LanguageToggleProps> = ({ className }) => {
  const { lang, setLang } = useLanguage();
  const next = lang === 'en' ? 'ar' : 'en';
  const label = next === 'ar' ? 'ع' : 'EN';

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={`Switch language to ${next === 'ar' ? 'Arabic' : 'English'}`}
      title={next === 'ar' ? 'العربية' : 'English'}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md',
        'bg-card/60 backdrop-blur-sm cyber-border',
        'text-muted-foreground hover:text-primary hover:glow-primary',
        'font-mono text-xs leading-none transition-colors shrink-0',
        className,
      )}
    >
      <Languages className="w-3.5 h-3.5" />
      <span className="font-bold tracking-wide">{label}</span>
    </button>
  );
};

export default LanguageToggle;
