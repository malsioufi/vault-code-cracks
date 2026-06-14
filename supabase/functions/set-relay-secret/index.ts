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
    const { data: room } = await sb.from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (!room || room.mode !== 'relay_race') return json({ error: 'Room not found' }, 404);
    if (room.status !== 'setting_secrets') return json({ error: 'Not setting phase' }, 409);

    const { data: teams } = await sb
      .from('room_teams')
      .select('*')
      .eq('room_id', roomId);
    const myTeam = (teams || []).find((t) => t.setter_id === user.id);
    if (!myTeam) return json({ error: 'You are not the setter' }, 403);
    if (myTeam.secret_set) return json({ error: 'Already set' }, 409);

    const secret = validateDigits(body.secret, room.code_length, room.allow_duplicates);
    if (!secret) return json({ error: 'Invalid secret' }, 400);

    const { error: insErr } = await sb
      .from('room_secrets')
      .upsert({ room_id: roomId, player_id: user.id, secret, is_shared: false });
    if (insErr) { console.error('set-relay-secret insert:', insErr.message); return json({ error: 'Internal server error' }, 500); }

    await sb.from('room_teams').update({ secret_set: true, setter_deadline: null })
      .eq('room_id', roomId).eq('team', myTeam.team);

    const bothSet = (teams || []).every((t) => t.team === myTeam.team ? true : t.secret_set);
    if (bothSet) {
      const deadline = new Date(Date.now() + 30_000).toISOString();
      await sb.from('rooms').update({
        status: 'playing',
        team_turn: 'A',
        turn_deadline: deadline,
        turn_started_at: new Date().toISOString(),
      }).eq('id', roomId);
    }

    return json({ ok: true });
  } catch (e) { console.error('set-relay-secret error:', e); return json({ error: 'Internal server error' }, 500); }
});
