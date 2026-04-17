import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_MS = 5000;

export function usePresence(roomId: string | undefined, enabled: boolean) {
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [opponentLastSeen, setOpponentLastSeen] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !enabled) return;

    let cancelled = false;
    const beat = async () => {
      const { data, error } = await supabase.functions.invoke('heartbeat', {
        body: { roomId },
      });
      if (cancelled) return;
      if (!error && data) {
        setOpponentDisconnected(Boolean(data.opponentDisconnected));
        setOpponentLastSeen(data.opponentLastSeen ?? null);
      }
    };

    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roomId, enabled]);

  return { opponentDisconnected, opponentLastSeen };
}
