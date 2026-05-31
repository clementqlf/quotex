/**
 * Edge Function: /reviews
 * Handles: GET /reviews?bookId=..., POST /reviews
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { requireAuth } from '../_shared/auth.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);

  try {
    // GET /reviews?bookId=...
    if (req.method === 'GET') {
      const bookIdParam = url.searchParams.get('bookId');
      if (!bookIdParam) return error('Missing bookId query parameter', 400);
      const bookId = parseInt(bookIdParam);
      if (isNaN(bookId)) return error('Invalid bookId', 400);

      const reviews = await sql`
        SELECT r.*, row_to_json(u) as user, row_to_json(b) as book
        FROM "Review" r
        LEFT JOIN "Profile" u ON u.id = r."userId"
        LEFT JOIN "Book" b ON b.id = r."bookId"
        WHERE r."bookId" = ${bookId}
        ORDER BY r."createdAt" DESC
      `;
      return json(reviews);
    }

    // POST /reviews
    if (req.method === 'POST') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const { rating, comment, bookId } = await req.json();
      if (!rating || !bookId) return error('Missing required fields', 400);

      const newReview = await sql`
        WITH inserted AS (
          INSERT INTO "Review" ("rating", "comment", "bookId", "userId", "createdAt")
          VALUES (${rating}, ${comment ?? null}, ${bookId}, ${authUser.id}, now())
          RETURNING *
        )
        SELECT i.*, row_to_json(u) as user, row_to_json(b) as book
        FROM inserted i
        LEFT JOIN "Profile" u ON u.id = i."userId"
        LEFT JOIN "Book" b ON b.id = i."bookId"
      `;

      // Recalculate average rating
      const aggRows = await sql`SELECT AVG(rating)::float as avg FROM "Review" WHERE "bookId" = ${bookId}`;
      const newAvg = aggRows[0]?.avg ?? rating;
      await sql`UPDATE "Book" SET rating = ${newAvg} WHERE id = ${bookId}`;

      return json(newReview[0]);
    }

    return error('Method not allowed', 405);
  } catch (e: any) {
    console.error('[reviews]', e);
    return error(`Internal server error: ${e.message || 'Unknown error'}`);
  }
});
