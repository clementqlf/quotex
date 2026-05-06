import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== 'POST') return error('Method not allowed', 405);

  try {
    const { email } = await req.json();
    if (!email) return error('Email is required', 400);

    // We check directly in auth.users table using our database connection
    // Note: The 'sql' client in _shared/db.ts must have access to the 'auth' schema
    const result = await sql`
      SELECT id FROM auth.users WHERE email = ${email.toLowerCase()} LIMIT 1
    `;

    return json({ exists: result.length > 0 });
  } catch (err) {
    console.error('[check-email] error:', err);
    return error('Internal server error', 500);
  }
});
