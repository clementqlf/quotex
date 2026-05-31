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
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/reviews/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  const idParam = parts[0] && !isNaN(Number(parts[0])) ? parseInt(parts[0]) : null;

  try {
    // GET /reviews?bookId=...
    if (req.method === 'GET' && !idParam) {
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
    if (req.method === 'POST' && !idParam) {
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



      return json(newReview[0]);
    }

    // PUT /reviews/:id
    if (req.method === 'PUT' && idParam) {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const { rating, comment } = await req.json();

      const review = await sql`SELECT * FROM "Review" WHERE id = ${idParam}`;
      if (!review.length) return error('Review not found', 404);
      if (review[0].userId !== authUser.id) return error('Unauthorized', 403);

      const updated = await sql`
        UPDATE "Review"
        SET rating = ${rating ?? review[0].rating},
            comment = ${comment !== undefined ? comment : review[0].comment}
        WHERE id = ${idParam}
        RETURNING *
      `;



      return json(updated[0]);
    }

    // DELETE /reviews/:id
    if (req.method === 'DELETE' && idParam) {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const review = await sql`SELECT * FROM "Review" WHERE id = ${idParam}`;
      if (!review.length) return error('Review not found', 404);
      if (review[0].userId !== authUser.id) return error('Unauthorized', 403);

      await sql`DELETE FROM "Review" WHERE id = ${idParam}`;



      return json({ success: true });
    }

    return error('Method not allowed', 405);
  } catch (e: any) {
    console.error('[reviews]', e);
    return error(`Internal server error: ${e.message || 'Unknown error'}`);
  }
});
