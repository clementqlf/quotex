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
  const authUserId = user?.id; // This is a UUID string

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

    // GET /users/me OR /users/:username
    if (req.method === 'GET' && parts[0]) {
      let profileUser;

      if (parts[0] === 'me') {
        const authUser = await requireAuth(req);
        if (authUser instanceof Response) return authUser;
        
        const userRows = await sql`
          SELECT u.id, u.username, u.name, u.image, u.bio, u.website, u.followers, u.following
          FROM "Profile" u WHERE u.id = ${authUser.id} LIMIT 1
        `;
        if (!userRows.length) return error('User not found', 404);
        profileUser = userRows[0];
      } else {
        const raw = decodeURIComponent(parts[0]);
        const cleanUsername = raw.startsWith('@') ? raw.slice(1) : raw;

        const userRows = await sql`
          SELECT u.id, u.username, u.name, u.image, u.bio, u.website, u.followers, u.following
          FROM "Profile" u WHERE u.username ILIKE ${cleanUsername} LIMIT 1
        `;
        if (!userRows.length) return error(`User not found: '${cleanUsername}'`, 404);
        profileUser = userRows[0];
      }

      const quotes = await sql`
        SELECT q.*,
          row_to_json(a) as author,
          row_to_json(bk) as book,
          (SELECT COUNT(*) FROM "Like" l WHERE l."quoteId" = q.id)::int as "likesCount",
          COALESCE((SELECT json_agg(l) FROM "Like" l WHERE l."quoteId" = q.id AND l."userId" = ${authUserId ?? null}), '[]'::json) as likes,
          COALESCE((SELECT json_agg(s) FROM "UserQuote" s WHERE s."quoteId" = q.id AND s."userId" = ${authUserId ?? null}), '[]'::json) as "savedBy"
        FROM "Quote" q
        LEFT JOIN "Author" a ON a.id = q."authorId"
        LEFT JOIN "Book" bk ON bk.id = q."bookId"
        WHERE q."userId" = ${profileUser.id}
        ORDER BY q.date DESC
      `;

      const library = await sql`
        SELECT ub.status, ub."addedAt",
          json_build_object(
            'id', b.id,
            'title', b.title,
            'cover', b.cover,
            'year', b.year,
            'genre', b.genre,
            'description', b.description,
            'isbn', b.isbn,
            'rating', b.rating,
            'inventaireUri', b."inventaireUri",
            'googleId', b."googleId",
            'author', json_build_object('id', a.id, 'name', a.name, 'image', a.image)
          ) as book
        FROM "UserBook" ub
        JOIN "Book" b ON b.id = ub."bookId"
        LEFT JOIN "Author" a ON a.id = b."authorId"
        WHERE ub."userId" = ${profileUser.id}
        ORDER BY ub."addedAt" DESC
      `;

      return json({
        ...profileUser,
        quotes: quotes.map((q: any) => formatQuote(q, authUserId ?? '')),
        library,
      });
    }

    return error('Not found', 404);
  } catch (e) {
    console.error('[users]', e);
    return error('Internal server error');
  }
});
