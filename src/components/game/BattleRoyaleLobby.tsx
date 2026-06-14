import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Participant } from '@/hooks/useRoom';

interface Props {
  roomCode: string;
  roomId: string;
  isHost: boolean;
  participants: Participant[];
  profiles: Record<string, string>;
  minPlayers: number;
  codeLength: number;
  allowDuplicates: boolean;
  maxTries: number | null;
  onLeave: () => void;
}

const BattleRoyaleLobby: React.FC<Props> = ({
  roomCode, roomId, isHost, participants, profiles, minPlayers,
  codeLength, allowDuplicates, maxTries, onLeave,
}) => {
  const { t } = useLanguage();
  const [busy, setBusy] = React.useState(false);

  const copyShare = () => {
    const url = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard.writeText(url);
    toast.success(t('copied'));
  };

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('start-battle-royale', {
      body: { roomId },
    });
    setBusy(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Failed to start');
    }
  };

  const count = participants.length;
  const canStart = count >= minPlayers;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md p-6 rounded-lg bg-card cyber-border scanline space-y-4">
        <h2 className="font-mono text-secondary text-glow-secondary uppercase tracking-widest text-sm text-center">
          {t('battleRoyale')} — {t('waitingForPlayers')}
        </h2>

        <div className="text-center py-2">
          <p className="font-mono text-xs text-muted-foreground mb-2">{t('roomCode')}</p>
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
          <span>Min: <span className="text-foreground">{minPlayers}</span></span>
        </div>

        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">
            {t('players')} ({count}/8)
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {participants.map((p) => (
              <div
                key={p.user_id}
                className="flex items-center justify-between px-3 py-2 rounded bg-muted/50 font-mono text-sm"
              >
                <span className="truncate">{profiles[p.user_id] ?? 'Breaker'}</span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart || busy}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-mono font-bold glow-primary hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? '...' : canStart
              ? t('startGame')
              : t('needMorePlayers').replace('{n}', String(minPlayers - count))}
          </button>
        ) : (
          <p className="font-mono text-xs text-muted-foreground text-center animate-pulse">
            {t('waitingForPlayers')}...
          </p>
        )}

        <button
          onClick={onLeave}
          className="w-full text-muted-foreground font-mono text-xs hover:text-foreground transition-colors"
        >
          ← {t('cancel')}
        </button>
      </div>
    </div>
  );
};

export default BattleRoyaleLobby;
