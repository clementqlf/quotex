import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== 'POST') return error('Method not allowed', 405);

  try {
    const { username } = await req.json();
    if (!username) return error('Username is required', 400);

    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

    // Vérification de l'existence dans Profile (insensible à la casse)
    const result = await sql`
      SELECT id FROM public."Profile" WHERE LOWER(username) = LOWER(${cleanUsername}) LIMIT 1
    `;

    return json({ exists: result.length > 0 });
  } catch (err) {
    console.error('[check-username] error:', err);
    return error('Internal server error', 500);
  }
});
