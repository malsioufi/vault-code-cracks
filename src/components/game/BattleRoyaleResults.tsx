import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Participant } from '@/hooks/useRoom';
import { GuessEntry, getDigitStatuses } from '@/game/engine';

interface Props {
  winnerId: string | null;
  myId: string;
  secret?: number[];
  participants: Participant[];
  guessesByPlayer: Record<string, GuessEntry[]>;
  profiles: Record<string, string>;
  codeLength: number;
  onBack: () => void;
  onRematch?: () => void;
  rematchPending?: boolean;
}

function computeCloseness(guesses: GuessEntry[], codeLength: number): number {
  if (!guesses.length) return 0;
  let best = 0;
  for (const g of guesses) {
    const score = g.feedback.matches * 2 + g.feedback.shifts;
    if (score > best) best = score;
  }
  return Math.round((best / (codeLength * 2)) * 100);
}

const BattleRoyaleResults: React.FC<Props> = ({
  winnerId, myId, secret, participants, guessesByPlayer, profiles, codeLength, onBack, onRematch, rematchPending,
}) => {
  const { t } = useLanguage();
  const iWon = winnerId === myId;
  const winnerName = winnerId ? (profiles[winnerId] ?? 'Breaker') : null;

  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.user_id === winnerId) return -1;
    if (b.user_id === winnerId) return 1;
    const ca = computeCloseness(guessesByPlayer[a.user_id] ?? [], codeLength);
    const cb = computeCloseness(guessesByPlayer[b.user_id] ?? [], codeLength);
    return cb - ca;
  });

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div className="p-5 rounded-lg bg-card cyber-border text-center scanline">
        <h2 className={`font-mono text-2xl font-bold mb-1 ${
          iWon ? 'text-primary text-glow-primary' : winnerId ? 'text-destructive' : 'text-warning'
        }`}>
          {iWon ? t('youWin') : winnerId ? t('opponentWins') : t('nobodyWon')}
        </h2>
        {winnerName && (
          <p className="font-mono text-sm text-muted-foreground mb-3">
            🏆 {t('winnerIs')}: <span className={iWon ? 'text-primary text-glow-primary' : 'text-foreground'}>{winnerName}</span>
          </p>
        )}
        {secret && (
          <>
            <p className="font-mono text-sm text-muted-foreground mb-1">{t('secretCodeWas')}</p>
            <div dir="ltr" className="flex gap-2 justify-center mb-2">
              {secret.map((d, i) => (
                <span key={i} className="w-10 h-10 flex items-center justify-center rounded bg-primary text-primary-foreground font-mono text-lg font-bold">
                  {d}
                </span>
              ))}
            </div>
          </>
        )}
        <div className="flex flex-col gap-2 items-stretch">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-muted text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
          >
            {t('backToMenu')}
          </button>
          {onRematch && (
            <button
              onClick={onRematch}
              disabled={rematchPending}
              className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground font-mono text-sm font-bold glow-secondary hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rematchPending ? t('rematchSent') : `🔁 ${t('rematch')}`}
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">
          {t('allAttempts')}
        </p>
        <div className="space-y-3">
          {sortedParticipants.map((p) => {
            const name = profiles[p.user_id] ?? 'Breaker';
            const isWinner = p.user_id === winnerId;
            const guesses = guessesByPlayer[p.user_id] ?? [];
            const closeness = computeCloseness(guesses, codeLength);
            return (
              <div
                key={p.user_id}
                className={`p-3 rounded-lg bg-card cyber-border ${isWinner ? 'glow-primary' : ''}`}
              >
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <span className={`font-mono text-sm truncate ${isWinner ? 'text-primary text-glow-primary' : 'text-foreground'}`}>
                    {isWinner && '🏆 '}{name}{p.user_id === myId && ` (${t('you')})`}
                  </span>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground shrink-0">
                    <span>{guesses.length}</span>
                    <span className={isWinner ? 'text-primary' : closeness >= 75 ? 'text-warning' : 'text-muted-foreground'}>
                      {closeness}%
                    </span>
                  </div>
                </div>
                {guesses.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground italic">—</p>
                ) : (
                  <div className="space-y-1.5">
                    {guesses.map((entry, idx) => {
                      const digitStatuses = secret ? getDigitStatuses(entry.guess, secret) : null;
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground w-6 shrink-0">
                            #{idx + 1}
                          </span>
                          <div dir="ltr" className="flex gap-1">
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
                              return (
                                <span
                                  key={i}
                                  className={`w-7 h-7 flex items-center justify-center rounded font-mono text-sm cyber-border ${colorClass}`}
                                >
                                  {d}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BattleRoyaleResults;
