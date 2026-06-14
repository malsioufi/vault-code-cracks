import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUserFromRequest, serviceClient } from '../_shared/auth.ts';
import { evaluate, type UnlockContext } from '../_shared/achievements.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const sb = serviceClient();

    // Reject anonymous (guest) users from collecting achievements.
    // Uses the JWT-derived is_anonymous flag (set by Supabase Auth itself),
    // NOT profiles.is_guest — which is user-writable via RLS.
    if (user.isAnonymous) {
      return json({ ok: true, unlocked: [] });
    }

    // Build UnlockContext entirely from server-trusted data
    const [{ data: rooms }, { data: daily }, { data: streak }, { data: brParts }] = await Promise.all([
      sb
        .from('rooms')
        .select('id, host_id, guest_id, code_length, allow_duplicates, winner_id, finished_at, mode')
        .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
        .in('status', ['finished', 'abandoned'])
        .order('finished_at', { ascending: false, nullsFirst: false })
        .limit(200),
      sb
        .from('daily_results')
        .select('won, attempts_used')
        .eq('user_id', user.id),
      sb.rpc('get_daily_streak', { _user_id: user.id }),
      sb
        .from('room_participants')
        .select('room_id')
        .eq('user_id', user.id),
    ]);

    let rs = rooms ?? [];

    // Include BR rooms where user is a participant but not host/guest
    const extraIds = Array.from(new Set(
      (brParts ?? []).map((p: { room_id: string }) => p.room_id).filter((id: string) => !rs.some((r) => r.id === id)),
    ));
    if (extraIds.length) {
      const { data: brRooms } = await sb
        .from('rooms')
        .select('id, host_id, guest_id, code_length, allow_duplicates, winner_id, finished_at, mode')
        .in('id', extraIds)
        .in('status', ['finished', 'abandoned']);
      if (brRooms) rs = [...rs, ...brRooms];
      rs.sort((a, b) => new Date(b.finished_at ?? 0).getTime() - new Date(a.finished_at ?? 0).getTime());
    }

    const wonIds = rs.filter((r) => r.winner_id === user.id).map((r) => r.id);

    const counts: Record<string, number> = {};
    if (wonIds.length) {
      const { data: gs } = await sb
        .from('guesses')
        .select('room_id')
        .eq('player_id', user.id)
        .in('room_id', wonIds);
      for (const g of gs ?? []) {
        const rid = g.room_id as string;
        counts[rid] = (counts[rid] ?? 0) + 1;
      }
    }

    const brIds = rs.filter((r) => r.mode === 'battle_royale').map((r) => r.id);
    const playerCounts: Record<string, number> = {};
    if (brIds.length) {
      const { data: parts } = await sb
        .from('room_participants')
        .select('room_id')
        .in('room_id', brIds);
      for (const p of (parts ?? []) as { room_id: string }[]) {
        playerCounts[p.room_id] = (playerCounts[p.room_id] ?? 0) + 1;
      }
    }

    let currentStreak = 0;
    for (const r of rs) {
      if (r.winner_id === user.id) currentStreak++;
      else break;
    }

    const wonDaily = (daily ?? []).filter((d) => d.won);
    const s = Array.isArray(streak) && streak[0] ? streak[0] : null;

    const brMatches = rs.filter((r) => r.mode === 'battle_royale');
    const brWonMatches = brMatches.filter((r) => r.winner_id === user.id);
    const brBiggestWin = brWonMatches.reduce(
      (acc, r) => Math.max(acc, playerCounts[r.id] ?? 0),
      0,
    );

    const context: UnlockContext = {
      onlineWins: rs.filter((r) => r.winner_id === user.id).length,
      onlineMatches: rs.map((r) => ({
        won: r.winner_id === user.id,
        guessCount: counts[r.id],
        codeLength: r.code_length,
        allowDuplicates: r.allow_duplicates,
        finishedAt: r.finished_at,
        mode: r.mode,
        playerCount: playerCounts[r.id],
      })),
      currentWinStreak: currentStreak,
      dailyWins: wonDaily.length,
      dailyBestGuessCount: wonDaily.length ? Math.min(...wonDaily.map((d) => d.attempts_used)) : 0,
      dailyCurrentStreak: Number(s?.current_streak ?? 0),
      dailyBestStreak: Number(s?.best_streak ?? 0),
      battleRoyalePlays: brMatches.length,
      battleRoyaleWins: brWonMatches.length,
      battleRoyaleBiggestWin: brBiggestWin,
    };

    const eligible = evaluate(context);

    const { data: existing } = await sb
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', user.id);
    const have = new Set((existing ?? []).map((r) => r.achievement_id as string));
    const fresh = eligible.filter((id) => !have.has(id));

    if (fresh.length > 0) {
      const rows = fresh.map((achievement_id) => ({ user_id: user.id, achievement_id }));
      const { error } = await sb.from('user_achievements').insert(rows);
      if (error) {
        console.error('achievements insert error', error.message);
        return json({ error: 'Internal server error' }, 500);
      }
    }

    return json({ ok: true, unlocked: fresh });
  } catch (e) {
    console.error('sync-achievements error', e);
    return json({ error: 'Internal server error' }, 500);
  }
});
