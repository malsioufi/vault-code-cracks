import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function getUserFromRequest(req: Request): Promise<{ id: string; isAnonymous: boolean } | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const token = auth.replace('Bearer ', '');
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  // Supabase sets is_anonymous on the user object and in the JWT claims
  const u = data.user as { id: string; is_anonymous?: boolean };
  return { id: u.id, isAnonymous: u.is_anonymous === true };
}
