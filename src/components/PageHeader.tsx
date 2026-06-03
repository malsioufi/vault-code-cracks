import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

interface PageHeaderProps {
  to?: string;
  right?: React.ReactNode;
  center?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ to = '/', right, center }) => {
  const navigate = useNavigate();
  const { lang, setLang } = useLanguage();

  return (
    <header className="w-full max-w-md mx-auto flex items-center justify-between px-1 py-2 shrink-0">
      <button
        onClick={() => navigate(to)}
        aria-label="Back"
        className="p-2 -ml-2 rounded-md text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="flex-1 text-center font-mono text-xs text-muted-foreground truncate px-2">
        {center}
      </div>

      <div className="flex items-center gap-1">
        {right}
        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          aria-label="Toggle language"
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-muted-foreground hover:text-primary font-mono text-[11px] transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          {lang === 'en' ? 'AR' : 'EN'}
        </button>
      </div>
    </header>
  );
};

export default PageHeader;
