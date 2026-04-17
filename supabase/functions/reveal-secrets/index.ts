// Returns BOTH players' secrets — only after the room is finished or abandoned.
import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
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

    const { data: room } = await sb
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();
    if (!room) return json({ error: 'Room not found' }, 404);
    if (room.host_id !== user.id && room.guest_id !== user.id) {
      return json({ error: 'Not a participant' }, 403);
    }
    if (room.status !== 'finished' && room.status !== 'abandoned') {
      return json({ error: 'Game not over' }, 409);
    }

    const { data: secrets } = await sb
      .from('room_secrets')
      .select('player_id, secret')
      .eq('room_id', roomId);

    return json({ secrets: secrets || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
