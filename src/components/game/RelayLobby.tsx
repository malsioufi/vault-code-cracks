import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Participant } from '@/hooks/useRoom';

interface Props {
  roomCode: string;
  roomId: string;
  isHost: boolean;
  myId: string;
  participants: Participant[];
  profiles: Record<string, string>;
  minPlayersPerTeam: number;
  codeLength: number;
  allowDuplicates: boolean;
  maxTries: number | null;
  onLeave: () => void;
}

const RelayLobby: React.FC<Props> = ({
  roomCode, roomId, isHost, myId, participants, profiles, minPlayersPerTeam,
  codeLength, allowDuplicates, maxTries, onLeave,
}) => {
  const { t } = useLanguage();
  const [busy, setBusy] = React.useState(false);

  const teamA = participants.filter((p) => p.team === 'A');
  const teamB = participants.filter((p) => p.team === 'B');
  const unassigned = participants.filter((p) => !p.team);
  const myPart = participants.find((p) => p.user_id === myId);

  const pickTeam = async (team: 'A' | 'B') => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('pick-team', { body: { roomId, team } });
    setBusy(false);
    if (error || data?.error) toast.error(data?.error || error?.message || 'Failed');
  };

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('start-relay', { body: { roomId } });
    setBusy(false);
    if (error || data?.error) toast.error(data?.error || error?.message || 'Failed to start');
  };

  const canStart = teamA.length >= minPlayersPerTeam && teamB.length >= minPlayersPerTeam;

  const copyShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`);
    toast.success(t('copied'));
  };

  const TeamColumn = ({ team, members, color }: { team: 'A' | 'B'; members: Participant[]; color: 'primary' | 'secondary' }) => {
    const isMyTeam = myPart?.team === team;
    const colorText = color === 'primary' ? 'text-primary' : 'text-secondary';
    const colorBtn = color === 'primary'
      ? 'bg-primary/10 text-primary hover:bg-primary/20'
      : 'bg-secondary/10 text-secondary hover:bg-secondary/20';
    return (
      <div className={`flex-1 p-3 rounded-lg bg-card cyber-border ${isMyTeam ? (color === 'primary' ? 'glow-primary' : 'glow-secondary') : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`font-mono text-sm font-bold ${colorText}`}>{t('team')} {team}</h3>
          <span className="font-mono text-[10px] text-muted-foreground">{members.length}/4</span>
        </div>
        <div className="space-y-1 min-h-[80px]">
          {members.map((p) => (
            <div key={p.user_id} className="font-mono text-xs truncate px-2 py-1 rounded bg-muted/50">
              {profiles[p.user_id] ?? 'Breaker'}{p.user_id === myId && ` (${t('you')})`}
            </div>
          ))}
          {members.length === 0 && <p className="font-mono text-[10px] text-muted-foreground italic px-2">—</p>}
        </div>
        {!isMyTeam && (
          <button
            onClick={() => pickTeam(team)}
            disabled={busy || members.length >= 4}
            className={`w-full mt-2 py-1.5 rounded font-mono text-xs transition-colors cyber-border disabled:opacity-50 ${colorBtn}`}
          >
            {t('joinTeam')} {team}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-lg p-5 rounded-lg bg-card cyber-border scanline space-y-4">
        <h2 className="font-mono text-secondary text-glow-secondary uppercase tracking-widest text-sm text-center">
          {t('relayRace')} — {t('waitingForPlayers')}
        </h2>

        <div className="text-center">
          <p className="font-mono text-xs text-muted-foreground mb-1">{t('roomCode')}</p>
          <div dir="ltr" className="font-mono text-3xl text-primary text-glow-primary tracking-[0.5em] font-bold">
            {roomCode}
          </div>
        </div>

        <button
          onClick={copyShare}
          className="w-full py-2 rounded bg-primary/10 text-primary font-mono text-sm hover:bg-primary/20 transition-colors cyber-border"
        >
          {t('copyLink')}
        </button>

        <div className="font-mono text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 justify-center">
          <span>Len: <span className="text-foreground">{codeLength}</span></span>
          <span>Dup: <span className="text-foreground">{allowDuplicates ? 'ON' : 'OFF'}</span></span>
          {maxTries !== null && <span>Tries: <span className="text-foreground">{maxTries}</span></span>}
          <span>Min/Team: <span className="text-foreground">{minPlayersPerTeam}</span></span>
        </div>

        <div className="flex gap-2">
          <TeamColumn team="A" members={teamA} color="primary" />
          <TeamColumn team="B" members={teamB} color="secondary" />
        </div>

        {unassigned.length > 0 && (
          <p className="font-mono text-[11px] text-muted-foreground text-center">
            {unassigned.length} {t('unassigned')}
          </p>
        )}

        {isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart || busy}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-mono font-bold glow-primary hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? '...' : canStart ? t('startGame') : `${t('eachTeamNeeds')} ${minPlayersPerTeam}`}
          </button>
        ) : (
          <p className="font-mono text-xs text-muted-foreground text-center animate-pulse">
            {t('waitingForHost')}
          </p>
        )}

        <button onClick={onLeave} className="w-full text-muted-foreground font-mono text-xs hover:text-foreground transition-colors">
          ← {t('cancel')}
        </button>
      </div>
    </div>
  );
};

export default RelayLobby;
