import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/PageHeader';
import { useLanguage } from '@/i18n/LanguageContext';

interface PublicStats {
  user_id: string;
  display_name: string;
  is_guest: boolean;
  online_played: number;
  online_wins: number;
  online_losses: number;
  daily_played: number;
  daily_wins: number;
  daily_current_streak: number;
  daily_best_streak: number;
  achievements_unlocked: number;
}

interface DailyDot {
  puzzle_date: string;
  won: boolean;
}

const PublicProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [recent, setRecent] = useState<DailyDot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [{ data: statsData, error: statsErr }, { data: recentData }] = await Promise.all([
        supabase.rpc('get_public_profile_stats', { _user_id: userId }),
        supabase.rpc('get_public_daily_recent', { _user_id: userId, _limit: 10 }),
      ]);
      if (cancelled) return;
      if (statsErr || !Array.isArray(statsData) || statsData.length === 0) {
        setNotFound(true);
      } else {
        setStats(statsData[0] as PublicStats);
      }
      if (Array.isArray(recentData)) {
        // oldest -> newest for the dot strip
        setRecent((recentData as DailyDot[]).slice().reverse());
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">…</p>
      </div>
    );
  }

  if (notFound || !stats) {
    return (
      <div className="h-screen flex flex-col items-center px-4 overflow-hidden">
        <PageHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-muted-foreground">Player not found.</p>
        </div>
      </div>
    );
  }

  const winRate = stats.online_played > 0
    ? Math.round((stats.online_wins / stats.online_played) * 100)
    : 0;

  return (
    <div className="h-screen flex flex-col items-center px-4 py-2 overflow-hidden">
      <PageHeader center={stats.display_name} />

      <div className="w-full max-w-md text-center mb-3 shrink-0">
        <h1 className="font-mono text-2xl font-bold text-primary text-glow-primary truncate">
          {stats.display_name}
        </h1>
        <p className="font-mono text-[11px] text-muted-foreground mt-1">
          {stats.is_guest ? 'Guest player' : 'Public profile'}
        </p>
      </div>

      <div className="w-full max-w-md flex-1 min-h-0 flex flex-col gap-3 pb-2">
        {/* Online */}
        <div className="w-full p-4 rounded-lg bg-card cyber-border scanline shrink-0">
          <h2 className="font-mono text-xs uppercase tracking-widest text-secondary text-glow-secondary mb-3">
            {t('onlineStats')}
          </h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Cell label={t('played')} value={stats.online_played} />
            <Cell label={t('wins')} value={stats.online_wins} cls="text-primary text-glow-primary" />
            <Cell label={t('losses')} value={stats.online_losses} cls="text-destructive" />
            <Cell label={t('winRate')} value={`${winRate}%`} cls="text-secondary text-glow-secondary" />
          </div>
        </div>

        {/* Daily */}
        <div className="w-full p-4 rounded-lg bg-card cyber-border scanline shrink-0">
          <h2 className="font-mono text-xs uppercase tracking-widest text-warning mb-3">
            {t('dailyStats')}
          </h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Cell label={t('played')} value={stats.daily_played} />
            <Cell label={t('wins')} value={stats.daily_wins} cls="text-primary text-glow-primary" />
            <Cell label={t('streak')} value={stats.daily_current_streak} cls="text-warning" />
            <Cell label={t('bestStreak')} value={stats.daily_best_streak} cls="text-secondary text-glow-secondary" />
          </div>
          {recent.length > 0 && (
            <div className="mt-3">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                Last {recent.length}
              </div>
              <div className="flex items-center gap-1.5">
                {recent.map((d) => (
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
        </div>

        {/* Achievements summary */}
        <div className="w-full p-4 rounded-lg bg-card cyber-border scanline shrink-0">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary text-glow-primary mb-2">
            Achievements
          </h2>
          <p className="font-mono text-sm text-foreground">
            <span className="text-primary text-glow-primary font-bold text-lg">
              {stats.achievements_unlocked}
            </span>{' '}
            badges unlocked
          </p>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="mt-auto py-2 rounded-md bg-muted text-foreground font-mono text-xs hover:bg-muted/70 transition shrink-0"
        >
          ← Back
        </button>
      </div>
    </div>
  );
};

const Cell: React.FC<{ label: string; value: number | string; cls?: string }> = ({ label, value, cls }) => (
  <div>
    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    <div className={`font-mono text-lg ${cls ?? 'text-foreground'}`}>{value}</div>
  </div>
);

export default PublicProfile;
