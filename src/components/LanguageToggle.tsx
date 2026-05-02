import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

interface LanguageToggleProps {
  className?: string;
}

const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = '' }) => {
  const { lang, setLang } = useLanguage();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-primary font-mono text-xs transition-colors ${className}`}
      aria-label="Toggle language"
    >
      <Globe className="w-3.5 h-3.5" />
      {lang === 'en' ? 'AR' : 'EN'}
    </button>
  );
};

export default LanguageToggle;
