// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { requireAuth, checkIfAdmin } from '../_shared/auth.ts';
import { mergeBooks, mergeAuthors } from '../_shared/inventaire.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/moderation/, '') || '/';
  
  try {
    const authUser = await requireAuth(req);
    if (authUser instanceof Response) return authUser;

    // POST /moderation/blocks
    if (req.method === 'POST' && path === '/blocks') {
      const { blockedId } = await req.json();
      if (!blockedId) return error('Missing blockedId', 400);

      await sql`
        INSERT INTO "UserBlock" ("blockerId", "blockedId", "createdAt")
        VALUES (${authUser.id}, ${blockedId}, now())
        ON CONFLICT ("blockerId", "blockedId") DO NOTHING
      `;
      return json({ success: true });
    }

    // POST /moderation/reports
    if (req.method === 'POST' && path === '/reports') {
      const { reviewId, reason } = await req.json();
      if (!reviewId || !reason) return error('Missing reviewId or reason', 400);

      await sql`
        INSERT INTO "Report" ("reporterId", "reviewId", "reason", "createdAt")
        VALUES (${authUser.id}, ${reviewId}, ${reason}, now())
        ON CONFLICT ("reporterId", "reviewId") DO NOTHING
      `;
      return json({ success: true });
    }

    // GET /moderation/sync
    if (req.method === 'GET' && path === '/sync') {
      const blocks = await sql`SELECT "blockedId" FROM "UserBlock" WHERE "blockerId" = ${authUser.id}`;
      const reports = await sql`SELECT "reviewId" FROM "Report" WHERE "reporterId" = ${authUser.id}`;

      return json({
        blockedIds: blocks.map(b => b.blockedId),
        reportedReviewIds: reports.map(r => String(r.reviewId))
      });
    }

    // GET /moderation/forbidden-words
    if (req.method === 'GET' && path === '/forbidden-words') {
      const words = await sql`SELECT "word" FROM "ForbiddenWord" ORDER BY "word" ASC`;
      return json({
        words: words.map(w => w.word)
      });
    }

    // GET /moderation/reports - Liste des signalements (admin only)
    if (req.method === 'GET' && path === '/reports') {
      const isAdmin = await checkIfAdmin(authUser.id);
      if (!isAdmin) return error('Unauthorized', 403);

      const reports = await sql`
        SELECT r.*, row_to_json(rv) as review, row_to_json(pr) as reporter
        FROM "Report" r
        LEFT JOIN "Review" rv ON rv.id = r."reviewId"
        LEFT JOIN "Profile" pr ON pr.id = r."reporterId"
        ORDER BY r."createdAt" DESC
      `;
      return json(reports);
    }

    // DELETE /moderation/reports/:id - Supprimer un avis signalé (admin only)
    if (req.method === 'DELETE' && path.match(/^\/reports\/\d+$/)) {
      const isAdmin = await checkIfAdmin(authUser.id);
      if (!isAdmin) return error('Unauthorized', 403);

      const reportId = parseInt(path.split('/')[2]);
      const report = await sql`SELECT * FROM "Report" WHERE id = ${reportId}`;
      if (!report.length) return error('Report not found', 404);

      // Supprimer l'avis ET le signalement
      await sql`DELETE FROM "Review" WHERE id = ${report[0].reviewId}`;
      await sql`DELETE FROM "Report" WHERE id = ${reportId}`;

      return json({ success: true });
    }

    // GET /moderation/unverified-books - Lister les livres non vérifiés (admin only)
    if (req.method === 'GET' && path === '/unverified-books') {
      const isAdmin = await checkIfAdmin(authUser.id);
      if (!isAdmin) return error('Unauthorized', 403);

      const books = await sql`
        SELECT b.*, row_to_json(a) as author,
          (SELECT count(*)::int FROM "Quote" q WHERE q."bookId" = b.id) as "quotesCount"
        FROM "Book" b
        LEFT JOIN "Author" a ON a.id = b."authorId"
        WHERE b."isVerified" = false
        ORDER BY b.id DESC
        LIMIT 50
      `;
      return json(books);
    }

    // POST /moderation/unverified-books/verify - Valider un livre (admin only)
    if (req.method === 'POST' && path === '/unverified-books/verify') {
      const isAdmin = await checkIfAdmin(authUser.id);
      if (!isAdmin) return error('Unauthorized', 403);

      const { bookId } = await req.json();
      if (!bookId) return error('Missing bookId', 400);

      await sql`UPDATE "Book" SET "isVerified" = true WHERE id = ${bookId}`;
      return json({ success: true });
    }

    // POST /moderation/unverified-books/merge - Fusionner un livre (admin only)
    if (req.method === 'POST' && path === '/unverified-books/merge') {
      const isAdmin = await checkIfAdmin(authUser.id);
      if (!isAdmin) return error('Unauthorized', 403);

      const { sourceBookId, targetBookId } = await req.json();
      if (!sourceBookId || !targetBookId) return error('Missing sourceBookId or targetBookId', 400);

      await mergeBooks(sourceBookId, targetBookId);
      return json({ success: true });
    }

    // GET /moderation/unverified-authors - Lister les auteurs non vérifiés (admin only)
    if (req.method === 'GET' && path === '/unverified-authors') {
      const isAdmin = await checkIfAdmin(authUser.id);
      if (!isAdmin) return error('Unauthorized', 403);

      const authors = await sql`
        SELECT a.*,
          (SELECT count(*)::int FROM "Quote" q WHERE q."authorId" = a.id) as "quotesCount"
        FROM "Author" a
        WHERE a."isVerified" = false
        ORDER BY a.id DESC
        LIMIT 50
      `;
      return json(authors);
    }

    // POST /moderation/unverified-authors/verify - Valider un auteur (admin only)
    if (req.method === 'POST' && path === '/unverified-authors/verify') {
      const isAdmin = await checkIfAdmin(authUser.id);
      if (!isAdmin) return error('Unauthorized', 403);

      const { authorId } = await req.json();
      if (!authorId) return error('Missing authorId', 400);

      await sql`UPDATE "Author" SET "isVerified" = true WHERE id = ${authorId}`;
      return json({ success: true });
    }

    // POST /moderation/unverified-authors/merge - Fusionner un auteur (admin only)
    if (req.method === 'POST' && path === '/unverified-authors/merge') {
      const isAdmin = await checkIfAdmin(authUser.id);
      if (!isAdmin) return error('Unauthorized', 403);

      const { sourceAuthorId, targetAuthorId } = await req.json();
      if (!sourceAuthorId || !targetAuthorId) return error('Missing sourceAuthorId or targetAuthorId', 400);

      await mergeAuthors(sourceAuthorId, targetAuthorId);
      return json({ success: true });
    }

    return error('Method not allowed or endpoint not found', 405);
  } catch (e: any) {
    console.error('[moderation]', e);
    return error(`Internal server error: ${e.message || 'Unknown error'}`);
  }
});
