import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';

interface LeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  is_guest: boolean;
  attempts_used: number;
  finished_at: string;
  is_me: boolean;
}



interface Props {
  date: string;            // YYYY-MM-DD UTC, used as a refresh key
  currentUserId?: string | null;
  hasFinished: boolean;    // refetch when local user just finished
}

const DailyLeaderboard: React.FC<Props> = ({ date, hasFinished }) => {
  const { t, lang } = useLanguage();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc('get_daily_leaderboard', { _date: date });
      if (cancelled) return;
      if (error) {
        setRows([]);
      } else {
        setRows((data ?? []) as unknown as LeaderboardRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [date, hasFinished]);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar' : 'en', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }) + ' UTC';
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full max-w-md mb-4 p-4 rounded-lg bg-card cyber-border scanline">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-secondary text-glow-secondary">
          🏆 {t('leaderboardToday')}
        </h2>
        <span className="font-mono text-[10px] text-muted-foreground">
          {t('top20')}
        </span>
      </div>

      {loading ? (
        <p className="font-mono text-xs text-muted-foreground text-center py-4">…</p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground text-center py-4">
          {t('noSolversYet')}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row) => {
            const isMe = row.is_me;
            const medal =
              row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null;
            return (
              <li
                key={`${row.rank}-${row.display_name}`}
                className={`flex items-center gap-2 px-3 py-2 rounded font-mono text-xs ${
                  isMe
                    ? 'bg-primary/10 border border-primary/40 text-primary'
                    : 'bg-muted/40 text-foreground'
                }`}
              >
                <span className="w-7 text-center shrink-0 font-bold">
                  {medal ?? `#${row.rank}`}
                </span>
                <span className="flex-1 truncate">
                  {row.display_name}
                  {row.is_guest && (
                    <span className="ms-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                      {t('guestTag')}
                    </span>
                  )}
                  {isMe && (
                    <span className="ms-1 text-[9px] uppercase tracking-wider text-primary">
                      {t('youTag')}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {row.attempts_used} {t('triesShort')}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground/70 hidden sm:inline">
                  {formatTime(row.finished_at)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default DailyLeaderboard;
