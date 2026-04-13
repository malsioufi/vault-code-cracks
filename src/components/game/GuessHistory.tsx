import React from 'react';
import { GuessEntry, shuffleArray } from '@/game/engine';
import { useLanguage } from '@/i18n/LanguageContext';

interface GuessHistoryProps {
  history: GuessEntry[];
  codeLength: number;
}

const GuessHistory: React.FC<GuessHistoryProps> = ({ history, codeLength }) => {
  const { t } = useLanguage();

  if (history.length === 0) return null;

  return (
    <div className="w-full max-w-md">
      <h3 className="font-mono text-xs text-secondary text-glow-secondary uppercase tracking-widest mb-3">
        {t('history')}
      </h3>
      <div className="space-y-2">
        {history.map((entry, idx) => {
          // Build feedback icons and shuffle them
          const icons: string[] = [
            ...Array(entry.feedback.matches).fill('🟢'),
            ...Array(entry.feedback.shifts).fill('🟡'),
            ...Array(entry.feedback.glitches).fill('🔴'),
          ];
          const shuffled = shuffleArray(icons);

          return (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cyber-border"
            >
              <span className="font-mono text-xs text-muted-foreground w-8">
                #{idx + 1}
              </span>
              <div className="flex gap-1.5">
                {entry.guess.map((d, i) => (
                  <span
                    key={i}
                    className="w-8 h-8 flex items-center justify-center rounded bg-card font-mono text-sm text-foreground cyber-border"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="flex gap-0.5 ms-auto text-base">
                {shuffled.map((icon, i) => (
                  <span key={i}>{icon}</span>
                ))}
              </div>
              <div className="flex gap-2 text-xs font-mono ms-2">
                <span className="text-success">{entry.feedback.matches}🟢</span>
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
