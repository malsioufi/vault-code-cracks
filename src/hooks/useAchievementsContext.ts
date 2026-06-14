import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UnlockContext } from '@/game/achievements';

interface RoomRow {
  id: string;
  host_id: string;
  guest_id: string | null;
  code_length: number;
  allow_duplicates: boolean;
  winner_id: string | null;
  finished_at: string | null;
  created_at: string;
  mode: 'turn_based' | 'simultaneous' | 'battle_royale' | 'relay_race';
}

interface DailyRow {
  won: boolean;
  attempts_used: number;
}

export function useAchievementsContext(userId: string | undefined, isGuest: boolean) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [dailyStreak, setDailyStreak] = useState<{ current: number; best: number }>({ current: 0, best: 0 });
  const [guessCounts, setGuessCounts] = useState<Record<string, number>>({});
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || isGuest) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: roomData }, { data: dailyData }, { data: streakData }, { data: brParts }] = await Promise.all([
        supabase
          .from('rooms')
          .select('id, host_id, guest_id, code_length, allow_duplicates, winner_id, finished_at, created_at, mode')
          .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
          .in('status', ['finished', 'abandoned'])
          .order('finished_at', { ascending: false, nullsFirst: false })
          .limit(100),
        supabase
          .from('daily_results')
          .select('won, attempts_used')
          .eq('user_id', userId),
        supabase.rpc('get_daily_streak', { _user_id: userId }),
        supabase
          .from('room_participants')
          .select('room_id')
          .eq('user_id', userId),
      ]);
      if (cancelled) return;
      let rs = (roomData ?? []) as RoomRow[];

      // Include BR rooms where user is participant but not host/guest
      const extraIds = Array.from(new Set(
        (brParts ?? []).map((p) => p.room_id).filter((id) => !rs.some((r) => r.id === id)),
      ));
      if (extraIds.length) {
        const { data: brRooms } = await supabase
          .from('rooms')
          .select('id, host_id, guest_id, code_length, allow_duplicates, winner_id, finished_at, created_at, mode')
          .in('id', extraIds)
          .in('status', ['finished', 'abandoned']);
        if (brRooms && !cancelled) rs = [...rs, ...(brRooms as RoomRow[])];
        rs.sort((a, b) => {
          const da = new Date(b.finished_at ?? b.created_at).getTime();
          const db = new Date(a.finished_at ?? a.created_at).getTime();
          return da - db;
        });
      }
      setRooms(rs);
      setDaily((dailyData ?? []) as DailyRow[]);
      const s = Array.isArray(streakData) && streakData[0] ? streakData[0] : null;
      if (s) {
        setDailyStreak({
          current: Number(s.current_streak ?? 0),
          best: Number(s.best_streak ?? 0),
        });
      }
      const wonIds = rs.filter((r) => r.winner_id === userId).map((r) => r.id);
      if (wonIds.length) {
        const { data: gs } = await supabase
          .from('guesses')
          .select('room_id')
          .eq('player_id', userId)
          .in('room_id', wonIds);
        if (gs && !cancelled) {
          const counts: Record<string, number> = {};
          for (const g of gs) {
            const rid = g.room_id as string;
            counts[rid] = (counts[rid] ?? 0) + 1;
          }
          setGuessCounts(counts);
        }
      }

      const brIds = rs.filter((r) => r.mode === 'battle_royale').map((r) => r.id);
      if (brIds.length) {
        const { data: parts } = await supabase
          .from('room_participants')
          .select('room_id')
          .in('room_id', brIds);
        if (parts && !cancelled) {
          const counts: Record<string, number> = {};
          for (const p of parts as { room_id: string }[]) {
            counts[p.room_id] = (counts[p.room_id] ?? 0) + 1;
          }
          setParticipantCounts(counts);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, isGuest]);

  const context = useMemo<UnlockContext | null>(() => {
    if (!userId || isGuest) return null;
    let streak = 0;
    for (const r of rooms) {
      if (r.winner_id === userId) streak += 1;
      else break;
    }
    const wonDaily = daily.filter((d) => d.won);
    const brMatches = rooms.filter((r) => r.mode === 'battle_royale');
    const brWonMatches = brMatches.filter((r) => r.winner_id === userId);
    const brBiggestWin = brWonMatches.reduce(
      (acc, r) => Math.max(acc, participantCounts[r.id] ?? 0),
      0,
    );
    return {
      onlineWins: rooms.filter((r) => r.winner_id === userId).length,
      onlineMatches: rooms.map((r) => ({
        won: r.winner_id === userId,
        guessCount: guessCounts[r.id],
        codeLength: r.code_length,
        allowDuplicates: r.allow_duplicates,
        finishedAt: r.finished_at,
        mode: r.mode,
        playerCount: participantCounts[r.id],
      })),
      currentWinStreak: streak,
      dailyWins: wonDaily.length,
      dailyBestGuessCount: wonDaily.length ? Math.min(...wonDaily.map((d) => d.attempts_used)) : 0,
      dailyCurrentStreak: dailyStreak.current,
      dailyBestStreak: dailyStreak.best,
      battleRoyalePlays: brMatches.length,
      battleRoyaleWins: brWonMatches.length,
      battleRoyaleBiggestWin: brBiggestWin,
    };
  }, [rooms, daily, dailyStreak, guessCounts, participantCounts, userId, isGuest]);

  return { context, loading };
}
