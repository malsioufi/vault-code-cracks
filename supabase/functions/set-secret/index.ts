import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { validateDigits } from '../_shared/game.ts';
import { getUserFromRequest, serviceClient } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const roomId = String(body.roomId || '');
    if (!roomId) return json({ error: 'Invalid roomId' }, 400);

    const sb = serviceClient();

    const { data: room, error: roomErr } = await sb
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if (roomErr || !room) return json({ error: 'Room not found' }, 404);
    if (room.host_id !== user.id && room.guest_id !== user.id) {
      return json({ error: 'Not a participant' }, 403);
    }
    if (room.status !== 'setting_secrets') {
      return json({ error: 'Cannot set secret now' }, 409);
    }

    const secret = validateDigits(body.secret, room.code_length, room.allow_duplicates);
    if (!secret) return json({ error: 'Invalid secret' }, 400);

    const { error: insErr } = await sb
      .from('room_secrets')
      .upsert({ room_id: roomId, player_id: user.id, secret });
    if (insErr) return json({ error: insErr.message }, 500);

    // Check if both secrets set
    const { data: secrets, error: countErr } = await sb
      .from('room_secrets')
      .select('player_id')
      .eq('room_id', roomId);
    if (countErr) return json({ error: countErr.message }, 500);

    if (secrets && secrets.length === 2) {
      // Start playing — host goes first in turn-based
      await sb
        .from('rooms')
        .update({
          status: 'playing',
          current_turn: room.mode === 'turn_based' ? room.host_id : null,
          turn_started_at: new Date().toISOString(),
        })
        .eq('id', roomId);
    }

    return json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
