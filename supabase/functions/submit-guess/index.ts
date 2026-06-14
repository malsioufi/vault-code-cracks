import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { evaluateGuess, validateDigits } from '../_shared/game.ts';
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

    const { data: room, error: roomErr } = await sb
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();
    if (roomErr || !room) return json({ error: 'Room not found' }, 404);

    if (room.status !== 'playing') return json({ error: 'Game not active' }, 409);

    const guess = validateDigits(body.guess, room.code_length, room.allow_duplicates);
    if (!guess) return json({ error: 'Invalid guess' }, 400);

    // ===== Battle Royale branch =====
    if (room.mode === 'battle_royale') {
      const { data: participant } = await sb
        .from('room_participants')
        .select('user_id, cracked, finished_at, gave_up_at')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!participant) return json({ error: 'Not a participant' }, 403);
      if (participant.finished_at || participant.cracked || participant.gave_up_at) {
        return json({ error: 'You are out' }, 409);
      }

      const { data: secretRow } = await sb
        .from('room_secrets')
        .select('secret')
        .eq('room_id', roomId)
        .eq('is_shared', true)
        .maybeSingle();
      if (!secretRow) return json({ error: 'Secret missing' }, 500);

      const feedback = evaluateGuess(guess, secretRow.secret as number[]);

      const { error: insErr } = await sb.from('guesses').insert({
        room_id: roomId,
        player_id: user.id,
        guess,
        matches: feedback.matches,
        shifts: feedback.shifts,
        glitches: feedback.glitches,
      });
      if (insErr) { console.error('br guess insert:', insErr.message); return json({ error: 'Internal server error' }, 500); }

      const nowIso = new Date().toISOString();

      // Win
      if (feedback.matches === room.code_length) {
        await sb
          .from('room_participants')
          .update({ cracked: true, finished_at: nowIso })
          .eq('room_id', roomId)
          .eq('user_id', user.id);
        await sb
          .from('rooms')
          .update({ status: 'finished', winner_id: user.id, finished_at: nowIso })
          .eq('id', roomId)
          .eq('status', 'playing');
        // Mark everyone else as finished too
        await sb
          .from('room_participants')
          .update({ finished_at: nowIso })
          .eq('room_id', roomId)
          .is('finished_at', null);
        return json({ feedback, finished: true, winner: user.id });
      }

      // Max tries — player out
      if (room.max_tries) {
        const { count } = await sb
          .from('guesses')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId)
          .eq('player_id', user.id);
        if (count !== null && count >= room.max_tries) {
          await sb
            .from('room_participants')
            .update({ finished_at: nowIso })
            .eq('room_id', roomId)
            .eq('user_id', user.id);

          // All done with nobody cracking?
          const { data: parts } = await sb
            .from('room_participants')
            .select('user_id, cracked, finished_at')
            .eq('room_id', roomId);
          const allDone = (parts || []).every((p) => p.finished_at !== null);
          if (allDone) {
            const winner = (parts || []).find((p) => p.cracked);
            await sb
              .from('rooms')
              .update({ status: 'finished', winner_id: winner?.user_id ?? null, finished_at: nowIso })
              .eq('id', roomId)
              .eq('status', 'playing');
          }
        }
      }

      return json({ feedback });
    }

    // ===== 1v1 branch =====
    if (room.host_id !== user.id && room.guest_id !== user.id) {
      return json({ error: 'Not a participant' }, 403);
    }
    if (room.mode === 'turn_based' && room.current_turn !== user.id) {
      return json({ error: 'Not your turn' }, 409);
    }

    const opponentId = room.host_id === user.id ? room.guest_id : room.host_id;
    if (!opponentId) return json({ error: 'No opponent' }, 409);

    const { data: secretRow, error: secretErr } = await sb
      .from('room_secrets')
      .select('secret')
      .eq('room_id', roomId)
      .eq('player_id', opponentId)
      .maybeSingle();
    if (secretErr || !secretRow) return json({ error: 'Opponent secret missing' }, 500);

    const feedback = evaluateGuess(guess, secretRow.secret as number[]);

    const { error: insErr } = await sb.from('guesses').insert({
      room_id: roomId,
      player_id: user.id,
      guess,
      matches: feedback.matches,
      shifts: feedback.shifts,
      glitches: feedback.glitches,
    });
    if (insErr) { console.error('submit-guess db:', insErr.message); return json({ error: 'Internal server error' }, 500); }

    if (feedback.matches === room.code_length) {
      await sb.from('rooms').update({
        status: 'finished',
        winner_id: user.id,
        finished_at: new Date().toISOString(),
      }).eq('id', roomId);
      return json({ feedback, finished: true, winner: user.id });
    }

    if (room.max_tries) {
      const { count } = await sb
        .from('guesses')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('player_id', user.id);
      if (count !== null && count >= room.max_tries) {
        await sb.from('rooms').update({
          status: 'finished',
          winner_id: opponentId,
          finished_at: new Date().toISOString(),
        }).eq('id', roomId);
        return json({ feedback, finished: true, winner: opponentId });
      }
    }

    if (room.mode === 'turn_based') {
      await sb.from('rooms').update({
        current_turn: opponentId,
        turn_started_at: new Date().toISOString(),
      }).eq('id', roomId);
    }

    return json({ feedback });
  } catch (e: unknown) { console.error('submit-guess error:', e); return json({ error: 'Internal server error' }, 500); }
});
