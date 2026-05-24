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
import { analyzeQuoteWithGemini, chatAboutQuoteWithGemini } from '../_shared/gemini.ts';


// ─── DB query helpers ─────────────────────────────────────────────────────────

async function fetchQuotes(userId: string | null, quoteId?: number) {
  const where = quoteId ? sql`AND q."id" = ${quoteId}` : sql``;
  const rows = await sql`
    SELECT
      q.*,
      (SELECT row_to_json(u_row) FROM (SELECT u.id, u.username, u.name, u.image, u.bio, u.website FROM "Profile" u WHERE u.id = q."userId") u_row) as "user",
      row_to_json(a) as "author",
      (
        SELECT row_to_json(b_row)
        FROM (
          SELECT b.*, COALESCE(
            (SELECT json_agg(ub) FROM "UserBook" ub WHERE ub."bookId" = b."id" AND ub."userId" = ${userId}::uuid),
            '[]'::json
          ) as "users"
          FROM "Book" b WHERE b."id" = q."bookId"
        ) b_row
      ) as "book",
      COALESCE((SELECT json_agg(l) FROM "Like" l WHERE l."quoteId" = q."id" AND l."userId" = ${userId}::uuid), '[]'::json) as "likes",
      COALESCE((SELECT json_agg(s) FROM "UserQuote" s WHERE s."quoteId" = q."id" AND s."userId" = ${userId}::uuid), '[]'::json) as "savedBy"
    FROM "Quote" q
    LEFT JOIN "Author" a ON a."id" = q."authorId"
    WHERE 1=1 ${where}
    ORDER BY q."date" DESC
  `;
  return rows;
}

async function performQuoteAnalysis(quoteId: number) {
  try {
    const rows = await sql`
      SELECT q.id, q.text, a.name as "authorName", b.title as "bookTitle"
      FROM "Quote" q
      LEFT JOIN "Author" a ON a.id = q."authorId"
      LEFT JOIN "Book" b ON b.id = q."bookId"
      WHERE q.id = ${quoteId}
      LIMIT 1
    `;
    if (!rows.length) return;
    const q = rows[0];

    console.log(`[Quotes] Triggering Gemini analysis for quote ID ${quoteId}...`);
    const result = await analyzeQuoteWithGemini(q.text, q.authorName || 'Inconnu', q.bookTitle || 'Inconnu');

    await sql`
      UPDATE "Quote"
      SET 
        "aiInterpretation" = ${result.interpretation},
        "theme" = COALESCE("theme", ${result.theme})
      WHERE id = ${quoteId}
    `;
    console.log(`[Quotes] Successfully analyzed quote ID ${quoteId}`);
  } catch (e) {
    console.error(`[Quotes] Background analysis failed for quote ID ${quoteId}:`, e);
  }
}


