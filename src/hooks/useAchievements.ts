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

  // Trigger server-side evaluation (server re-checks user's real data before granting)
  useEffect(() => {
    if (!userId || isGuest || !context) return;
    let cancelled = false;
    (async () => {
      const current = await loadUnlocked();
      // Optimistic client-side preview to know which IDs are *candidates* — server is the source of truth
      const eligible = evaluate(context);
      const fresh = eligible.filter((id) => !(id in current));
      if (fresh.length === 0 || cancelled) return;
      const { data, error } = await supabase.functions.invoke('sync-achievements', { body: {} });
      if (error || cancelled) return;
      const granted: string[] = Array.isArray((data as { unlocked?: string[] })?.unlocked)
        ? (data as { unlocked: string[] }).unlocked
        : [];
      if (granted.length === 0) return;
      const reloaded = await loadUnlocked();
      if (cancelled) return;
      setUnlockedAt(reloaded);
      granted.forEach((id) => {
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
