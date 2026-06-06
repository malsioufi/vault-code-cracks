import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ACHIEVEMENTS, evaluate, UnlockContext, Achievement } from '@/game/achievements';
import { toast } from 'sonner';

interface Args {
  userId: string | null | undefined;
  isGuest: boolean;
  context: UnlockContext | null;
}

export function useAchievements({ userId, isGuest, context }: Args) {
  const [unlockedAt, setUnlockedAt] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadUnlocked = useCallback(async () => {
    if (!userId || isGuest) {
      setLoading(false);
      return {} as Record<string, string>;
    }
    const { data } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', userId);
    const map: Record<string, string> = {};
    for (const r of data ?? []) {
      map[r.achievement_id as string] = (r as { unlocked_at: string }).unlocked_at;
    }
    setUnlockedAt(map);
    setLoading(false);
    return map;
  }, [userId, isGuest]);

  useEffect(() => {
    loadUnlocked();
  }, [loadUnlocked]);

  // Evaluate + persist newly unlocked
  useEffect(() => {
    if (!userId || isGuest || !context) return;
    let cancelled = false;
    (async () => {
      const current = await loadUnlocked();
      const eligible = evaluate(context);
      const fresh = eligible.filter((id) => !(id in current));
      if (fresh.length === 0 || cancelled) return;
      const rows = fresh.map((achievement_id) => ({ user_id: userId, achievement_id }));
      const { error } = await supabase.from('user_achievements').insert(rows);
      if (error) return;
      const reloaded = await loadUnlocked();
      if (cancelled) return;
      setUnlockedAt(reloaded);
      fresh.forEach((id) => {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (!a) return;
        toast.success(`${a.icon} Achievement Unlocked — ${a.name}`, {
          description: a.description,
          duration: 5000,
        });
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isGuest, JSON.stringify(context)]);

  return { unlockedAt, loading, all: ACHIEVEMENTS as Achievement[] };
}
