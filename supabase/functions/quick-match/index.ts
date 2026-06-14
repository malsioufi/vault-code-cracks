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
    const action = body.action; // 'join' | 'leave'

    const sb = serviceClient();

    if (action === 'leave') {
      await sb.from('matchmaking_queue').delete().eq('user_id', user.id);
      return json({ ok: true });
    }

    const codeLength = Number(body.codeLength);
    const allowDuplicates = Boolean(body.allowDuplicates);
    const maxTries = body.maxTries == null ? null : Number(body.maxTries);
    const mode = body.mode === 'simultaneous' ? 'simultaneous' : 'turn_based';

    if (!Number.isInteger(codeLength) || codeLength < 3 || codeLength > 6) {
      return json({ error: 'Invalid codeLength' }, 400);
    }

    // Look for compatible waiting opponent
    const { data: opponents } = await sb
      .from('matchmaking_queue')
      .select('*')
      .eq('code_length', codeLength)
      .eq('allow_duplicates', allowDuplicates)
      .eq('mode', mode)
      .neq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(5);

    const compatible = (opponents || []).find(
      (o) => (o.max_tries ?? null) === (maxTries ?? null),
    );

    if (compatible) {
      // Pair them: remove from queue, create room
      await sb.from('matchmaking_queue').delete().eq('user_id', compatible.user_id);
      await sb.from('matchmaking_queue').delete().eq('user_id', user.id);

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
          host_id: compatible.user_id,
          guest_id: user.id,
          status: 'setting_secrets',
          mode,
          code_length: codeLength,
          allow_duplicates: allowDuplicates,
          max_tries: maxTries,
          is_quick_match: true,
        })
        .select()
        .single();

      if (error) console.error('db error in supabase/functions/quick-match/index.ts:', error.message); return json({ error: 'Internal server error' }, 500);
      return json({ matched: true, room });
    }

    // Add self to queue
    await sb.from('matchmaking_queue').upsert({
      user_id: user.id,
      code_length: codeLength,
      allow_duplicates: allowDuplicates,
      max_tries: maxTries,
      mode,
      joined_at: new Date().toISOString(),
    });

    return json({ matched: false, queued: true });
  } catch (e: unknown) { console.error('error in supabase/functions/quick-match/index.ts:', e); return json({ error: 'Internal server error' }, 500); }
});
