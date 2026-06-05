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
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadUnlocked = useCallback(async () => {
    if (!userId || isGuest) {
      setLoading(false);
      return new Set<string>();
    }
    const { data } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);
    const set = new Set<string>((data ?? []).map((r) => r.achievement_id as string));
    setUnlocked(set);
    setLoading(false);
    return set;
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
      const fresh = eligible.filter((id) => !current.has(id));
      if (fresh.length === 0 || cancelled) return;
      const rows = fresh.map((achievement_id) => ({ user_id: userId, achievement_id }));
      const { error } = await supabase.from('user_achievements').insert(rows);
      if (error) return;
      const next = new Set(current);
      fresh.forEach((id) => next.add(id));
      setUnlocked(next);
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

  return { unlocked, loading, all: ACHIEVEMENTS as Achievement[] };
}
