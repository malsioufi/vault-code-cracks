import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUserFromRequest, serviceClient } from '../_shared/auth.ts';

function generateSecret(length: number, allowDuplicates: boolean): number[] {
  const out: number[] = [];
  const used = new Set<number>();
  while (out.length < length) {
    const d = Math.floor(Math.random() * 10);
    if (!allowDuplicates && used.has(d)) continue;
    used.add(d);
    out.push(d);
  }
  return out;
}

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
    if (!room) return json({ error: 'Room not found' }, 404);
    if (room.mode !== 'battle_royale') return json({ error: 'Not a battle royale room' }, 400);
    if (room.host_id !== user.id) return json({ error: 'Only host can start' }, 403);
    if (room.status !== 'waiting') return json({ error: 'Already started' }, 409);

    const { count } = await sb
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);
    const minP = room.min_players ?? 2;
    if ((count ?? 0) < minP) return json({ error: `Need at least ${minP} players` }, 409);

    const secret = generateSecret(room.code_length, room.allow_duplicates);

    const { error: secErr } = await sb.from('room_secrets').insert({
      room_id: roomId,
      player_id: room.host_id,
      secret,
      is_shared: true,
    });
    if (secErr) {
      console.error('start-br secret insert:', secErr.message);
      return json({ error: 'Failed to start' }, 500);
    }

    const nowIso = new Date().toISOString();
    await sb
      .from('rooms')
      .update({ status: 'playing', started_at: nowIso, turn_started_at: nowIso })
      .eq('id', roomId);

    return json({ ok: true });
  } catch (e: unknown) { console.error('start-br error:', e); return json({ error: 'Internal server error' }, 500); }
});
