
-- Remove client INSERT policies; writes go through edge functions (service role)
DROP POLICY IF EXISTS "Users insert own daily result" ON public.daily_results;
DROP POLICY IF EXISTS "Users insert own achievements" ON public.user_achievements;

-- Lock down get_daily_streak to caller's own user id
CREATE OR REPLACE FUNCTION public.get_daily_streak(_user_id uuid)
 RETURNS TABLE(current_streak integer, best_streak integer, total_played integer, total_won integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cur integer := 0;
  best integer := 0;
  run integer := 0;
  prev_date date := NULL;
  rec record;
  today date := (now() AT TIME ZONE 'UTC')::date;
  played integer := 0;
  won_count integer := 0;
  cur_anchor date;
  has_today boolean := false;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE won) INTO played, won_count
  FROM public.daily_results WHERE user_id = _user_id;

  FOR rec IN
    SELECT puzzle_date, won FROM public.daily_results
    WHERE user_id = _user_id ORDER BY puzzle_date ASC
  LOOP
    IF rec.won THEN
      IF prev_date IS NOT NULL AND rec.puzzle_date = prev_date + 1 THEN
        run := run + 1;
      ELSE
        run := 1;
      END IF;
      IF run > best THEN best := run; END IF;
    ELSE
      run := 0;
    END IF;
    prev_date := rec.puzzle_date;
  END LOOP;

  SELECT EXISTS (SELECT 1 FROM public.daily_results WHERE user_id = _user_id AND puzzle_date = today) INTO has_today;
  IF has_today THEN
    cur_anchor := today;
  ELSE
    cur_anchor := today - 1;
  END IF;

  cur := 0;
  FOR rec IN
    SELECT puzzle_date, won FROM public.daily_results
    WHERE user_id = _user_id AND puzzle_date <= cur_anchor
    ORDER BY puzzle_date DESC
  LOOP
    IF rec.puzzle_date = cur_anchor AND rec.won THEN
      cur := cur + 1;
      cur_anchor := cur_anchor - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY SELECT cur, best, played, won_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_daily_streak(uuid) FROM anon;

-- Replace leaderboard to drop user_id and add is_me
DROP FUNCTION IF EXISTS public.get_daily_leaderboard(date);
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(_date date DEFAULT NULL::date)
 RETURNS TABLE(rank integer, display_name text, is_guest boolean, attempts_used integer, finished_at timestamp with time zone, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT COALESCE(_date, (now() AT TIME ZONE 'UTC')::date) AS d
  ),
  ranked AS (
    SELECT
      dr.user_id,
      dr.attempts_used,
      dr.created_at AS finished_at,
      ROW_NUMBER() OVER (
        ORDER BY dr.attempts_used ASC, dr.created_at ASC
      ) AS rnk
    FROM public.daily_results dr, target
    WHERE dr.puzzle_date = target.d
      AND dr.won = true
  )
  SELECT
    r.rnk::int AS rank,
    COALESCE(p.display_name, 'Breaker') AS display_name,
    COALESCE(p.is_guest, false) AS is_guest,
    r.attempts_used,
    r.finished_at,
    (auth.uid() IS NOT NULL AND r.user_id = auth.uid()) AS is_me
  FROM ranked r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.rnk <= 20
  ORDER BY r.rnk ASC;
$function$;
