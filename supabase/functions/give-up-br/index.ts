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
    if (!room || room.mode !== 'battle_royale') return json({ error: 'Room not found' }, 404);
    if (room.status !== 'playing') return json({ error: 'Game not active' }, 409);

    const nowIso = new Date().toISOString();
    await sb
      .from('room_participants')
      .update({ gave_up_at: nowIso, finished_at: nowIso })
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('gave_up_at', null);

    // If everyone is done and no winner, finish room.
    const { data: parts } = await sb
      .from('room_participants')
      .select('user_id, cracked, finished_at')
      .eq('room_id', roomId);
    const allDone = (parts || []).every((p) => p.finished_at !== null);
    if (allDone) {
      const winner = (parts || []).find((p) => p.cracked);
      await sb
        .from('rooms')
        .update({
          status: 'finished',
          winner_id: winner?.user_id ?? null,
          finished_at: nowIso,
        })
        .eq('id', roomId)
        .eq('status', 'playing');
    }

    return json({ ok: true });
  } catch (e: unknown) { console.error('give-up-br error:', e); return json({ error: 'Internal server error' }, 500); }
});
