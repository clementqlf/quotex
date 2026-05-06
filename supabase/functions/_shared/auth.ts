// @ts-ignore deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

export interface AuthUser {
  id: string; // UUID string from Supabase Auth
  email?: string;
}

/**
 * Verifies the JWT from the Authorization header using Supabase Auth
 */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    console.error('[auth] Verification failed:', error?.message);
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}

/**
 * Requires authentication and returns the user or a 401 error response
 */
export async function requireAuth(req: Request): Promise<AuthUser | Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return user;
}
