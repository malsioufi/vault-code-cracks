import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DailyConfig,
  getDailyConfig,
  dailyDateString,
  getLocalDailyRecord,
  getLocalStreak,
  saveLocalDailyRecord,
} from '@/game/dailyPuzzle';

export interface DailyResultRecord {
  date: string;
  won: boolean;
  attemptsUsed: number;
  guesses: number[][];
  closeness: number;
}

export interface StreakStats {
  current: number;
  best: number;
  played: number;
  won: number;
}

interface UseDailyPuzzleResult {
  config: DailyConfig;
  todayRecord: DailyResultRecord | null;
  stats: StreakStats;
  loading: boolean;
  isSignedIn: boolean;
  saveResult: (won: boolean, guesses: number[][], closeness: number) => Promise<void>;
}

export function useDailyPuzzle(): UseDailyPuzzleResult {
  const [config] = useState<DailyConfig>(() => getDailyConfig());
  const [todayRecord, setTodayRecord] = useState<DailyResultRecord | null>(null);
  const [stats, setStats] = useState<StreakStats>({ current: 0, best: 0, played: 0, won: 0 });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const loadServer = useCallback(async (uid: string) => {
    const today = utcDateString();
    const [{ data: row }, { data: streak }] = await Promise.all([
      supabase
        .from('daily_results')
        .select('puzzle_date, won, attempts_used, guesses, closeness')
        .eq('user_id', uid)
        .eq('puzzle_date', today)
        .maybeSingle(),
      supabase.rpc('get_daily_streak', { _user_id: uid }),
    ]);
    if (row) {
      setTodayRecord({
        date: row.puzzle_date as string,
        won: row.won as boolean,
        attemptsUsed: row.attempts_used as number,
        guesses: row.guesses as number[][],
        closeness: Number((row as { closeness?: number }).closeness ?? (row.won ? 100 : 0)),
      });
    } else {
      setTodayRecord(null);
    }
    const s = Array.isArray(streak) && streak[0] ? streak[0] : null;
    if (s) {
      setStats({
        current: Number(s.current_streak ?? 0),
        best: Number(s.best_streak ?? 0),
        played: Number(s.total_played ?? 0),
        won: Number(s.total_won ?? 0),
      });
    }
  }, []);

  const loadLocal = useCallback(() => {
    const today = utcDateString();
    const rec = getLocalDailyRecord(today);
    if (rec) {
      setTodayRecord({
        date: rec.date,
        won: rec.won,
        attemptsUsed: rec.attemptsUsed,
        guesses: rec.guesses,
        closeness: typeof rec.closeness === 'number' ? rec.closeness : (rec.won ? 100 : 0),
      });
    } else {
      setTodayRecord(null);
    }
    setStats(getLocalStreak());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) await loadServer(uid);
      else loadLocal();
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      const uid = sess?.user?.id ?? null;
      setUserId(uid);
      if (uid) void loadServer(uid);
      else loadLocal();
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [loadServer, loadLocal]);

  const saveResult = useCallback(async (won: boolean, guesses: number[][], closeness: number) => {
    const date = utcDateString();
    const rec: DailyResultRecord = {
      date,
      won,
      attemptsUsed: guesses.length,
      guesses,
      closeness,
    };
    setTodayRecord(rec);
    if (userId) {
      const { error } = await supabase.from('daily_results').insert({
        user_id: userId,
        puzzle_date: date,
        won,
        attempts_used: guesses.length,
        code_length: config.codeLength,
        max_tries: config.maxTries,
        allow_duplicates: config.allowDuplicates,
        guesses,
        closeness,
      } as never);
      if (!error) await loadServer(userId);
    } else {
      saveLocalDailyRecord({ date, won, attemptsUsed: guesses.length, guesses, closeness });
      setStats(getLocalStreak());
    }
  }, [userId, config, loadServer]);

  return {
    config,
    todayRecord,
    stats,
    loading,
    isSignedIn: !!userId,
    saveResult,
  };
}
