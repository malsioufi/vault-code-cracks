DROP FUNCTION IF EXISTS public.get_daily_leaderboard(date);

CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(_date date DEFAULT NULL::date)
 RETURNS TABLE(rank integer, user_id uuid, display_name text, is_guest boolean, attempts_used integer, finished_at timestamp with time zone, is_me boolean)
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
    r.user_id,
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