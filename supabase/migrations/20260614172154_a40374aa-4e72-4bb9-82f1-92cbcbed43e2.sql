CREATE OR REPLACE FUNCTION public.get_public_profile_stats(_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  is_guest boolean,
  online_played integer,
  online_wins integer,
  online_losses integer,
  daily_played integer,
  daily_wins integer,
  daily_current_streak integer,
  daily_best_streak integer,
  achievements_unlocked integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  played int := 0;
  wins int := 0;
  losses int := 0;
  d_played int := 0;
  d_wins int := 0;
  cur_streak int := 0;
  best_streak int := 0;
  run int := 0;
  prev_date date := NULL;
  rec record;
  today date := (now() AT TIME ZONE 'UTC')::date;
  cur_anchor date;
  has_today boolean := false;
  ach_count int := 0;
  prof record;
BEGIN
  SELECT p.display_name, p.is_guest INTO prof
    FROM public.profiles p WHERE p.id = _user_id;

  IF prof IS NULL THEN
    RETURN;
  END IF;

  SELECT
    count(*) FILTER (WHERE status IN ('finished','abandoned')),
    count(*) FILTER (WHERE winner_id = _user_id),
    count(*) FILTER (WHERE status IN ('finished','abandoned') AND winner_id IS NOT NULL AND winner_id <> _user_id)
  INTO played, wins, losses
  FROM public.rooms
  WHERE (host_id = _user_id OR guest_id = _user_id);

  SELECT count(*), count(*) FILTER (WHERE won)
  INTO d_played, d_wins
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
      IF run > best_streak THEN best_streak := run; END IF;
    ELSE
      run := 0;
    END IF;
    prev_date := rec.puzzle_date;
  END LOOP;

  SELECT EXISTS (SELECT 1 FROM public.daily_results WHERE user_id = _user_id AND puzzle_date = today) INTO has_today;
  IF has_today THEN cur_anchor := today; ELSE cur_anchor := today - 1; END IF;

  cur_streak := 0;
  FOR rec IN
    SELECT puzzle_date, won FROM public.daily_results
    WHERE user_id = _user_id AND puzzle_date <= cur_anchor
    ORDER BY puzzle_date DESC
  LOOP
    IF rec.puzzle_date = cur_anchor AND rec.won THEN
      cur_streak := cur_streak + 1;
      cur_anchor := cur_anchor - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  SELECT count(*) INTO ach_count FROM public.user_achievements WHERE user_achievements.user_id = _user_id;

  RETURN QUERY SELECT
    _user_id,
    COALESCE(prof.display_name, 'Breaker'),
    COALESCE(prof.is_guest, false),
    played, wins, losses,
    d_played, d_wins,
    cur_streak, best_streak,
    ach_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_stats(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_public_daily_recent(_user_id uuid, _limit integer DEFAULT 10)
RETURNS TABLE(puzzle_date date, won boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT puzzle_date, won
  FROM public.daily_results
  WHERE user_id = _user_id
  ORDER BY puzzle_date DESC
  LIMIT GREATEST(1, LEAST(_limit, 30));
$$;

GRANT EXECUTE ON FUNCTION public.get_public_daily_recent(uuid, integer) TO authenticated, anon;