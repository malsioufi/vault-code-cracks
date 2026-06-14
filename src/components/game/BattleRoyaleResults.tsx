import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Participant } from '@/hooks/useRoom';
import GuessHistory from './GuessHistory';
import { GuessEntry } from '@/game/engine';

interface Props {
  winnerId: string | null;
  myId: string;
  secret?: number[];
  participants: Participant[];
  guessesByPlayer: Record<string, GuessEntry[]>;
  profiles: Record<string, string>;
  codeLength: number;
  onBack: () => void;
}

const BattleRoyaleResults: React.FC<Props> = ({
  winnerId, myId, secret, participants, guessesByPlayer, profiles, codeLength, onBack,
}) => {
  const { t } = useLanguage();
  const iWon = winnerId === myId;
  const winnerName = winnerId ? (profiles[winnerId] ?? 'Breaker') : null;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-4 space-y-4">
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
        <button
          onClick={onBack}
          className="mt-3 px-4 py-2 rounded-lg bg-muted text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
        >
          {t('backToMenu')}
        </button>
      </div>

      <div>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">
          {t('allAttempts')}
        </p>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {participants.map((p) => {
            const name = profiles[p.user_id] ?? 'Breaker';
            const isWinner = p.user_id === winnerId;
            const guesses = guessesByPlayer[p.user_id] ?? [];
            return (
              <div
                key={p.user_id}
                className={`shrink-0 w-64 p-3 rounded-lg bg-card cyber-border ${isWinner ? 'glow-primary' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-sm truncate ${isWinner ? 'text-primary text-glow-primary' : 'text-foreground'}`}>
                    {isWinner && '🏆 '}{name}{p.user_id === myId && ` (${t('you')})`}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 ml-2">
                    {guesses.length}
                  </span>
                </div>
                <GuessHistory
                  history={guesses}
                  codeLength={codeLength}
                  secret={secret}
                  gameOver={true}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BattleRoyaleResults;
