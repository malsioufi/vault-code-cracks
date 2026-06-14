import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/PageHeader';
import AchievementsCard from '@/components/game/AchievementsCard';
import { useAchievements } from '@/hooks/useAchievements';
import { UnlockContext } from '@/game/achievements';

interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  status: 'waiting' | 'setting_secrets' | 'playing' | 'finished' | 'abandoned';
  mode: 'turn_based' | 'simultaneous';
  code_length: number;
  allow_duplicates: boolean;
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
  const [guessCounts, setGuessCounts] = useState<Record<string, number>>({});

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
          .select('id, code, host_id, guest_id, status, mode, code_length, allow_duplicates, winner_id, finished_at, created_at')
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

      const opponentIds = Array.from(new Set(
        rs.map((r) => (r.host_id === user.id ? r.guest_id : r.host_id)).filter(Boolean) as string[],
      ));
      if (opponentIds.length) {
        const { data: profs } = await supabase.rpc('get_display_names', { _ids: opponentIds });
        if (profs && !cancelled) {
          const map: Record<string, string> = {};
          for (const p of profs as { id: string; display_name: string }[]) {
            map[p.id] = p.display_name;
          }
          setProfilesMap(map);
        }
      }

      const wonRoomIds = rs.filter((r) => r.winner_id === user.id).map((r) => r.id);
      if (wonRoomIds.length) {
        const { data: gs } = await supabase
          .from('guesses')
          .select('room_id')
          .eq('player_id', user.id)
          .in('room_id', wonRoomIds);
        if (gs && !cancelled) {
          const counts: Record<string, number> = {};
          for (const g of gs) {
            const rid = g.room_id as string;
            counts[rid] = (counts[rid] ?? 0) + 1;
          }
          setGuessCounts(counts);
        }
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, profile, authLoading]);

  const achievementsContext = useMemo<UnlockContext | null>(() => {
    if (!user || profile?.is_guest) return null;
    let streak = 0;
    for (const r of rooms) {
      if (r.winner_id === user.id) streak += 1;
      else break;
    }
    const wonDaily = daily.filter((d) => d.won);
    const dailyBestGuessCount = wonDaily.length
      ? Math.min(...wonDaily.map((d) => d.attempts_used))
      : 0;
    return {
      onlineWins: rooms.filter((r) => r.winner_id === user.id).length,
      onlineMatches: rooms.map((r) => ({
        won: r.winner_id === user.id,
        guessCount: guessCounts[r.id],
        codeLength: r.code_length,
        allowDuplicates: r.allow_duplicates,
        finishedAt: r.finished_at,
      })),
      currentWinStreak: streak,
      dailyWins: wonDaily.length,
      dailyBestGuessCount,
      dailyCurrentStreak: dailyStreak.current,
      dailyBestStreak: dailyStreak.best,
    };
  }, [rooms, daily, dailyStreak, guessCounts, user, profile]);

  const { unlockedAt: unlockedAchievementsAt, claim } = useAchievements({
    userId: user?.id,
    isGuest: !!profile?.is_guest,
  });

  const onlineStats = useMemo<Stats>(() => {
    let wins = 0, losses = 0, draws = 0;
    for (const r of rooms) {
      if (!r.winner_id) draws += 1;
      else if (r.winner_id === user?.id) wins += 1;
      else losses += 1;
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

  // Recent daily results, oldest → newest, for the dot strip (fills row width).
  const recentDaily = useMemo(
    () => daily.slice().reverse(),
    [daily],
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center px-4 overflow-hidden">
        <PageHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="font-mono text-muted-foreground text-center">{t('statsRequireAccount')}</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm glow-primary"
          >
            {t('signIn')}
          </button>
        </div>
      </div>
    );
  }

  if (profile?.is_guest) {
    return (
      <div className="h-screen flex flex-col items-center px-4 overflow-hidden">
        <PageHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="max-w-md text-center space-y-3 p-6 rounded-lg bg-card cyber-border scanline">
            <p className="font-mono text-secondary text-glow-secondary">{t('guestNoStats')}</p>
            <p className="font-mono text-xs text-muted-foreground">{t('createAccountToTrack')}</p>
          </div>
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm glow-primary"
          >
            {t('createAccount')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center px-4 py-2 overflow-hidden">
      <PageHeader center={profile?.display_name ?? undefined} />

      <div className="w-full max-w-md text-center mb-3 shrink-0">
        <h1 className="font-mono text-2xl font-bold text-primary text-glow-primary">{t('myStats')}</h1>
        <p className="font-mono text-[11px] text-muted-foreground mt-1">{t('statsSubtitle')}</p>
      </div>

      {/* Each card is its own scroll container; the page itself doesn't scroll. */}
      <div className="w-full max-w-md flex-1 min-h-0 flex flex-col gap-3 pb-2">

        {/* Online stats — fixed, no scroll */}
        <div className="w-full p-4 rounded-lg bg-card cyber-border scanline shrink-0">
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

        {/* Daily stats — fixed, no scroll, includes last-10 dot strip */}
        <div className="w-full p-4 rounded-lg bg-card cyber-border scanline shrink-0">
          <h2 className="font-mono text-xs uppercase tracking-widest text-warning mb-3">
            {t('dailyStats')}
          </h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            <StatCell label={t('played')} value={dailyStats.played} />
            <StatCell label={t('wins')} value={dailyStats.wins} valueClass="text-primary text-glow-primary" />
            <StatCell label={t('streak')} value={dailyStreak.current} valueClass="text-warning" />
            <StatCell label={t('bestStreak')} value={dailyStreak.best} valueClass="text-secondary text-glow-secondary" />
          </div>

          {last10Daily.length > 0 && (
            <div className="mt-3">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                Last {last10Daily.length}
              </div>
              <div className="flex items-center gap-1.5">
                {last10Daily.map((d) => (
                  <div
                    key={d.puzzle_date}
                    title={`${d.puzzle_date} — ${d.won ? 'Win' : 'Loss'}`}
                    className={`w-3.5 h-3.5 rounded-full border ${
                      d.won
                        ? 'bg-primary border-primary [box-shadow:0_0_6px_hsl(var(--primary))]'
                        : 'bg-destructive border-destructive [box-shadow:0_0_6px_hsl(var(--destructive))]'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

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

        {/* Achievements — its own scroll container */}
        <div className="w-full max-h-[40vh] overflow-y-auto rounded-lg">
          <AchievementsCard
            unlockedAt={unlockedAchievementsAt}
            context={achievementsContext}
            onClaim={claim}
          />
        </div>

        {/* Recent matches — its own scroll container, takes remaining space */}
        <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2 shrink-0">
            {t('recentMatches')}
          </h2>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {rooms.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground text-center py-6">
                {t('noMatchesYet')}
              </p>
            ) : (
              <div className="space-y-2">
                {rooms.map((r) => {
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
                          vs{' '}
                          {opponentId ? (
                            <button
                              onClick={() => navigate(`/profile/${opponentId}`)}
                              className="text-foreground hover:text-primary hover:underline transition-colors"
                            >
                              {opponentName}
                            </button>
                          ) : (
                            <span className="text-foreground">{opponentName}</span>
                          )}
                          {' '}· {r.code_length}d ·{' '}
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
