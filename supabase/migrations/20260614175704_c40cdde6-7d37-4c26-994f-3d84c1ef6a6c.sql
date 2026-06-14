
-- 1. Restrict profile SELECT to own row
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2. Prevent anonymous (guest) users from changing is_guest to false
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      OR is_guest = true
    )
  );

-- 3. Safe RPC to fetch display names for a set of user ids
CREATE OR REPLACE FUNCTION public.get_display_names(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, is_guest boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, COALESCE(p.display_name, 'Breaker') AS display_name, COALESCE(p.is_guest, false) AS is_guest
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_display_names(uuid[]) TO authenticated;
