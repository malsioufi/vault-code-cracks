import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import DigitInput from './DigitInput';
import GuessHistory from './GuessHistory';
import { GuessEntry } from '@/game/engine';
import { Participant } from '@/hooks/useRoom';
import { TeamRow } from './RelaySetting';

interface Props {
  roomId: string;
  codeLength: number;
  allowDuplicates: boolean;
  maxTries: number | null;
  myId: string;
  myTeam: 'A' | 'B' | null;
  teams: TeamRow[];
  teamTurn: 'A' | 'B' | null;
  turnDeadline: string | null;
  myTeamGuesses: GuessEntry[];
  participants: Participant[];
  profiles: Record<string, string>;
  onGuess: (digits: number[]) => void;
  submitting: boolean;
}

const RelayBoard: React.FC<Props> = ({
  roomId, codeLength, allowDuplicates, maxTries, myId, myTeam, teams, teamTurn, turnDeadline,
  myTeamGuesses, participants, profiles, onGuess, submitting,
}) => {
  const { t } = useLanguage();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const myTeamRow = teams.find((t) => t.team === myTeam);
  const oppTeamRow = teams.find((t) => t.team !== myTeam);
  const isMyTeamTurn = teamTurn === myTeam;
  const amIActive = isMyTeamTurn && myTeamRow?.active_user_id === myId;

  const secsLeft = turnDeadline ? Math.max(0, Math.ceil((new Date(turnDeadline).getTime() - now) / 1000)) : 0;

  // Auto-pass when expired
  useEffect(() => {
    if (!turnDeadline) return;
    if (new Date(turnDeadline).getTime() > Date.now()) return;
    supabase.functions.invoke('relay-pass-turn', { body: { roomId } });
  }, [now, turnDeadline, roomId]);

  const nameFor = (id: string | null | undefined) => id ? (profiles[id] ?? 'Breaker') : '—';
  const myTeamSize = myTeamRow?.rotation.length ?? 0;
  const oppTeamSize = oppTeamRow?.rotation.length ?? 0;

  return (
    <>
      <div className="w-full max-w-md flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: amIActive ? '180px' : '20px' }}>
        {/* Status strip */}
        <div className="mb-3 p-3 rounded bg-card cyber-border space-y-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <div>
              <span className="text-primary">{t('team')} {myTeam}</span>
              <span className="text-muted-foreground"> · {myTeamRow?.guesses_count ?? 0}{maxTries ? `/${maxTries}` : ''}</span>
            </div>
            <div className="text-right">
              <span className="text-secondary">{t('team')} {oppTeamRow?.team}</span>
              <span className="text-muted-foreground"> · {oppTeamRow?.guesses_count ?? 0}{maxTries ? `/${maxTries}` : ''}</span>
            </div>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className={isMyTeamTurn ? 'text-primary text-glow-primary' : 'text-muted-foreground'}>
              {isMyTeamTurn ? `▶ ${nameFor(myTeamRow?.active_user_id)}` : nameFor(myTeamRow?.active_user_id)}
            </span>
            <span className={`${secsLeft <= 10 ? 'text-destructive' : 'text-warning'} tabular-nums`}>{secsLeft}s</span>
            <span className={!isMyTeamTurn ? 'text-secondary text-glow-secondary' : 'text-muted-foreground'}>
              {!isMyTeamTurn ? `▶ ${nameFor(oppTeamRow?.active_user_id)}` : nameFor(oppTeamRow?.active_user_id)}
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${secsLeft <= 10 ? 'bg-destructive' : 'bg-primary'} transition-all duration-500 ease-linear`}
              style={{ width: `${Math.min(100, (secsLeft / 30) * 100)}%` }}
            />
          </div>
        </div>

        {/* Team member chips */}
        <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[10px]">
          <div className="p-2 rounded bg-muted/30">
            <p className="text-primary mb-1">{t('yourTeam')} ({myTeamSize})</p>
            <div className="space-y-0.5">
              {(myTeamRow?.rotation ?? []).map((uid, i) => (
                <div key={uid} className={`truncate ${uid === myTeamRow?.active_user_id ? 'text-primary' : 'text-muted-foreground'}`}>
                  {i === myTeamRow?.rotation_index ? '▶ ' : ''}{nameFor(uid)}{uid === myId && ` (${t('you')})`}
                </div>
              ))}
            </div>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-secondary mb-1">{t('team')} {oppTeamRow?.team} ({oppTeamSize})</p>
            <div className="space-y-0.5">
              {(oppTeamRow?.rotation ?? []).map((uid) => (
                <div key={uid} className="truncate text-muted-foreground">
                  {nameFor(uid)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <GuessHistory history={myTeamGuesses} codeLength={codeLength} gameOver={false} />
      </div>

      {amIActive && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-2 pb-3">
          <div className="w-full max-w-md mx-auto space-y-2">
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>{t('yourTurn')} · {t('attempt')} {(myTeamRow?.guesses_count ?? 0) + 1}{maxTries ? `/${maxTries}` : ''}</span>
              <span className={secsLeft <= 10 ? 'text-destructive' : 'text-primary'}>{secsLeft}s</span>
            </div>
            <DigitInput
              codeLength={codeLength}
              allowDuplicates={allowDuplicates}
              onSubmit={onGuess}
              disabled={submitting}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default RelayBoard;
