import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { getAuthUser } from '../_shared/auth.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== 'POST') return error('Method not allowed', 405);

  try {
    const { email } = await req.json();
    if (!email) return error('Email is required', 400);

    const authUser = await getAuthUser(req);
    const normalizedEmail = email.toLowerCase();

    // ✅ Sécurité: Si l'utilisateur est connecté, il ne peut vérifier que son propre email
    // (pour éviter les fuites de données sur les emails d'autres utilisateurs)
    if (authUser && authUser.email !== normalizedEmail) {
      return error('Forbidden: You can only check your own email', 403);
    }

    // Vérification dans auth.users
    const result = await sql`
      SELECT id FROM auth.users WHERE email = ${normalizedEmail} LIMIT 1
    `;

    return json({ exists: result.length > 0 });
  } catch (err) {
    console.error('[check-email] error:', err);
    return error('Internal server error', 500);
  }
});
