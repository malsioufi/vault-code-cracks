import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import LanguageToggle from '@/components/LanguageToggle';

interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  status: 'waiting' | 'setting_secrets' | 'playing' | 'finished' | 'abandoned';
  mode: 'turn_based' | 'simultaneous';
  code_length: number;
  winner_id: string | null;
  finished_at: string | null;
  created_at: string;
}

interface DailyRow {
  puzzle_date: string;
  won: boolean;
  attempts_used: number;
  max_tries: number;
  code_length: number;
  closeness?: number;
}

interface Stats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

const Stats: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [dailyStreak, setDailyStreak] = useState<{ current: number; best: number }>({ current: 0, best: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.is_guest) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: roomData }, { data: dailyData }, { data: streakData }] = await Promise.all([
        supabase
          .from('rooms')
          .select('id, code, host_id, guest_id, status, mode, code_length, winner_id, finished_at, created_at')
          .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
          .in('status', ['finished', 'abandoned'])
          .order('finished_at', { ascending: false, nullsFirst: false })
          .limit(50),
        supabase
          .from('daily_results')
          .select('puzzle_date, won, attempts_used, max_tries, code_length, closeness')
          .eq('user_id', user.id)
          .order('puzzle_date', { ascending: false })
          .limit(30),
        supabase.rpc('get_daily_streak', { _user_id: user.id }),
      ]);

      if (cancelled) return;
      const rs = (roomData ?? []) as RoomRow[];
      setRooms(rs);
      setDaily((dailyData ?? []) as DailyRow[]);

      const s = Array.isArray(streakData) && streakData[0] ? streakData[0] : null;
      if (s) {
        setDailyStreak({
          current: Number(s.current_streak ?? 0),
          best: Number(s.best_streak ?? 0),
        });
      }

      // Fetch opponent display names
      const opponentIds = Array.from(new Set(
        rs.map((r) => (r.host_id === user.id ? r.guest_id : r.host_id)).filter(Boolean) as string[],
      ));
      if (opponentIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', opponentIds);
        if (profs && !cancelled) {
          const map: Record<string, string> = {};
          for (const p of profs) map[p.id as string] = p.display_name as string;
          setProfilesMap(map);
        }
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, profile, authLoading]);

  const onlineStats = useMemo<Stats>(() => {
    let wins = 0, losses = 0, draws = 0;
    for (const r of rooms) {
      if (!r.winner_id) {
        draws += 1;
      } else if (r.winner_id === user?.id) {
        wins += 1;
      } else {
        losses += 1;
      }
    }
    const played = rooms.length;
    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
    return { played, wins, losses, draws, winRate };
  }, [rooms, user?.id]);

  const dailyStats = useMemo<Stats>(() => {
    const wins = daily.filter((d) => d.won).length;
    const losses = daily.length - wins;
    const winRate = daily.length > 0 ? Math.round((wins / daily.length) * 100) : 0;
    return { played: daily.length, wins, losses, draws: 0, winRate };
  }, [daily]);

  const avgCloseness = useMemo(() => {
    if (daily.length === 0) return 0;
    const total = daily.reduce(
      (sum, d) => sum + (typeof d.closeness === 'number' ? d.closeness : (d.won ? 100 : 0)),
      0,
    );
    return Math.round(total / daily.length);
  }, [daily]);

  // ----- gated views -----
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <p className="font-mono text-muted-foreground text-center">{t('statsRequireAccount')}</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm glow-primary"
          >
            {t('signIn')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-muted text-muted-foreground font-mono text-sm"
          >
            {t('backToMenu')}
          </button>
        </div>
      </div>
    );
  }

  if (profile?.is_guest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <div className="max-w-md text-center space-y-3 p-6 rounded-lg bg-card cyber-border scanline">
          <p className="font-mono text-secondary text-glow-secondary">{t('guestNoStats')}</p>
          <p className="font-mono text-xs text-muted-foreground">{t('createAccountToTrack')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm glow-primary"
          >
            {t('createAccount')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-muted text-muted-foreground font-mono text-sm"
          >
            {t('backToMenu')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-4 pb-8">
      {/* Language toggle */}
      <div className="fixed top-4 end-4 z-50">
        <LanguageToggle />
      </div>

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 mt-2">
        <button
          onClick={() => navigate('/')}
          className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
        >
          ← {t('backToMenu')}
        </button>
        <div className="font-mono text-xs text-muted-foreground">{profile?.display_name}</div>
      </div>

      <div className="w-full max-w-md text-center mb-4">
        <h1 className="font-mono text-2xl font-bold text-primary text-glow-primary">{t('myStats')}</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">{t('statsSubtitle')}</p>
      </div>

      {/* Online stats card */}
      <div className="w-full max-w-md mb-4 p-4 rounded-lg bg-card cyber-border scanline">
        <h2 className="font-mono text-xs uppercase tracking-widest text-secondary text-glow-secondary mb-3">
          {t('onlineStats')}
        </h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          <StatCell label={t('played')} value={onlineStats.played} />
          <StatCell label={t('wins')} value={onlineStats.wins} valueClass="text-primary text-glow-primary" />
          <StatCell label={t('losses')} value={onlineStats.losses} valueClass="text-destructive" />
          <StatCell label={t('winRate')} value={`${onlineStats.winRate}%`} valueClass="text-secondary text-glow-secondary" />
        </div>
        {onlineStats.draws > 0 && (
          <p className="font-mono text-[10px] text-muted-foreground text-center mt-2">
            {onlineStats.draws} {t('draws')}
          </p>
        )}
      </div>

      {/* Daily stats card */}
      <div className="w-full max-w-md mb-4 p-4 rounded-lg bg-card cyber-border scanline">
        <h2 className="font-mono text-xs uppercase tracking-widest text-warning mb-3">
          {t('dailyStats')}
        </h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          <StatCell label={t('played')} value={dailyStats.played} />
          <StatCell label={t('wins')} value={dailyStats.wins} valueClass="text-primary text-glow-primary" />
          <StatCell label={t('streak')} value={dailyStreak.current} valueClass="text-warning" />
          <StatCell label={t('bestStreak')} value={dailyStreak.best} valueClass="text-secondary text-glow-secondary" />
        </div>
        {dailyStats.played > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground mb-1">
              <span>{t('avgCloseness')}</span>
              <span className="text-secondary text-glow-secondary font-bold">{avgCloseness}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden cyber-border">
              <div
                className="h-full bg-secondary transition-all"
                style={{ width: `${avgCloseness}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Recent matches */}
      <div className="w-full max-w-md">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
          {t('recentMatches')}
        </h2>
        {rooms.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground text-center py-6">
            {t('noMatchesYet')}
          </p>
        ) : (
          <div className="space-y-2">
            {rooms.slice(0, 15).map((r) => {
              const opponentId = r.host_id === user.id ? r.guest_id : r.host_id;
              const opponentName = (opponentId && profilesMap[opponentId]) || t('opponentLabel');
              const iWon = r.winner_id === user.id;
              const isDraw = !r.winner_id;
              const isForfeit = r.status === 'abandoned';
              const date = r.finished_at ?? r.created_at;
              const dateLabel = new Date(date).toLocaleDateString(lang === 'ar' ? 'ar' : 'en', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 cyber-border"
                >
                  <div
                    className={`w-2 h-10 rounded-full shrink-0 ${
                      iWon ? 'bg-primary' : isDraw ? 'bg-warning' : 'bg-destructive'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-sm font-bold ${
                          iWon ? 'text-primary' : isDraw ? 'text-warning' : 'text-destructive'
                        }`}
                      >
                        {iWon ? t('winShort') : isDraw ? t('drawShort') : t('lossShort')}
                      </span>
                      {isForfeit && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t('forfeitTag')}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground truncate">
                      vs <span className="text-foreground">{opponentName}</span> · {r.code_length}d ·{' '}
                      {r.mode === 'turn_based' ? t('turnBased') : t('simultaneous')}
                    </p>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {dateLabel}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCell: React.FC<{ label: string; value: number | string; valueClass?: string }> = ({
  label,
  value,
  valueClass,
}) => (
  <div>
    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    <div className={`font-mono text-lg ${valueClass ?? 'text-foreground'}`}>{value}</div>
  </div>
);

export default Stats;
