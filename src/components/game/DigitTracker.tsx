import React, { useMemo, useState, useEffect } from 'react';
import { GuessEntry } from '@/game/engine';
import { useLanguage } from '@/i18n/LanguageContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

type Mark = 'neutral' | 'present' | 'confirmed' | 'ruled-out';

interface DigitTrackerProps {
  history: GuessEntry[];
  resetKey?: string | number;
}

const order: Mark[] = ['neutral', 'present', 'confirmed', 'ruled-out'];

const styles: Record<Mark, string> = {
  neutral: 'bg-card text-muted-foreground border-border',
  present: 'bg-warning/20 text-warning border-warning/60',
  confirmed: 'bg-primary/20 text-primary border-primary/60',
  'ruled-out': 'bg-destructive/15 text-destructive border-destructive/50 line-through opacity-70',
};

const symbol: Record<Mark, string> = {
  neutral: '',
  present: '?',
  confirmed: '✓',
  'ruled-out': '✕',
};

/**
 * Digit tracker is purely manual — players cycle through marks themselves.
 * No auto-derivation from feedback to keep the deduction challenge intact.
 */
function deriveAuto(_history: GuessEntry[]): Record<number, Mark> {
  return {};
}

const DigitTracker: React.FC<DigitTrackerProps> = ({ history, resetKey }) => {
  const { t } = useLanguage();
  const [manual, setManual] = useState<Record<number, Mark>>({});

  useEffect(() => {
    setManual({});
  }, [resetKey]);

  const auto = useMemo(() => deriveAuto(history), [history]);

  const getMark = (d: number): Mark => {
    if (manual[d]) return manual[d];
    return auto[d] ?? 'neutral';
  };

  const cycle = (d: number) => {
    setManual((prev) => {
      const current = prev[d] ?? auto[d] ?? 'neutral';
      const next = order[(order.indexOf(current) + 1) % order.length];
      const copy = { ...prev };
      if (next === 'neutral' && !manual[d]) {
        delete copy[d];
      } else {
        copy[d] = next;
      }
      return copy;
    });
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {t('digitTracker')}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
          {t('digitTrackerHint')}
        </span>
      </div>
      <div dir="ltr" className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, d) => {
          const mark = getMark(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => cycle(d)}
              className={`relative h-8 rounded font-mono text-sm font-bold border transition-all ${styles[mark]}`}
              aria-label={`digit ${d} ${mark}`}
            >
              {d}
              {symbol[mark] && (
                <span className="absolute -top-1 -end-1 text-[9px] leading-none">
                  {symbol[mark]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DigitTracker;
