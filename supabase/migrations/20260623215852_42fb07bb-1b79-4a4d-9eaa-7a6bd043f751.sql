
CREATE OR REPLACE FUNCTION public.get_all_time_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE(
  rank integer,
  user_id uuid,
  display_name text,
  is_guest boolean,
  daily_wins integer,
  online_wins integer,
  best_daily_streak integer,
  score integer,
  is_me boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH daily AS (
    SELECT user_id, count(*) FILTER (WHERE won)::int AS wins
    FROM public.daily_results
    GROUP BY user_id
  ),
  online AS (
    SELECT winner_id AS user_id, count(*)::int AS wins
    FROM public.rooms
    WHERE winner_id IS NOT NULL AND status IN ('finished','abandoned')
    GROUP BY winner_id
  ),
  streaks AS (
    SELECT
      user_id,
      max(run_len)::int AS best_streak
    FROM (
      SELECT
        user_id,
        puzzle_date,
        won,
        count(*) FILTER (WHERE won) OVER (
          PARTITION BY user_id, grp
        ) AS run_len
      FROM (
        SELECT
          user_id,
          puzzle_date,
          won,
          puzzle_date - (row_number() OVER (PARTITION BY user_id ORDER BY puzzle_date))::int AS grp
        FROM public.daily_results
        WHERE won = true
      ) s
    ) t
    GROUP BY user_id
  ),
  combined AS (
    SELECT
      p.id AS user_id,
      COALESCE(p.display_name, 'Breaker') AS display_name,
      COALESCE(p.is_guest, false) AS is_guest,
      COALESCE(d.wins, 0) AS daily_wins,
      COALESCE(o.wins, 0) AS online_wins,
      COALESCE(s.best_streak, 0) AS best_daily_streak,
      (COALESCE(d.wins, 0) * 10 + COALESCE(o.wins, 0) * 15 + COALESCE(s.best_streak, 0) * 2) AS score
    FROM public.profiles p
    LEFT JOIN daily d ON d.user_id = p.id
    LEFT JOIN online o ON o.user_id = p.id
    LEFT JOIN streaks s ON s.user_id = p.id
    WHERE COALESCE(d.wins, 0) > 0 OR COALESCE(o.wins, 0) > 0
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY score DESC, daily_wins DESC, online_wins DESC, display_name ASC)::int AS rank,
      *
    FROM combined
  )
  SELECT
    r.rank,
    r.user_id,
    r.display_name,
    r.is_guest,
    r.daily_wins,
    r.online_wins,
    r.best_daily_streak,
    r.score,
    (auth.uid() IS NOT NULL AND r.user_id = auth.uid()) AS is_me
  FROM ranked r
  WHERE r.rank <= GREATEST(1, LEAST(_limit, 100))
  ORDER BY r.rank ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_time_leaderboard(integer) TO anon, authenticated;
