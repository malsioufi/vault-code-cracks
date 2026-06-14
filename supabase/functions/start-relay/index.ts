import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUserFromRequest, serviceClient } from '../_shared/auth.ts';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    if (!room || room.mode !== 'relay_race') return json({ error: 'Room not found' }, 404);
    if (room.host_id !== user.id) return json({ error: 'Only host can start' }, 403);
    if (room.status !== 'waiting') return json({ error: 'Already started' }, 409);

    const { data: parts } = await sb
      .from('room_participants')
      .select('user_id, team')
      .eq('room_id', roomId);
    const teamA = (parts || []).filter((p) => p.team === 'A').map((p) => p.user_id);
    const teamB = (parts || []).filter((p) => p.team === 'B').map((p) => p.user_id);
    const minP = room.min_players ?? 2;
    if (teamA.length < minP || teamB.length < minP) {
      return json({ error: `Each team needs at least ${minP} players` }, 409);
    }

    const rotA = shuffle(teamA);
    const rotB = shuffle(teamB);
    const setterA = rotA[Math.floor(Math.random() * rotA.length)];
    const setterB = rotB[Math.floor(Math.random() * rotB.length)];
    const deadline = new Date(Date.now() + 60_000).toISOString();

    const { error: tErr } = await sb.from('room_teams').upsert([
      {
        room_id: roomId, team: 'A',
        setter_id: setterA, setter_deadline: deadline,
        rotation: rotA, rotation_index: 0, active_user_id: rotA[0],
        guesses_count: 0, secret_set: false, failed_setters: [],
      },
      {
        room_id: roomId, team: 'B',
        setter_id: setterB, setter_deadline: deadline,
        rotation: rotB, rotation_index: 0, active_user_id: rotB[0],
        guesses_count: 0, secret_set: false, failed_setters: [],
      },
    ]);
    if (tErr) { console.error('start-relay teams:', tErr.message); return json({ error: 'Failed to start' }, 500); }

    const nowIso = new Date().toISOString();
    await sb.from('rooms').update({ status: 'setting_secrets', started_at: nowIso }).eq('id', roomId);

    return json({ ok: true });
  } catch (e) { console.error('start-relay error:', e); return json({ error: 'Internal server error' }, 500); }
});
