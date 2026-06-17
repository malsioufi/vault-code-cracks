import React, { useState } from 'react';
import { GuessEntry, getDigitStatuses } from '@/game/engine';
import { useLanguage } from '@/i18n/LanguageContext';

interface GuessHistoryProps {
  history: GuessEntry[];
  codeLength: number;
  secret?: number[];
  gameOver?: boolean;
}

const GuessHistory: React.FC<GuessHistoryProps> = ({ history, codeLength, secret, gameOver }) => {
  const { t } = useLanguage();
  const [pinnedDigit, setPinnedDigit] = useState<number | null>(null);
  const [hoveredDigit, setHoveredDigit] = useState<number | null>(null);
  const highlightedDigit = hoveredDigit ?? pinnedDigit;

  if (history.length === 0) return null;

  const togglePin = (d: number) => {
    setPinnedDigit((prev) => (prev === d ? null : d));
    setHoveredDigit(null);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-xs text-secondary text-glow-secondary uppercase tracking-widest">
          {t('history')}
        </h3>
        {pinnedDigit !== null && (
          <button
            onClick={() => setPinnedDigit(null)}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            clear ({pinnedDigit})
          </button>
        )}
      </div>
      <div className="space-y-2">
        {history.map((entry, idx) => {
          const digitStatuses = gameOver && secret
            ? getDigitStatuses(entry.guess, secret)
            : null;

          return (
            <div
              key={idx}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 cyber-border"
            >
              <span className="font-mono text-xs text-muted-foreground w-7 shrink-0">
                #{idx + 1}
              </span>
              <div className="flex gap-1 shrink-0">
                {entry.guess.map((d, i) => {
                  let colorClass = 'bg-card text-foreground';
                  if (digitStatuses) {
                    switch (digitStatuses[i]) {
                      case 'match':
                        colorClass = 'bg-primary/20 text-primary border-primary/50';
                        break;
                      case 'shift':
                        colorClass = 'bg-warning/20 text-warning border-warning/50';
                        break;
                      case 'glitch':
                        colorClass = 'bg-destructive/20 text-destructive border-destructive/50';
                        break;
                    }
                  }
                  const isHighlighted = highlightedDigit === d;
                  const dim =
                    highlightedDigit !== null && !isHighlighted ? 'opacity-30' : '';
                  const ring = isHighlighted
                    ? 'ring-2 ring-secondary ring-offset-1 ring-offset-background scale-110'
                    : '';
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => togglePin(d)}
                      onMouseEnter={() => setHoveredDigit(d)}
                      onMouseLeave={() => setHoveredDigit(null)}
                      className={`w-7 h-7 flex items-center justify-center rounded font-mono text-sm cyber-border transition-all ${colorClass} ${ring} ${dim}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 text-xs font-mono ms-auto shrink-0">
                <span className="text-primary">{entry.feedback.matches}🟢</span>
                <span className="text-warning">{entry.feedback.shifts}🟡</span>
                <span className="text-destructive">{entry.feedback.glitches}🔴</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GuessHistory;
