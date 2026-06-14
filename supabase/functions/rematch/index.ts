import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { generateRoomCode } from '../_shared/game.ts';
import { getUserFromRequest, serviceClient } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const previousRoomId = String(body.previousRoomId || '');
    if (!previousRoomId) return json({ error: 'previousRoomId required' }, 400);

    const sb = serviceClient();

    // Load previous room and verify the user was a participant + it's actually finished/abandoned
    const { data: prev, error: prevErr } = await sb
      .from('rooms')
      .select('*')
      .eq('id', previousRoomId)
      .maybeSingle();
    if (prevErr || !prev) return json({ error: 'Previous room not found' }, 404);
    if (prev.host_id !== user.id && prev.guest_id !== user.id) {
      return json({ error: 'Not a participant' }, 403);
    }
    if (prev.status !== 'finished' && prev.status !== 'abandoned') {
      return json({ error: 'Previous game not finished' }, 400);
    }
    if (!prev.guest_id) return json({ error: 'No opponent to rematch' }, 400);

    const opponentId = prev.host_id === user.id ? prev.guest_id : prev.host_id;

    // If a rematch already exists for this previous room (created by either side), reuse it.
    // We encode the link via code prefix is overkill; instead look for a recently created room
    // with the same two participants AND status waiting/setting_secrets that is newer than prev.
    const { data: existing } = await sb
      .from('rooms')
      .select('*')
      .or(`and(host_id.eq.${user.id},guest_id.eq.${opponentId}),and(host_id.eq.${opponentId},guest_id.eq.${user.id})`)
      .gt('created_at', prev.finished_at ?? prev.updated_at ?? prev.created_at)
      .in('status', ['waiting', 'setting_secrets', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return json({ room: existing, reused: true });
    }

    // Generate unique code
    let code = '';
    for (let i = 0; i < 5; i++) {
      code = generateRoomCode();
      const { data } = await sb.from('rooms').select('id').eq('code', code).maybeSingle();
      if (!data) break;
    }

    // Create new room: requester becomes host, opponent pre-assigned as guest, jump straight to setting_secrets
    const { data: room, error } = await sb
      .from('rooms')
      .insert({
        code,
        host_id: user.id,
        guest_id: opponentId,
        status: 'setting_secrets',
        mode: prev.mode,
        code_length: prev.code_length,
        allow_duplicates: prev.allow_duplicates,
        max_tries: prev.max_tries,
        is_quick_match: prev.is_quick_match,
      })
      .select()
      .single();

    if (error) { console.error('rematch db error:', error.message); return json({ error: 'Internal server error' }, 500); }

    // Broadcast invite on the previous room's channel so the opponent's open client navigates over
    try {
      const channel = sb.channel(`room:${prev.id}`);
      await channel.send({
        type: 'broadcast',
        event: 'rematch',
        payload: { newRoomCode: room.code, newRoomId: room.id, fromUserId: user.id },
      });
    } catch (_e) {
      // best-effort; opponent can also poll/find via their own subscription
    }

    return json({ room });
  } catch (e: unknown) { console.error('error in supabase/functions/rematch/index.ts:', e); return json({ error: 'Internal server error' }, 500); }
});
