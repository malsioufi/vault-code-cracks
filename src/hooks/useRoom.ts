import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Room {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  status: 'waiting' | 'setting_secrets' | 'playing' | 'finished' | 'abandoned';
  mode: 'turn_based' | 'simultaneous' | 'battle_royale';
  code_length: number;
  allow_duplicates: boolean;
  max_tries: number | null;
  current_turn: string | null;
  turn_started_at: string | null;
  winner_id: string | null;
  is_quick_match: boolean;
  finished_at: string | null;
  min_players: number | null;
  started_at: string | null;
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

export interface Participant {
  room_id: string;
  user_id: string;
  joined_at: string;
  cracked: boolean;
  finished_at: string | null;
  gave_up_at: string | null;
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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rematchInvite, setRematchInvite] = useState<RematchEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!code || !userId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setRoom(null);
    setGuesses([]);
    setMySecret(null);
    setProfiles({});
    setParticipants([]);
    setRematchInvite(null);
    roomIdRef.current = null;

    const fetchRoom = async () => {
      let { data, error: e } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .maybeSingle();

      // RLS blocks non-participants from SELECT — try to auto-join via edge function
      if (!cancelled && (e || !data)) {
        const { data: joinData } = await supabase.functions.invoke('join-room', {
          body: { code: code.toUpperCase() },
        });
        if (joinData?.room) {
          data = joinData.room;
          e = null;
        } else {
          const refetch = await supabase
            .from('rooms')
            .select('*')
            .eq('code', code.toUpperCase())
            .maybeSingle();
          data = refetch.data;
          e = refetch.error;
        }
      }

      if (cancelled) return;
      if (e || !data) {
        setError('Room not found');
        setLoading(false);
        return;
      }
      setRoom(data as Room);
      roomIdRef.current = data.id;
      setRematchInvite(null);

      const { data: gs } = await supabase
        .from('guesses')
        .select('*')
        .eq('room_id', data.id)
        .order('created_at', { ascending: true });
      if (!cancelled && gs) setGuesses(gs as Guess[]);

      const { data: sec } = await supabase
        .from('room_secrets')
        .select('secret')
        .eq('room_id', data.id)
        .eq('player_id', userId)
        .eq('is_shared', false)
        .maybeSingle();
      if (!cancelled && sec) setMySecret(sec.secret as number[]);

      let participantIds: string[] = [];
      if (data.mode === 'battle_royale') {
        const { data: ps } = await supabase
          .from('room_participants')
          .select('*')
          .eq('room_id', data.id);
        if (!cancelled && ps) {
          setParticipants(ps as Participant[]);
          participantIds = (ps as Participant[]).map((p) => p.user_id);
        }
      }

      const ids = Array.from(new Set([data.host_id, data.guest_id, ...participantIds].filter(Boolean))) as string[];
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

  useEffect(() => {
    if (!room || !userId) return;
    const roomId = room.id;
    const isBR = room.mode === 'battle_royale';

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        async (payload) => {
          const newRoom = payload.new as Room;
          setRoom(newRoom);
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
        if (evt.fromUserId === userId) return;
        setRematchInvite(evt);
      });

    if (isBR) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Participant;
            setParticipants((prev) => prev.filter((p) => p.user_id !== old.user_id));
            return;
          }
          const row = payload.new as Participant;
          setParticipants((prev) => {
            const others = prev.filter((p) => p.user_id !== row.user_id);
            return [...others, row];
          });
          if (!profiles[row.user_id]) {
            const { data: p } = await supabase.rpc('get_display_names', { _ids: [row.user_id] });
            const r = Array.isArray(p) ? (p[0] as { id: string; display_name: string } | undefined) : undefined;
            if (r) setProfiles((prev) => ({ ...prev, [r.id]: r.display_name }));
          }
        },
      );
    }

    channel.subscribe();

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
    participants,
    rematchInvite,
    clearRematchInvite: () => setRematchInvite(null),
    loading,
    error,
  };
}