// ─── serve ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/quotes/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  const idParam = parts[0] && !isNaN(Number(parts[0])) ? parseInt(parts[0]) : null;
  const subAction = parts[1];

  const user = await getAuthUser(req);
  const authUserId = user?.id ?? null;

  try {
    // GET /quotes
    if (req.method === 'GET' && !idParam) {
      const rows = await fetchQuotes(authUserId);
      return json(rows.map(q => formatQuote(q, authUserId ?? '')));
    }

    // GET /quotes/:id
    if (req.method === 'GET' && idParam && !subAction) {
      const rows = await fetchQuotes(authUserId, idParam);
      if (!rows.length) return error('Quote not found', 404);
      return json(formatQuote(rows[0], authUserId ?? ''));
    }

    // POST /quotes (create)
    if (req.method === 'POST' && !idParam) {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const { text, author, book, theme, blockData } = await req.json();
      if (!text) return error('Missing required field: text', 400);

      const hasAuthor = author && typeof author === 'string' && author.trim() !== '' && author.trim() !== 'Auteur inconnu';
      const hasBook = book && typeof book === 'string' && book.trim() !== '' && book.trim() !== 'Livre inconnu';

      // Find or create author
      let authorRecord = null;
      if (hasAuthor) {
        const authorName = author.trim();
        let authorRows = await sql`SELECT * FROM "Author" WHERE name = ${authorName} LIMIT 1`;
        if (!authorRows.length) {
          authorRows = await sql`
            INSERT INTO "Author" (name, "isEnriching") VALUES (${authorName}, false) RETURNING *
          `;
          authorRecord = authorRows[0];
        } else {
          authorRecord = authorRows[0];
        }

        // Trigger enrichment if missing URI or description (or recently created)
        if (!authorRecord.inventaireUri || !authorRecord.description) {
          console.log(`[Quotes] Triggering enrichment for author: ${authorRecord.name} (ID: ${authorRecord.id})`);
          // @ts-ignore deno
          if (typeof EdgeRuntime !== 'undefined') {
            // @ts-ignore deno
            EdgeRuntime.waitUntil(enrichAuthorWithInventaire(authorRecord.id));
          }
        }
      }

      // Find or create book
      let bookRecord = null;
      if (hasBook) {
        const bookTitle = book.trim();
        const authorIdVal = authorRecord ? authorRecord.id : null;
        let bookRows;
        if (authorIdVal) {
          bookRows = await sql`
            SELECT * FROM "Book" WHERE title = ${bookTitle} AND "authorId" = ${authorIdVal} LIMIT 1
          `;
        } else {
          bookRows = await sql`
            SELECT * FROM "Book" WHERE title = ${bookTitle} AND "authorId" IS NULL LIMIT 1
          `;
        }
        if (!bookRows.length) {
          bookRows = await sql`
            INSERT INTO "Book" (title, "authorId", "isEnriching")
            VALUES (${bookTitle}, ${authorIdVal}, false) RETURNING *
          `;
        }
        bookRecord = bookRows[0];

        // Background book discovery
        if (!bookRecord.description || !bookRecord.inventaireUri) {
          console.log(`[Quotes] Triggering discovery/enrichment for book: ${bookRecord.title} (ID: ${bookRecord.id})`);
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
          ON CONFLICT ("userId", "bookId") 
          DO UPDATE SET status = COALESCE("UserBook".status, EXCLUDED.status)
        `;
      }

      // Create quote
      const authorIdToInsert = authorRecord ? authorRecord.id : null;
      const bookIdToInsert = bookRecord ? bookRecord.id : null;

      const quoteRows = await sql`
        INSERT INTO "Quote" ("text", "date", "authorId", "bookId", "userId", "theme", "likesCount", "blockData")
        VALUES (${text}, now(), ${authorIdToInsert}, ${bookIdToInsert}, ${authUser.id}, ${theme ?? null}, 0, ${blockData ? JSON.stringify(blockData) : null})
        RETURNING *
      `;
      const newQuoteId = quoteRows[0].id;

      // Background AI analysis
      // @ts-ignore deno
      if (typeof EdgeRuntime !== 'undefined') {
        // @ts-ignore deno
        EdgeRuntime.waitUntil(performQuoteAnalysis(newQuoteId));
      }

      const fullQuoteRows = await fetchQuotes(authUser.id, newQuoteId);
      return json(formatQuote(fullQuoteRows[0], authUser.id));
    }


    // POST /quotes/:id/analyze (trigger AI interpretation manually)
    if (req.method === 'POST' && idParam && subAction === 'analyze') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      await performQuoteAnalysis(idParam);

      const updatedRows = await fetchQuotes(authUser.id, idParam);
      return json(formatQuote(updatedRows[0], authUser.id));
    }

    // POST /quotes/:id/chat
    if (req.method === 'POST' && idParam && subAction === 'chat') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const { messages } = await req.json();
      if (!messages || !Array.isArray(messages)) return error('Missing or invalid messages parameter', 400);

      const rows = await sql`
        SELECT q.id, q.text, a.name as "authorName", b.title as "bookTitle", q."aiInterpretation", q."blockData"
        FROM "Quote" q
        LEFT JOIN "Author" a ON a.id = q."authorId"
        LEFT JOIN "Book" b ON b.id = q."bookId"
        WHERE q.id = ${idParam}
        LIMIT 1
      `;
      if (!rows.length) return error('Quote not found', 404);
      const q = rows[0];

      const responseText = await chatAboutQuoteWithGemini(
        q.text,
        q.authorName || 'Inconnu',
        q.bookTitle || 'Inconnu',
        q.aiInterpretation || '',
        messages
      );

      // Save updated chat history in the JSON blockData field
      let blockDataObj: Record<string, any> = {};
      if (q.blockData) {
        try {
          blockDataObj = typeof q.blockData === 'string' ? JSON.parse(q.blockData) : q.blockData;
        } catch (e) {
          console.error('[Quotes Edge Function] Error parsing blockData:', e);
        }
      }

      const updatedHistory = [...messages, { role: 'model', content: responseText }];
      blockDataObj.chatHistory = updatedHistory;

      await sql`
        UPDATE "Quote"
        SET "blockData" = ${JSON.stringify(blockDataObj)}
        WHERE "id" = ${idParam}
      `;

      return json({ response: responseText });
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
  
      const { text, author, book, theme, blockData } = await req.json();
      const existingRows = await sql`
        SELECT q.*, row_to_json(a) as author, row_to_json(b) as book,
               (SELECT row_to_json(u_row) FROM (SELECT u.id, u.username, u.name, u.image FROM "Profile" u WHERE u.id = q."userId") u_row) as "user"
        FROM "Quote" q
        LEFT JOIN "Author" a ON a.id = q."authorId"
        LEFT JOIN "Book" b ON b.id = q."bookId"
        WHERE q.id = ${idParam} LIMIT 1
      `;
      if (!existingRows.length) return error('Quote not found', 404);
      const existing = existingRows[0];
  
      let authorId = existing.authorId ?? existing.authorid;
      let bookId = existing.bookId ?? existing.bookid;
  
      // 1. Resolve Author
      if (author !== undefined) {
        if (author === null || (typeof author === 'string' && (author.trim() === '' || author.trim() === 'Auteur inconnu'))) {
          authorId = null;
        } else if (typeof author === 'string') {
          const trimmedAuthor = author.trim();
          const existingAuthorName = (existing.author as any)?.name;
          if (trimmedAuthor !== existingAuthorName) {
            let aRows = await sql`SELECT id FROM "Author" WHERE name = ${trimmedAuthor} LIMIT 1`;
            if (!aRows.length) {
              aRows = await sql`INSERT INTO "Author" (name, "isEnriching") VALUES (${trimmedAuthor}, false) RETURNING id`;
              // @ts-ignore deno
              if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(enrichAuthorWithInventaire(aRows[0].id));
            }
            authorId = aRows[0].id;
          }
        }
      }
  
      // 2. Resolve Book
      if (book !== undefined) {
        if (book === null || (typeof book === 'string' && (book.trim() === '' || book.trim() === 'Livre inconnu'))) {
          bookId = null;
        } else if (typeof book === 'string') {
          const newBookTitle = book.trim();
          const authorIdVal = authorId;
          let bRows;
          if (authorIdVal) {
            bRows = await sql`SELECT id FROM "Book" WHERE title = ${newBookTitle} AND "authorId" = ${authorIdVal} LIMIT 1`;
          } else {
            bRows = await sql`SELECT id FROM "Book" WHERE title = ${newBookTitle} AND "authorId" IS NULL LIMIT 1`;
          }
          if (!bRows.length) {
            bRows = await sql`INSERT INTO "Book" (title, "authorId", "isEnriching") VALUES (${newBookTitle}, ${authorIdVal}, false) RETURNING id`;
            // @ts-ignore deno
            if (typeof EdgeRuntime !== 'undefined') {
              EdgeRuntime.waitUntil(discoverAndEnrichBook(bRows[0].id));
            }
          }
          bookId = bRows[0].id;
        }
      } else {
        // book is undefined, but authorId might have changed
        const currentBookTitle = (existing.book as any)?.title;
        if (currentBookTitle && authorId !== (existing.authorId ?? existing.authorid)) {
          let bRows;
          if (authorId) {
            bRows = await sql`SELECT id FROM "Book" WHERE title = ${currentBookTitle} AND "authorId" = ${authorId} LIMIT 1`;
          } else {
            bRows = await sql`SELECT id FROM "Book" WHERE title = ${currentBookTitle} AND "authorId" IS NULL LIMIT 1`;
          }
          if (!bRows.length) {
            bRows = await sql`INSERT INTO "Book" (title, "authorId", "isEnriching") VALUES (${currentBookTitle}, ${authorId}, false) RETURNING id`;
            // @ts-ignore deno
            if (typeof EdgeRuntime !== 'undefined') {
              EdgeRuntime.waitUntil(discoverAndEnrichBook(bRows[0].id));
            }
          }
          bookId = bRows[0].id;
        }
      }
      // 3. Update the Quote
      console.log('[DEBUG PATCH]', {
        text: text !== undefined ? text : existing.text,
        theme: theme !== undefined ? theme : existing.theme,
        authorId,
        bookId,
        blockData: blockData !== undefined ? blockData : existing.blockData,
        existingBlockData: existing.blockData,
        existingText: existing.text,
        existingTheme: existing.theme,
        existingAuthorId: existing.authorId,
        existingAuthorid: existing.authorid,
        existingBookId: existing.bookId,
        existingBookid: existing.bookid
      });

      await sql`
        UPDATE "Quote" SET
          "text" = ${text !== undefined ? text : (existing.text ?? null)},
          "theme" = ${theme !== undefined ? theme : (existing.theme ?? null)},
          "authorId" = ${authorId ?? null},
          "bookId" = ${bookId ?? null},
          "blockData" = ${blockData !== undefined ? (blockData ? JSON.stringify(blockData) : null) : (existing.blockData ?? null)}
        WHERE "id" = ${idParam}
      `;
  
      const updatedRows = await fetchQuotes(authUser.id, idParam);
      return json(formatQuote(updatedRows[0], authUser.id));
    }

    // DELETE /quotes/:id
    if (req.method === 'DELETE' && idParam && !subAction) {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      await sql`DELETE FROM "Quote" WHERE id = ${idParam} AND "userId" = ${authUser.id}`;
      return json({ success: true });
    }

    return error('Not found', 404);
  } catch (e: any) {
    console.error('[quotes]', e);
    return error(`Internal server error: ${e.message || 'Unknown error'}`, 500);
  }
});
