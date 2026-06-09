/**
 * Edge Function: /users
 * Handles: GET /users/:username, PATCH /users/me
 * Note: Authentication is now handled by Supabase Auth.
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { getAuthUser, requireAuth } from '../_shared/auth.ts';
import { formatQuote } from '../_shared/formatters.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/users/, '') || '/';
  const parts = path.split('/').filter(Boolean);

  const user = await getAuthUser(req);
  const authUserId = user?.id ?? null; // This is a UUID string

  try {
    // PATCH /users/me
    if (req.method === 'PATCH' && parts[0] === 'me') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const { username, name, bio, website, image } = await req.json();
      const data: Record<string, any> = {};

      if (username) {
        const clean = username.startsWith('@') ? username.slice(1) : username;
        const conflict = await sql`
          SELECT id FROM "Profile" WHERE username = ${clean} AND id != ${authUser.id} LIMIT 1
        `;
        if (conflict.length) return error('Username already taken', 400);
        data.username = clean;
      }

      if (name) data.name = name;
      if (bio !== undefined) data.bio = bio;
      if (website !== undefined) data.website = website;
      if (image !== undefined) data.image = image;

      if (Object.keys(data).length === 0) return error('Nothing to update', 400);

      // Build dynamic SET clause
      const entries = Object.entries(data);
      const setClauses = entries
        .map(([k, v]) => sql`${sql(k)} = ${v}`)
        .reduce((acc, clause, i) => i === 0 ? clause : sql`${acc}, ${clause}`);

      const rows = await sql`
        UPDATE "Profile" SET ${setClauses} WHERE id = ${authUser.id}
        RETURNING id, username, name, image, bio, website, followers, following
      `;

      return json(rows[0]);
    }

    // DELETE /users/me
    if (req.method === 'DELETE' && parts[0] === 'me') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      // Import Supabase Client to delete the user from auth.users using Service Role
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      );

      // 1. Manually delete user data if necessary, or rely on ON DELETE CASCADE in Postgres.
      // Usually, auth.users has ON DELETE CASCADE to public.Profile.
      // If we want to be safe, we can manually delete Profile and UserQuote/UserBook, but let's just delete the user.
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      
      if (deleteError) {
        console.error('Failed to delete user:', deleteError);
        return error('Failed to delete user account', 500);
      }

      return json({ success: true, message: 'User account deleted successfully' });
    }

    // GET /users/me OR /users/:username
    if (req.method === 'GET' && parts[0]) {
      let profileUser;

      if (parts[0] === 'me') {
        const authUser = await requireAuth(req);
        if (authUser instanceof Response) return authUser;
        
        const userRows = await sql`
          SELECT u.id, u.username, u.name, u.image, u.bio, u.website, u.followers, u.following, u."isPublic"
          FROM "Profile" u WHERE u.id = ${authUser.id}::uuid LIMIT 1
        `;
        if (!userRows.length) return error('User not found', 404);
        profileUser = userRows[0];
      } else {
        // ✅ CORRECTION: Exiger authentification pour voir un profil public
        const authUser = await requireAuth(req);
        if (authUser instanceof Response) return authUser;

        const raw = decodeURIComponent(parts[0]);
        const cleanUsername = raw.startsWith('@') ? raw.slice(1) : raw;

        const userRows = await sql`
          SELECT u.id, u.username, u.name, u.image, u.bio, u.website, u.followers, u.following, u."isPublic"
          FROM "Profile" u WHERE u.username ILIKE ${cleanUsername} LIMIT 1
        `;
        if (!userRows.length) return error(`User not found: '${cleanUsername}'`, 404);
        profileUser = userRows[0];

        // ✅ CORRECTION: Bloquer l'accès si le profil est privé et n'appartient pas à l'utilisateur connecté
        if (!profileUser.isPublic && profileUser.id !== authUserId) {
          return error('User profile is private', 403);
        }
      }

      const quotes = await sql`
        SELECT q.*,
          row_to_json(a) as author,
          row_to_json(bk) as book,
          (SELECT COUNT(*) FROM "Like" l WHERE l."quoteId" = q.id)::int as "likesCount",
          COALESCE((SELECT json_agg(l) FROM "Like" l WHERE l."quoteId" = q.id AND l."userId" = ${authUserId}::uuid), '[]'::json) as likes,
          COALESCE((SELECT json_agg(s) FROM "UserQuote" s WHERE s."quoteId" = q.id AND s."userId" = ${authUserId}::uuid), '[]'::json) as "savedBy"
        FROM "Quote" q
        LEFT JOIN "Author" a ON a.id = q."authorId"
        LEFT JOIN "Book" bk ON bk.id = q."bookId"
        WHERE q."userId" = ${profileUser.id}::uuid
          AND (q."isPublic" = true OR ${profileUser.id} = ${authUserId}::uuid)
        ORDER BY q.date DESC
        LIMIT 50
      `;

      // ✅ CORRECTION: Ne pas exposer la bibliothèque privée d'un autre utilisateur
      const library = [];

      return json({
        ...profileUser,
        quotes: quotes.map((q: any) => formatQuote(q, authUserId ?? '')),
        library,  // ✅ CORRECTION: Bibliothèque vide pour les profils publics
      });
    }

    return error('Not found', 404);
  } catch (e) {
    console.error('[users]', e);
    return error('Internal server error');
  }
});
