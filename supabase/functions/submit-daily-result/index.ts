import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUserFromRequest, serviceClient } from '../_shared/auth.ts';
import { closenessPercent, evaluateGuess, getDailyConfig } from '../_shared/daily.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const rawGuesses = body.guesses;
    if (!Array.isArray(rawGuesses) || rawGuesses.length === 0) {
      return json({ error: 'Invalid guesses' }, 400);
    }

    const cfg = getDailyConfig();

    // Validate every guess shape
    const guesses: number[][] = [];
    for (const g of rawGuesses) {
      if (!Array.isArray(g) || g.length !== cfg.codeLength) {
        return json({ error: 'Invalid guess shape' }, 400);
      }
      const norm: number[] = [];
      for (const d of g) {
        const n = Number(d);
        if (!Number.isInteger(n) || n < 0 || n > 9) {
          return json({ error: 'Invalid digit' }, 400);
        }
        norm.push(n);
      }
      if (!cfg.allowDuplicates && new Set(norm).size !== norm.length) {
        return json({ error: 'Duplicates not allowed' }, 400);
      }
      guesses.push(norm);
    }

    if (guesses.length > cfg.maxTries) {
      return json({ error: 'Too many guesses' }, 400);
    }

    // Re-evaluate server-side
    let won = false;
    let attemptsUsed = guesses.length;
    let bestMatches = 0;
    let bestShifts = 0;
    for (let i = 0; i < guesses.length; i++) {
      const fb = evaluateGuess(guesses[i], cfg.secret);
      if (fb.matches + fb.shifts > bestMatches + bestShifts) {
        bestMatches = fb.matches;
        bestShifts = fb.shifts;
      }
      if (fb.matches === cfg.codeLength) {
        won = true;
        attemptsUsed = i + 1;
        break;
      }
    }
    const finished = won || attemptsUsed >= cfg.maxTries;
    const closeness = won ? 100 : closenessPercent(bestMatches, bestShifts, cfg.codeLength);

    const sb = serviceClient();

    // If a finalized record already exists, never overwrite it (anti-cheat).
    const { data: existing } = await sb
      .from('daily_results')
      .select('won, attempts_used, max_tries')
      .eq('user_id', user.id)
      .eq('puzzle_date', cfg.date)
      .maybeSingle();

    if (existing) {
      const existingFinished = existing.won || (existing.attempts_used ?? 0) >= (existing.max_tries ?? cfg.maxTries);
      if (existingFinished) {
        return json({ ok: true, alreadyRecorded: true });
      }
      // In-progress: only allow extending with more guesses (prevent rewinding).
      if (guesses.length < (existing.attempts_used ?? 0)) {
        return json({ ok: true, ignored: true });
      }
    }

    const { error } = await sb.from('daily_results').upsert({
      user_id: user.id,
      puzzle_date: cfg.date,
      won,
      attempts_used: attemptsUsed,
      code_length: cfg.codeLength,
      max_tries: cfg.maxTries,
      allow_duplicates: cfg.allowDuplicates,
      guesses: guesses.slice(0, attemptsUsed),
      closeness,
    }, { onConflict: 'user_id,puzzle_date' });
    if (error) {
      console.error('daily upsert error', error.message);
      return json({ error: 'Internal server error' }, 500);
    }
    return json({ ok: true, won, attemptsUsed, closeness, finished });
  } catch (e) {
    console.error('submit-daily-result error', e);
    return json({ error: 'Internal server error' }, 500);
  }
});
