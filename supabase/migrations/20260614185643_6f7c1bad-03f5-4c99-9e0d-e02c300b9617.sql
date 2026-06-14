CREATE OR REPLACE FUNCTION public.get_public_profile_stats(_user_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, is_guest boolean, online_played integer, online_wins integer, online_losses integer, daily_played integer, daily_wins integer, daily_current_streak integer, daily_best_streak integer, achievements_unlocked integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  prof_display_name text;
  prof_is_guest boolean;
  prof_found boolean := false;
BEGIN
  SELECT p.display_name, p.is_guest, true
    INTO prof_display_name, prof_is_guest, prof_found
    FROM public.profiles p WHERE p.id = _user_id;

  IF NOT prof_found THEN
    RETURN;
  END IF;

  SELECT
    count(*) FILTER (WHERE r.status IN ('finished','abandoned')),
    count(*) FILTER (WHERE r.winner_id = _user_id),
    count(*) FILTER (WHERE r.status IN ('finished','abandoned') AND r.winner_id IS NOT NULL AND r.winner_id <> _user_id)
  INTO played, wins, losses
  FROM public.rooms r
  WHERE (r.host_id = _user_id OR r.guest_id = _user_id);

  SELECT count(*), count(*) FILTER (WHERE dr.won)
  INTO d_played, d_wins
  FROM public.daily_results dr WHERE dr.user_id = _user_id;

  FOR rec IN
    SELECT dr.puzzle_date, dr.won FROM public.daily_results dr
    WHERE dr.user_id = _user_id ORDER BY dr.puzzle_date ASC
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

  SELECT EXISTS (SELECT 1 FROM public.daily_results dr WHERE dr.user_id = _user_id AND dr.puzzle_date = today) INTO has_today;
  IF has_today THEN cur_anchor := today; ELSE cur_anchor := today - 1; END IF;

  cur_streak := 0;
  FOR rec IN
    SELECT dr.puzzle_date, dr.won FROM public.daily_results dr
    WHERE dr.user_id = _user_id AND dr.puzzle_date <= cur_anchor
    ORDER BY dr.puzzle_date DESC
  LOOP
    IF rec.puzzle_date = cur_anchor AND rec.won THEN
      cur_streak := cur_streak + 1;
      cur_anchor := cur_anchor - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  SELECT count(*) INTO ach_count FROM public.user_achievements ua WHERE ua.user_id = _user_id;

  RETURN QUERY SELECT
    _user_id,
    COALESCE(prof_display_name, 'Breaker'),
    COALESCE(prof_is_guest, false),
    played, wins, losses,
    d_played, d_wins,
    cur_streak, best_streak,
    ach_count;
END;
$function$;