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

    const isMulti = prev.mode === 'battle_royale' || prev.mode === 'relay_race';

    if (isMulti) {
      const { data: part } = await sb
        .from('room_participants')
        .select('user_id')
        .eq('room_id', previousRoomId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!part) return json({ error: 'Not a participant' }, 403);
    } else {
      if (prev.host_id !== user.id && prev.guest_id !== user.id) {
        return json({ error: 'Not a participant' }, 403);
      }
    }

    if (prev.status !== 'finished' && prev.status !== 'abandoned') {
      return json({ error: 'Previous game not finished' }, 400);
    }

    if (!isMulti && !prev.guest_id) return json({ error: 'No opponent to rematch' }, 400);

    const opponentId = !isMulti ? (prev.host_id === user.id ? prev.guest_id : prev.host_id) : null;

    // If a rematch already exists for this previous room (created by either side), reuse it.
    {
      const { data: existingByParent } = await sb
        .from('rooms')
        .select('*')
        .eq('parent_room_id', previousRoomId)
        .in('status', ['waiting', 'setting_secrets', 'playing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingByParent) {
        // Ensure caller is a participant for multi modes
        if (isMulti) {
          const { data: alreadyIn } = await sb
            .from('room_participants')
            .select('user_id')
            .eq('room_id', existingByParent.id)
            .eq('user_id', user.id)
            .maybeSingle();
          if (!alreadyIn) {
            await sb.from('room_participants').insert({ room_id: existingByParent.id, user_id: user.id });
          }
        }
        return json({ room: existingByParent, reused: true });
      }
    }

    // Legacy fallback for 1v1: find a recent room with the same two participants.
    if (!isMulti && opponentId) {
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
    }

    // Generate unique code
    let code = '';
    for (let i = 0; i < 5; i++) {
      code = generateRoomCode();
      const { data } = await sb.from('rooms').select('id').eq('code', code).maybeSingle();
      if (!data) break;
    }

    // Create new room
    const insertData: Record<string, unknown> = {
      code,
      host_id: user.id,
      status: isMulti ? 'waiting' : 'setting_secrets',
      mode: prev.mode,
      code_length: prev.code_length,
      allow_duplicates: prev.allow_duplicates,
      max_tries: prev.max_tries,
      is_quick_match: prev.is_quick_match,
      parent_room_id: previousRoomId,
    };

    if (!isMulti && opponentId) {
      insertData.guest_id = opponentId;
    }

    if (isMulti) {
      insertData.min_players = prev.min_players ?? (prev.mode === 'relay_race' ? 2 : 2);
    }

    const { data: room, error } = await sb
      .from('rooms')
      .insert(insertData)
      .select()
      .single();

    if (error) { console.error('rematch db error:', error.message); return json({ error: 'Internal server error' }, 500); }

    if (isMulti) {
      await sb.from('room_participants').insert({ room_id: room.id, user_id: user.id });
    }

    // Broadcast invite on the previous room's channel so other players can join
    try {
      const channel = sb.channel(`room:${prev.id}`);
      await channel.send({
        type: 'broadcast',
        event: 'rematch',
        payload: { newRoomCode: room.code, newRoomId: room.id, fromUserId: user.id },
      });
    } catch (_e) {
      // best-effort; others can also poll/find via their own subscription
    }

    return json({ room });
  } catch (e: unknown) { console.error('error in supabase/functions/rematch/index.ts:', e); return json({ error: 'Internal server error' }, 500); }
});
