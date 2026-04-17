import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUserFromRequest, serviceClient } from '../_shared/auth.ts';

const GRACE_MS = 30_000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const roomId = String(body.roomId || '');
    if (!roomId) return json({ error: 'Invalid roomId' }, 400);

    const sb = serviceClient();

    const { data: room } = await sb
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();
    if (!room) return json({ error: 'Room not found' }, 404);
    if (room.host_id !== user.id && room.guest_id !== user.id) {
      return json({ error: 'Not a participant' }, 403);
    }

    // Bump own presence
    await sb.from('presence').upsert(
      {
        room_id: roomId,
        player_id: user.id,
        last_seen_at: new Date().toISOString(),
        disconnected_at: null,
      },
      { onConflict: 'room_id,player_id' },
    );

    // Check opponent presence — auto-forfeit if dead
    const opponentId = room.host_id === user.id ? room.guest_id : room.host_id;
    let opponentDisconnected = false;
    let opponentLastSeen: string | null = null;

    if (opponentId && room.status === 'playing') {
      const { data: opp } = await sb
        .from('presence')
        .select('last_seen_at')
        .eq('room_id', roomId)
        .eq('player_id', opponentId)
        .maybeSingle();

      if (opp) {
        opponentLastSeen = opp.last_seen_at;
        const lastSeen = new Date(opp.last_seen_at).getTime();
        if (Date.now() - lastSeen > GRACE_MS) {
          opponentDisconnected = true;
          // Auto-forfeit opponent
          await sb
            .from('rooms')
            .update({
              status: 'abandoned',
              winner_id: user.id,
              finished_at: new Date().toISOString(),
            })
            .eq('id', roomId)
            .eq('status', 'playing');
        }
      }
    }

    return json({ ok: true, opponentDisconnected, opponentLastSeen });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
