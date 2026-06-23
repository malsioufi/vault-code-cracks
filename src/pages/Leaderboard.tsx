import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/PageHeader';
import { Trophy } from 'lucide-react';

interface Row {
  rank: number;
  user_id: string;
  display_name: string;
  is_guest: boolean;
  daily_wins: number;
  online_wins: number;
  best_daily_streak: number;
  score: number;
  is_me: boolean;
}

const Leaderboard: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_time_leaderboard', { _limit: 50 });
      if (cancelled) return;
      if (error) setRows([]);
      else setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageHeader center={<span className="uppercase tracking-widest">All-Time Leaderboard</span>} />

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-8">
        <div className="p-3 mb-3 rounded-lg bg-card cyber-border">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-secondary" />
            <h1 className="font-mono text-xs uppercase tracking-widest text-secondary text-glow-secondary">
              Top Breakers
            </h1>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            Score = Daily wins × 20 + Best daily streak × 10 + Online wins × 5
          </p>
        </div>

        {loading ? (
          <p className="font-mono text-xs text-muted-foreground text-center py-8">…</p>
        ) : rows.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground text-center py-8">
            {t('noSolversYet')}
          </p>
        ) : (
          <ol className="space-y-1.5">
            {rows.map((row) => {
              const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null;
              return (
                <li
                  key={`${row.rank}-${row.user_id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded font-mono text-xs ${
                    row.is_me
                      ? 'bg-primary/10 border border-primary/40 text-primary'
                      : 'bg-muted/40 text-foreground'
                  }`}
                >
                  <span className="w-8 text-center shrink-0 font-bold">
                    {medal ?? `#${row.rank}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    {row.is_guest ? (
                      <span className="truncate block">{row.display_name}</span>
                    ) : (
                      <Link
                        to={`/profile/${row.user_id}`}
                        className="truncate block hover:underline hover:text-primary transition-colors"
                      >
                        {row.display_name}
                      </Link>
                    )}
                    <span className="text-[9px] text-muted-foreground">
                      D:{row.daily_wins} · O:{row.online_wins} · 🔥{row.best_daily_streak}
                    </span>
                  </div>
                  <span className="shrink-0 font-bold text-secondary tabular-nums">
                    {row.score}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
};

export default Leaderboard;
