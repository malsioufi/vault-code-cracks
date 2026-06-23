import React, { useState, useEffect } from 'react';
import { GuessEntry } from '@/game/engine';
import { useLanguage } from '@/i18n/LanguageContext';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useDigitMarks, Mark, MARK_ORDER, markStyles, markSymbol } from '@/contexts/DigitMarksContext';
import { sfx } from '@/lib/sfx';

interface DigitTrackerProps {
  history: GuessEntry[];
  resetKey?: string | number;
}

const DigitTracker: React.FC<DigitTrackerProps> = ({ resetKey }) => {
  const { t } = useLanguage();
  const ctx = useDigitMarks();

  // Fallback local state if rendered outside a DigitMarksProvider
  const [localMarks, setLocalMarks] = useState<Record<number, Mark>>({});
  useEffect(() => {
    if (!ctx) setLocalMarks({});
  }, [resetKey, ctx]);

  const [isOpen, setIsOpen] = useState(true);

  const getMark = (d: number): Mark =>
    ctx ? ctx.getMark(d) : (localMarks[d] ?? 'neutral');

  const cycle = (d: number) => {
    sfx.tap();
    if (ctx) { ctx.cycle(d); return; }
    setLocalMarks((prev) => {
      const current = prev[d] ?? 'neutral';
      const next = MARK_ORDER[(MARK_ORDER.indexOf(current) + 1) % MARK_ORDER.length];
      const copy = { ...prev };
      if (next === 'neutral') delete copy[d]; else copy[d] = next;
      return copy;
    });
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center justify-between w-full mb-1 group"
        aria-expanded={isOpen}
        aria-controls="digit-tracker-grid"
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          {t('digitTracker')}
        </span>
        <span className="flex items-center gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
            {t('digitTrackerHint')}
          </span>
          {isOpen ? (
            <ChevronUp className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </span>
      </button>
      {isOpen && (
        <div id="digit-tracker-grid" dir="ltr" className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, d) => {
            const mark = getMark(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => cycle(d)}
                className={`relative h-8 rounded font-mono text-sm font-bold border transition-all ${markStyles[mark]}`}
                aria-label={`digit ${d} ${mark}`}
              >
                {d}
                {markSymbol[mark] && (
                  <span className="absolute -top-1 -end-1 text-[9px] leading-none">
                    {markSymbol[mark]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DigitTracker;
