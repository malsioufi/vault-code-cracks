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

export function useRoom(code: string | undefined, userId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [mySecret, setMySecret] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!code || !userId) return;
    let cancelled = false;

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
      setLoading(false);
    };

    fetchRoom();
    return () => {
      cancelled = true;
    };
  }, [code, userId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!room) return;
    const roomId = room.id;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as Room),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guesses', filter: `room_id=eq.${roomId}` },
        (payload) => setGuesses((prev) => [...prev, payload.new as Guess]),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  return { room, guesses, mySecret, setMySecret, loading, error };
}
