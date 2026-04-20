ALTER TABLE public.daily_results
  ADD COLUMN IF NOT EXISTS closeness smallint NOT NULL DEFAULT 0
  CHECK (closeness >= 0 AND closeness <= 100);

-- Backfill: wins => 100, losses => 0 (already the default)
UPDATE public.daily_results SET closeness = 100 WHERE won = true AND closeness = 0;