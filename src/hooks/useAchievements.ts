import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ACHIEVEMENTS, Achievement } from '@/game/achievements';

interface Args {
  userId: string | null | undefined;
  isGuest: boolean;
}

/**
 * Tracks which achievements the current user has unlocked.
 * Unlocks are NOT granted automatically — the user clicks an eligible badge
 * to claim it, which calls `claim()` and triggers server-side validation.
 */
export function useAchievements({ userId, isGuest }: Args) {
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

  /**
   * Ask the server to grant any achievement the user currently qualifies for.
   * Returns the list of achievement ids that were newly granted by this call.
   * (Used when the user clicks an eligible-but-locked badge.)
   */
  const claim = useCallback(async (): Promise<string[]> => {
    if (!userId || isGuest) return [];
    const { data, error } = await supabase.functions.invoke('sync-achievements', { body: {} });
    if (error) return [];
    const granted: string[] = Array.isArray((data as { unlocked?: string[] })?.unlocked)
      ? (data as { unlocked: string[] }).unlocked
      : [];
    if (granted.length > 0) {
      const reloaded = await loadUnlocked();
      setUnlockedAt(reloaded);
    }
    return granted;
  }, [userId, isGuest, loadUnlocked]);

  return { unlockedAt, loading, all: ACHIEVEMENTS as Achievement[], claim };
}
