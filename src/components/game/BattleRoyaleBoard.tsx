import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Participant } from '@/hooks/useRoom';
import DigitInput from './DigitInput';
import GuessHistory from './GuessHistory';
import { GuessEntry } from '@/game/engine';
import { useBottomPanelSpacing } from '@/hooks/useBottomPanelSpacing';

interface Props {
  codeLength: number;
  allowDuplicates: boolean;
  maxTries: number | null;
  myId: string;
  myGuesses: GuessEntry[];
  participants: Participant[];
  guessCounts: Record<string, number>;
  profiles: Record<string, string>;
  onGuess: (digits: number[]) => void;
  onGiveUp: () => void;
  submitting: boolean;
  amIDone: boolean;
}

function statusOf(p: Participant): 'cracked' | 'out' | 'gave_up' | 'in' {
  if (p.cracked) return 'cracked';
  if (p.gave_up_at) return 'gave_up';
  if (p.finished_at) return 'out';
  return 'in';
}

const BattleRoyaleBoard: React.FC<Props> = ({
  codeLength, allowDuplicates, maxTries, myId, myGuesses, participants,
  guessCounts, profiles, onGuess, onGiveUp, submitting, amIDone,
}) => {
  const { t } = useLanguage();
  const triesLeft = maxTries !== null ? maxTries - myGuesses.length : null;
  const opponents = participants.filter((p) => p.user_id !== myId);
  const bottomPanel = useBottomPanelSpacing({ active: !amIDone });

  return (
    <>
      <div
        ref={bottomPanel.scrollAreaRef}
        className="w-full max-w-md flex-1 min-h-0 overflow-y-auto"
        style={{ paddingBottom: !amIDone ? `${bottomPanel.paddingBottom}px` : '20px' }}
      >
        {/* Opponents strip */}
        <div className="mb-3 p-2 rounded bg-card cyber-border">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
            {t('players')}
          </p>
          <div className="space-y-1">
            {opponents.map((p) => {
              const st = statusOf(p);
              const count = guessCounts[p.user_id] ?? 0;
              const color =
                st === 'cracked' ? 'text-primary text-glow-primary' :
                st === 'gave_up' ? 'text-muted-foreground line-through' :
                st === 'out' ? 'text-destructive' : 'text-foreground';
              const label =
                st === 'cracked' ? `✓ ${t('cracked')}` :
                st === 'gave_up' ? t('gaveUp') :
                st === 'out' ? t('outOfTriesShort') :
                t('inGame');
              return (
              <div key={p.user_id} className="flex items-center justify-between font-mono text-xs">
                  <span className={`truncate ${color}`}>{profiles[p.user_id] ?? 'Breaker'}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                    {count}{maxTries !== null ? `/${maxTries}` : ''} · <span className={color}>{label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <GuessHistory
          history={myGuesses}
          codeLength={codeLength}
          gameOver={amIDone}
        />
      </div>

      {!amIDone && (
        <div
          ref={bottomPanel.panelRef}
          className="fixed inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-2 pb-3"
          style={{ bottom: `${bottomPanel.bottomOffset}px` }}
        >
          <div className="w-full max-w-md mx-auto space-y-2">
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>{t('attempt')} {myGuesses.length + 1}{maxTries !== null ? `/${maxTries}` : ''}</span>
              {triesLeft !== null && <span className="text-warning">{triesLeft} {t('turnsLeft')}</span>}
            </div>
            <DigitInput
              codeLength={codeLength}
              allowDuplicates={allowDuplicates}
              onSubmit={onGuess}
              disabled={submitting}
            />
            <button
              onClick={onGiveUp}
              className="w-full py-1.5 rounded-lg bg-destructive/10 text-destructive font-mono text-xs hover:bg-destructive/20 transition-colors cyber-border"
            >
              {t('giveUp')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default BattleRoyaleBoard;
