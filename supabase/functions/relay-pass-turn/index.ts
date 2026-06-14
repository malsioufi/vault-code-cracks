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
    const { data: room } = await sb.from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (!room || room.mode !== 'relay_race') return json({ error: 'Room not found' }, 404);
    if (room.status !== 'playing') return json({ error: 'Not playing' }, 409);
    if (!room.turn_deadline || new Date(room.turn_deadline).getTime() > Date.now()) {
      return json({ error: 'Turn not expired' }, 409);
    }

    const { data: tRow } = await sb
      .from('room_teams').select('*')
      .eq('room_id', roomId).eq('team', room.team_turn).maybeSingle();
    if (!tRow) return json({ error: 'Team not found' }, 404);

    const rotation = tRow.rotation as string[];
    const nextIdx = (tRow.rotation_index + 1) % rotation.length;
    await sb.from('room_teams').update({
      rotation_index: nextIdx,
      active_user_id: rotation[nextIdx],
    }).eq('room_id', roomId).eq('team', room.team_turn);

    const nextTurn = room.team_turn === 'A' ? 'B' : 'A';
    const deadline = new Date(Date.now() + 30_000).toISOString();
    await sb.from('rooms').update({
      team_turn: nextTurn,
      turn_deadline: deadline,
      turn_started_at: new Date().toISOString(),
    }).eq('id', roomId).eq('status', 'playing');

    return json({ ok: true });
  } catch (e) { console.error('relay-pass-turn error:', e); return json({ error: 'Internal server error' }, 500); }
});
