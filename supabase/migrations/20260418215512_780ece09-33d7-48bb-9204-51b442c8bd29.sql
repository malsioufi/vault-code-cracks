
-- Daily puzzle results: one row per user per UTC day
CREATE TABLE public.daily_results (
  user_id uuid NOT NULL,
  puzzle_date date NOT NULL,
  won boolean NOT NULL,
  attempts_used integer NOT NULL,
  code_length integer NOT NULL,
  max_tries integer NOT NULL,
  allow_duplicates boolean NOT NULL,
  guesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, puzzle_date)
);

ALTER TABLE public.daily_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own daily results"
  ON public.daily_results FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own daily result"
  ON public.daily_results FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE policies: results are immutable, one attempt per day.

-- Streak calculation: counts consecutive WON days ending at today (or yesterday if today not yet played).
CREATE OR REPLACE FUNCTION public.get_daily_streak(_user_id uuid)
RETURNS TABLE(current_streak integer, best_streak integer, total_played integer, total_won integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT count(*), count(*) FILTER (WHERE won) INTO played, won_count
  FROM public.daily_results WHERE user_id = _user_id;

  -- Best streak: scan all rows oldest->newest
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

  -- Current streak: must include today or yesterday and be unbroken backwards (only wins count).
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
$$;
