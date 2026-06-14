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
    const codeLength = Number(body.codeLength);
    const allowDuplicates = Boolean(body.allowDuplicates);
    const maxTries = body.maxTries === null || body.maxTries === undefined
      ? null
      : Number(body.maxTries);
    const mode = body.mode === 'simultaneous'
      ? 'simultaneous'
      : body.mode === 'battle_royale'
        ? 'battle_royale'
        : body.mode === 'relay_race'
          ? 'relay_race'
          : 'turn_based';
    const minPlayers = mode === 'battle_royale'
      ? Math.max(2, Math.min(8, Number(body.minPlayers) || 2))
      : mode === 'relay_race'
        ? Math.max(2, Math.min(4, Number(body.minPlayersPerTeam) || 2))
        : null;

    if (!Number.isInteger(codeLength) || codeLength < 3 || codeLength > 6) {
      return json({ error: 'Invalid codeLength' }, 400);
    }
    if (maxTries !== null && (!Number.isInteger(maxTries) || maxTries < 1 || maxTries > 50)) {
      return json({ error: 'Invalid maxTries' }, 400);
    }

    const sb = serviceClient();

    let code = '';
    for (let i = 0; i < 5; i++) {
      code = generateRoomCode();
      const { data } = await sb.from('rooms').select('id').eq('code', code).maybeSingle();
      if (!data) break;
    }

    const { data: room, error } = await sb
      .from('rooms')
      .insert({
        code,
        host_id: user.id,
        status: 'waiting',
        mode,
        code_length: codeLength,
        allow_duplicates: allowDuplicates,
        max_tries: maxTries,
        min_players: minPlayers,
      })
      .select()
      .single();

    if (error) {
      console.error('create-room db error:', error.message);
      return json({ error: 'Internal server error' }, 500);
    }

    if (mode === 'battle_royale' || mode === 'relay_race') {
      await sb.from('room_participants').insert({ room_id: room.id, user_id: user.id });
    }

    return json({ room });
  } catch (e: unknown) {
    console.error('create-room error:', e);
    return json({ error: 'Internal server error' }, 500);
  }
});
