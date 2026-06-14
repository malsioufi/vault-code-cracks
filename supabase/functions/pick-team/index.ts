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
    const team = body.team === 'A' || body.team === 'B' ? body.team : null;
    if (!roomId || !team) return json({ error: 'Invalid input' }, 400);

    const sb = serviceClient();
    const { data: room } = await sb.from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (!room || room.mode !== 'relay_race') return json({ error: 'Room not found' }, 404);
    if (room.status !== 'waiting') return json({ error: 'Game already started' }, 409);

    const { data: part } = await sb
      .from('room_participants')
      .select('user_id, team')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!part) return json({ error: 'Not a participant' }, 403);
    if (part.team === team) return json({ ok: true });

    const { count } = await sb
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('team', team);
    if ((count ?? 0) >= 4) return json({ error: 'Team full' }, 409);

    await sb
      .from('room_participants')
      .update({ team })
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    return json({ ok: true });
  } catch (e) { console.error('pick-team error:', e); return json({ error: 'Internal server error' }, 500); }
});
