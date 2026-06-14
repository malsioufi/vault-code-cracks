import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Room {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  status: 'waiting' | 'setting_secrets' | 'playing' | 'finished' | 'abandoned';
  mode: 'turn_based' | 'simultaneous';
  code_length: number;
  allow_duplicates: boolean;
  max_tries: number | null;
  current_turn: string | null;
  turn_started_at: string | null;
  winner_id: string | null;
  is_quick_match: boolean;
  finished_at: string | null;
}

interface Guess {
  id: string;
  room_id: string;
  player_id: string;
  guess: number[];
  matches: number;
  shifts: number;
  glitches: number;
  created_at: string;
}

export interface RematchEvent {
  newRoomCode: string;
  newRoomId: string;
  fromUserId: string;
}

export function useRoom(code: string | undefined, userId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [mySecret, setMySecret] = useState<number[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [rematchInvite, setRematchInvite] = useState<RematchEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!code || !userId) return;
    let cancelled = false;

    // Reset state when switching rooms (e.g. rematch navigation)
    setLoading(true);
    setError(null);
    setRoom(null);
    setGuesses([]);
    setMySecret(null);
    setProfiles({});
    setRematchInvite(null);
    roomIdRef.current = null;

    const fetchRoom = async () => {
      const { data, error: e } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .maybeSingle();
      if (cancelled) return;
      if (e || !data) {
        setError('Room not found');
        setLoading(false);
        return;
      }
      setRoom(data as Room);
      roomIdRef.current = data.id;
      // Reset rematch invite when entering a new room
      setRematchInvite(null);

      // Fetch guesses
      const { data: gs } = await supabase
        .from('guesses')
        .select('*')
        .eq('room_id', data.id)
        .order('created_at', { ascending: true });
      if (!cancelled && gs) setGuesses(gs as Guess[]);

      // Fetch own secret
      const { data: sec } = await supabase
        .from('room_secrets')
        .select('secret')
        .eq('room_id', data.id)
        .eq('player_id', userId)
        .maybeSingle();
      if (!cancelled && sec) setMySecret(sec.secret as number[]);

      // Fetch participant display names via safe RPC
      const ids = [data.host_id, data.guest_id].filter(Boolean) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.rpc('get_display_names', { _ids: ids });
        if (!cancelled && profs) {
          const map: Record<string, string> = {};
          for (const p of profs as { id: string; display_name: string }[]) {
            map[p.id] = p.display_name;
          }
          setProfiles(map);
        }
      }

      setLoading(false);
    };

    fetchRoom();
    return () => {
      cancelled = true;
    };
  }, [code, userId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!room || !userId) return;
    const roomId = room.id;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        async (payload) => {
          const newRoom = payload.new as Room;
          setRoom(newRoom);
          // If guest just joined and we don't have their profile yet, fetch it.
          if (newRoom.guest_id && !profiles[newRoom.guest_id]) {
            const { data: p } = await supabase.rpc('get_display_names', { _ids: [newRoom.guest_id] });
            const row = Array.isArray(p) ? (p[0] as { id: string; display_name: string } | undefined) : undefined;
            if (row) setProfiles((prev) => ({ ...prev, [row.id]: row.display_name }));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guesses', filter: `room_id=eq.${roomId}` },
        (payload) => setGuesses((prev) => [...prev, payload.new as Guess]),
      )
      .on('broadcast', { event: 'rematch' }, ({ payload }) => {
        const evt = payload as RematchEvent;
        // Ignore own broadcast
        if (evt.fromUserId === userId) return;
        setRematchInvite(evt);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, userId]);

  return {
    room,
    guesses,
    mySecret,
    setMySecret,
    profiles,
    rematchInvite,
    clearRematchInvite: () => setRematchInvite(null),
    loading,
    error,
  };
}
