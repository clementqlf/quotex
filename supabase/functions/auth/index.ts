/**
 * Edge Function: /auth (DEPRECATED)
 * Note: This function is now legacy. Authentication is handled natively by Supabase Auth.
 * Use 'check-email' function for existence checks.
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, error } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  // This endpoint is no longer supported
  return error('This custom auth endpoint is deprecated. Please use native Supabase Auth.', 410);
});
