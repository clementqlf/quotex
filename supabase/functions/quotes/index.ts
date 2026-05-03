/**
 * Edge Function: /quotes
 * Handles: GET /quotes, POST /quotes, GET /quotes/:id, PATCH /quotes/:id,
 *          DELETE /quotes/:id, POST /quotes/:id/toggle-save, POST /quotes/:id/like
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { getAuthUser, requireAuth } from '../_shared/auth.ts';
import { formatQuote } from '../_shared/formatters.ts';
import { enrichAuthorWithInventaire } from '../_shared/inventaire.ts';
import { discoverAndEnrichBook } from '../_shared/bookEnrichment.ts';

// ─── DB query helpers ─────────────────────────────────────────────────────────

async function fetchQuotes(userId: number, quoteId?: number) {
  const where = quoteId ? sql`AND q.id = ${quoteId}` : sql``;
  const rows = await sql`
    SELECT
      q.*,
      row_to_json(a) as author,
      row_to_json(u) as user,
      (
        SELECT row_to_json(b_row)
        FROM (
          SELECT b.*, COALESCE(
            (SELECT json_agg(ub) FROM "UserBook" ub WHERE ub."bookId" = b.id AND ub."userId" = ${userId}),
            '[]'::json
          ) as users
          FROM "Book" b WHERE b.id = q."bookId"
        ) b_row
      ) as book,
      COALESCE((SELECT json_agg(l) FROM "Like" l WHERE l."quoteId" = q.id AND l."userId" = ${userId}), '[]'::json) as likes,
      COALESCE((SELECT json_agg(s) FROM "UserQuote" s WHERE s."quoteId" = q.id AND s."userId" = ${userId}), '[]'::json) as "savedBy",
      (SELECT COUNT(*) FROM "Like" l WHERE l."quoteId" = q.id)::int as "likesCount"
    FROM "Quote" q
    LEFT JOIN "Author" a ON a.id = q."authorId"
    LEFT JOIN "User" u ON u.id = q."userId"
    WHERE 1=1 ${where}
    ORDER BY q.date DESC
  `;
  return rows;
}

// ─── serve ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  // path after /functions/v1/quotes
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/quotes/, '') || '/';
  const parts = path.split('/').filter(Boolean); // e.g. ['123', 'toggle-save']
  const idParam = parts[0] && !isNaN(Number(parts[0])) ? parseInt(parts[0]) : null;
  const subAction = parts[1]; // 'toggle-save' | 'like' | undefined

  const user = await getAuthUser(req);
  const userId = user?.id ?? 0;

  try {
    // GET /quotes
    if (req.method === 'GET' && !idParam) {
      const rows = await fetchQuotes(userId);
      return json(rows.map(q => formatQuote(q, userId)));
    }

    // GET /quotes/:id
    if (req.method === 'GET' && idParam && !subAction) {
      const rows = await fetchQuotes(userId, idParam);
      if (!rows.length) return error('Quote not found', 404);
      return json(formatQuote(rows[0], userId));
    }

    // POST /quotes (create)
    if (req.method === 'POST' && !idParam) {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const { text, author, book, theme } = await req.json();
      if (!text || !author || !book) return error('Missing required fields', 400);

      // Find or create author
      let authorRows = await sql`SELECT * FROM "Author" WHERE name = ${author} LIMIT 1`;
      if (!authorRows.length) {
        authorRows = await sql`
          INSERT INTO "Author" (name, "isEnriching") VALUES (${author}, true) RETURNING *
        `;
        const authorId = authorRows[0].id;
        // Background enrichment — best practice: EdgeRuntime.waitUntil
        // @ts-ignore deno
        if (typeof EdgeRuntime !== 'undefined') {
          // @ts-ignore deno
          EdgeRuntime.waitUntil(enrichAuthorWithInventaire(authorId));
        }
      }
      const authorRecord = authorRows[0];

      // Find or create book
      let bookRows = await sql`
        SELECT * FROM "Book" WHERE title = ${book} AND "authorId" = ${authorRecord.id} LIMIT 1
      `;
      if (!bookRows.length) {
        bookRows = await sql`
          INSERT INTO "Book" (title, "authorId", "isEnriching")
          VALUES (${book}, ${authorRecord.id}, true) RETURNING *
        `;
      }
      const bookRecord = bookRows[0];

      // Background book discovery
      if (!bookRecord.description || !bookRecord.inventaireUri) {
        // @ts-ignore deno
        if (typeof EdgeRuntime !== 'undefined') {
          // @ts-ignore deno
          EdgeRuntime.waitUntil(discoverAndEnrichBook(bookRecord.id));
        }
      }

      // Add to user library
      await sql`
        INSERT INTO "UserBook" ("userId", "bookId", status, "addedAt")
        VALUES (${authUser.id}, ${bookRecord.id}, 'READING', now())
        ON CONFLICT ("userId", "bookId") DO NOTHING
      `;

      // Create quote
      const quoteRows = await sql`
        INSERT INTO "Quote" (text, date, "authorId", "bookId", "userId", theme, "likesCount")
        VALUES (${text}, now(), ${authorRecord.id}, ${bookRecord.id}, ${authUser.id}, ${theme ?? null}, 0)
        RETURNING *
      `;
      const newQuoteId = quoteRows[0].id;
      const fullQuoteRows = await fetchQuotes(authUser.id, newQuoteId);
      return json(formatQuote(fullQuoteRows[0], authUser.id));
    }

    // POST /quotes/:id/toggle-save
    if (req.method === 'POST' && idParam && subAction === 'toggle-save') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const existing = await sql`
        SELECT 1 FROM "UserQuote" WHERE "userId" = ${authUser.id} AND "quoteId" = ${idParam} LIMIT 1
      `;
      if (existing.length) {
        await sql`DELETE FROM "UserQuote" WHERE "userId" = ${authUser.id} AND "quoteId" = ${idParam}`;
        return json({ isSaved: false });
      } else {
        await sql`INSERT INTO "UserQuote" ("userId", "quoteId", "addedAt") VALUES (${authUser.id}, ${idParam}, now())`;
        return json({ isSaved: true });
      }
    }

    // POST /quotes/:id/like
    if (req.method === 'POST' && idParam && subAction === 'like') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const existing = await sql`
        SELECT 1 FROM "Like" WHERE "userId" = ${authUser.id} AND "quoteId" = ${idParam} LIMIT 1
      `;
      if (existing.length) {
        await sql`DELETE FROM "Like" WHERE "userId" = ${authUser.id} AND "quoteId" = ${idParam}`;
        await sql`UPDATE "Quote" SET "likesCount" = GREATEST(0, "likesCount" - 1) WHERE id = ${idParam}`;
        return json({ isLiked: false });
      } else {
        await sql`INSERT INTO "Like" ("userId", "quoteId", "createdAt") VALUES (${authUser.id}, ${idParam}, now())`;
        await sql`UPDATE "Quote" SET "likesCount" = "likesCount" + 1 WHERE id = ${idParam}`;
        return json({ isLiked: true });
      }
    }

    // PATCH /quotes/:id
    if (req.method === 'PATCH' && idParam && !subAction) {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const { text, author, book, theme } = await req.json();
      const existingRows = await sql`
        SELECT q.*, row_to_json(a) as author, row_to_json(b) as book
        FROM "Quote" q
        LEFT JOIN "Author" a ON a.id = q."authorId"
        LEFT JOIN "Book" b ON b.id = q."bookId"
        WHERE q.id = ${idParam} LIMIT 1
      `;
      if (!existingRows.length) return error('Quote not found', 404);
      const existing = existingRows[0];

      let authorId = existing.authorId;
      let bookId = existing.bookId;

      if (author && author !== (existing.author as any)?.name) {
        let aRows = await sql`SELECT id FROM "Author" WHERE name = ${author} LIMIT 1`;
        if (!aRows.length) {
          aRows = await sql`INSERT INTO "Author" (name, "isEnriching") VALUES (${author}, true) RETURNING id`;
          // @ts-ignore deno
          if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(enrichAuthorWithInventaire(aRows[0].id));
        }
        authorId = aRows[0].id;
      }

      if (book && book !== (existing.book as any)?.title) {
        let bRows = await sql`SELECT id FROM "Book" WHERE title = ${book} AND "authorId" = ${authorId} LIMIT 1`;
        if (!bRows.length) {
          bRows = await sql`INSERT INTO "Book" (title, "authorId", "isEnriching") VALUES (${book}, ${authorId}, true) RETURNING id`;
          // @ts-ignore deno
          if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(discoverAndEnrichBook(bRows[0].id));
        }
        bookId = bRows[0].id;
      }

      await sql`
        UPDATE "Quote" SET
          text = ${text ?? existing.text},
          theme = ${theme ?? existing.theme},
          "authorId" = ${authorId},
          "bookId" = ${bookId}
        WHERE id = ${idParam}
      `;

      const updatedRows = await fetchQuotes(authUser.id, idParam);
      return json(formatQuote(updatedRows[0], authUser.id));
    }

    // DELETE /quotes/:id
    if (req.method === 'DELETE' && idParam && !subAction) {
      await sql`DELETE FROM "Quote" WHERE id = ${idParam}`;
      return json({ success: true });
    }

    return error('Not found', 404);
  } catch (e) {
    console.error('[quotes]', e);
    return error('Internal server error');
  }
});
