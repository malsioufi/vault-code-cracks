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
    const code = String(body.code || '').toUpperCase().trim();
    if (!/^[A-Z2-9]{6}$/.test(code)) return json({ error: 'Invalid code' }, 400);

    const sb = serviceClient();

    const { data: room, error: fetchErr } = await sb
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (fetchErr) { console.error('join-room db error:', fetchErr.message); return json({ error: 'Internal server error' }, 500); }
    if (!room) return json({ error: 'Room not found' }, 404);

    // Battle Royale: insert into room_participants
    if (room.mode === 'battle_royale') {
      const { data: existing } = await sb
        .from('room_participants')
        .select('user_id')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing) return json({ room });

      if (room.status !== 'waiting') return json({ error: 'Game already started' }, 409);

      const { count } = await sb
        .from('room_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);
      if ((count ?? 0) >= 8) return json({ error: 'Room is full' }, 409);

      const { error: pErr } = await sb
        .from('room_participants')
        .insert({ room_id: room.id, user_id: user.id });
      if (pErr) {
        console.error('br join insert error:', pErr.message);
        return json({ error: 'Failed to join' }, 500);
      }
      return json({ room });
    }

    if (room.host_id === user.id || room.guest_id === user.id) {
      return json({ room });
    }

    if (room.status !== 'waiting' || room.guest_id !== null) {
      return json({ error: 'Room not joinable' }, 409);
    }

    const { data: updated, error: updErr } = await sb
      .from('rooms')
      .update({ guest_id: user.id, status: 'setting_secrets' })
      .eq('id', room.id)
      .eq('status', 'waiting')
      .is('guest_id', null)
      .select()
      .single();

    if (updErr || !updated) return json({ error: 'Failed to join' }, 409);
    return json({ room: updated });
  } catch (e: unknown) { console.error('join-room error:', e); return json({ error: 'Internal server error' }, 500); }
});
