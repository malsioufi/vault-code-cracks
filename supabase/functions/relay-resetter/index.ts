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
    if (room.status !== 'setting_secrets') return json({ error: 'Not setting phase' }, 409);

    const { data: tRow } = await sb
      .from('room_teams').select('*')
      .eq('room_id', roomId).eq('team', team).maybeSingle();
    if (!tRow) return json({ error: 'Team not found' }, 404);
    if (tRow.secret_set) return json({ ok: true });
    if (!tRow.setter_deadline || new Date(tRow.setter_deadline).getTime() > Date.now()) {
      return json({ error: 'Setter still has time' }, 409);
    }

    const failed: string[] = [...(tRow.failed_setters || []), tRow.setter_id].filter(Boolean) as string[];
    const candidates = (tRow.rotation as string[]).filter((u) => !failed.includes(u));
    if (candidates.length === 0) {
      await sb.from('rooms').update({ status: 'abandoned', finished_at: new Date().toISOString() })
        .eq('id', roomId).eq('status', 'setting_secrets');
      return json({ abandoned: true });
    }

    const newSetter = candidates[Math.floor(Math.random() * candidates.length)];
    const deadline = new Date(Date.now() + 60_000).toISOString();
    await sb.from('room_teams').update({
      setter_id: newSetter,
      setter_deadline: deadline,
      failed_setters: failed,
    }).eq('room_id', roomId).eq('team', team);

    return json({ ok: true });
  } catch (e) { console.error('relay-resetter error:', e); return json({ error: 'Internal server error' }, 500); }
});
