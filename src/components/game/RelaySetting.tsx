import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DigitInput from './DigitInput';
import { Participant } from '@/hooks/useRoom';

export interface TeamRow {
  room_id: string;
  team: 'A' | 'B';
  setter_id: string | null;
  setter_deadline: string | null;
  failed_setters: string[];
  active_user_id: string | null;
  rotation: string[];
  rotation_index: number;
  guesses_count: number;
  secret_set: boolean;
}

interface Props {
  roomId: string;
  myId: string;
  myTeam: 'A' | 'B' | null;
  teams: TeamRow[];
  participants: Participant[];
  profiles: Record<string, string>;
  codeLength: number;
  allowDuplicates: boolean;
  mySecret: number[] | null;
}

const RelaySetting: React.FC<Props> = ({
  roomId, myId, myTeam, teams, participants, profiles, codeLength, allowDuplicates, mySecret,
}) => {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const myTeamRow = teams.find((t) => t.team === myTeam);
  const oppTeamRow = teams.find((t) => t.team !== myTeam);
  const amISetter = myTeamRow?.setter_id === myId && !myTeamRow?.secret_set;

  const timeLeft = (deadlineStr: string | null) => {
    if (!deadlineStr) return 0;
    return Math.max(0, Math.ceil((new Date(deadlineStr).getTime() - now) / 1000));
  };

  const myTimer = timeLeft(myTeamRow?.setter_deadline ?? null);

  const handleSubmit = async (digits: number[]) => {
    if (submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('set-relay-secret', {
      body: { roomId, secret: digits },
    });
    setSubmitting(false);
    if (error || data?.error) toast.error(data?.error || error?.message || 'Failed');
  };

  // If our team's setter timer expired and secret not set, try to re-pick
  useEffect(() => {
    if (!myTeamRow || myTeamRow.secret_set) return;
    if (!myTeamRow.setter_deadline) return;
    if (new Date(myTeamRow.setter_deadline).getTime() > Date.now()) return;
    supabase.functions.invoke('relay-resetter', { body: { roomId, team: myTeam } });
  }, [now, myTeamRow?.setter_deadline, myTeamRow?.secret_set, myTeam, roomId]);

  const setterName = (id: string | null) => id ? (profiles[id] ?? 'Breaker') : '—';
  const teamSecret = myTeamRow?.secret_set ? mySecret : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md p-5 rounded-lg bg-card cyber-border scanline space-y-4">
        <h2 className="font-mono text-secondary text-glow-secondary uppercase tracking-widest text-sm text-center">
          {t('codeSettingPhase')}
        </h2>

        {/* My team */}
        <div className="p-3 rounded bg-muted/30">
          <p className="font-mono text-xs text-primary mb-2">{t('yourTeam')} {myTeam}</p>
          {amISetter ? (
            <>
              <p className="font-mono text-xs text-warning mb-2">{t('youAreSetter')} · {myTimer}s</p>
              <DigitInput
                codeLength={codeLength}
                allowDuplicates={allowDuplicates}
                onSubmit={handleSubmit}
                disabled={submitting}
                submitLabel={t('confirmSecret')}
              />
            </>
          ) : myTeamRow?.secret_set ? (
            <>
              <p className="font-mono text-xs text-primary mb-1">✓ {t('teamSecretLocked')}</p>
              {teamSecret && (
                <div dir="ltr" className="flex gap-1.5 mt-2">
                  {teamSecret.map((d, i) => (
                    <span key={i} className="w-8 h-8 flex items-center justify-center rounded bg-primary/20 text-primary font-mono text-sm font-bold cyber-border">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              {t('waitingForSetter')}: {setterName(myTeamRow?.setter_id ?? null)} ({myTimer}s)
            </p>
          )}
        </div>

        {/* Opponent team (no info) */}
        <div className="p-3 rounded bg-muted/30">
          <p className="font-mono text-xs text-secondary mb-1">{t('team')} {oppTeamRow?.team}</p>
          {oppTeamRow?.secret_set ? (
            <p className="font-mono text-xs text-primary">✓ {t('teamSecretLocked')}</p>
          ) : (
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              {t('opposingTeamChoosing')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RelaySetting;
