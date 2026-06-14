import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { GuessEntry, getDigitStatuses } from '@/game/engine';
import { Participant } from '@/hooks/useRoom';
import { TeamRow } from './RelaySetting';

interface Props {
  winnerTeam: 'A' | 'B' | null;
  myTeam: 'A' | 'B' | null;
  teams: TeamRow[];
  teamSecrets: Record<'A' | 'B', number[] | undefined>;
  guessesByTeam: Record<'A' | 'B', { guess: number[]; feedback: GuessEntry['feedback']; player_id: string }[]>;
  participants: Participant[];
  profiles: Record<string, string>;
  codeLength: number;
  onBack: () => void;
  onRematch?: () => void;
  rematchPending?: boolean;
}

const RelayResults: React.FC<Props> = ({
  winnerTeam, myTeam, teams, teamSecrets, guessesByTeam, profiles, codeLength, onBack, onRematch, rematchPending,
}) => {
  const { t } = useLanguage();
  const iWon = winnerTeam === myTeam;
  const isDraw = !winnerTeam;

  const TeamPanel: React.FC<{ team: 'A' | 'B' }> = ({ team }) => {
    const tRow = teams.find((x) => x.team === team);
    const secret = teamSecrets[team];
    const guesses = guessesByTeam[team] ?? [];
    const isWinner = winnerTeam === team;
    const oppSecret = teamSecrets[team === 'A' ? 'B' : 'A'];
    return (
      <div className={`p-3 rounded-lg bg-card cyber-border ${isWinner ? 'glow-primary' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`font-mono text-sm font-bold ${isWinner ? 'text-primary text-glow-primary' : 'text-foreground'}`}>
            {isWinner && '🏆 '}{t('team')} {team}
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">{guesses.length} {t('guess')}</span>
        </div>
        {secret && (
          <div className="mb-3">
            <p className="font-mono text-[10px] text-muted-foreground mb-1">{t('theirSecret')}</p>
            <div dir="ltr" className="flex gap-1.5">
              {secret.map((d, i) => (
                <span key={i} className="w-7 h-7 flex items-center justify-center rounded bg-secondary/20 text-secondary font-mono text-sm font-bold cyber-border">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="font-mono text-[10px] text-muted-foreground mb-1">{t('allAttempts')}</p>
        {guesses.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground italic">—</p>
        ) : (
          <div className="space-y-1">
            {guesses.map((g, idx) => {
              const statuses = oppSecret ? getDigitStatuses(g.guess, oppSecret) : null;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                  <div dir="ltr" className="flex gap-0.5">
                    {g.guess.map((d, i) => {
                      let cls = 'bg-card text-foreground';
                      if (statuses) {
                        const s = statuses[i];
                        if (s === 'match') cls = 'bg-primary/20 text-primary border-primary/50';
                        else if (s === 'shift') cls = 'bg-warning/20 text-warning border-warning/50';
                        else cls = 'bg-destructive/20 text-destructive border-destructive/50';
                      }
                      return (
                        <span key={i} className={`w-6 h-6 flex items-center justify-center rounded font-mono text-xs cyber-border ${cls}`}>
                          {d}
                        </span>
                      );
                    })}
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground ml-1 truncate">
                    {profiles[g.player_id] ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div className="p-5 rounded-lg bg-card cyber-border text-center scanline">
        <h2 className={`font-mono text-2xl font-bold mb-1 ${
          iWon ? 'text-primary text-glow-primary' : isDraw ? 'text-warning' : 'text-destructive'
        }`}>
          {iWon ? t('teamWins') : isDraw ? t('nobodyWon') : t('teamLost')}
        </h2>
        {winnerTeam && (
          <p className="font-mono text-sm text-muted-foreground mb-3">
            🏆 {t('winningTeam')}: <span className="text-primary text-glow-primary">{t('team')} {winnerTeam}</span>
          </p>
        )}
        <button
          onClick={onBack}
          className="mt-3 px-4 py-2 rounded-lg bg-muted text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
        >
          {t('backToMenu')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TeamPanel team="A" />
        <TeamPanel team="B" />
      </div>
    </div>
  );
};

export default RelayResults;
