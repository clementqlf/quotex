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
import { enrichAuthorWithInventaire, findWorkUriByTitleAndAuthor, normalizeTitle } from '../_shared/inventaire.ts';
import { discoverAndEnrichBook } from '../_shared/bookEnrichment.ts';
import { analyzeQuoteWithGroq, chatAboutQuoteWithGroq } from '../_shared/groq.ts';


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

  // Resolve dynamic data (title, cover, author) for recommended books in blockData
  for (const r of rows) {
    let blockDataObj: Record<string, any> = {};
    if (r.blockData) {
      try {
        blockDataObj = typeof r.blockData === 'string' ? JSON.parse(r.blockData) : r.blockData;
      } catch (e) {
        continue;
      }
    }
    if (blockDataObj && blockDataObj.recommendedBooks && Array.isArray(blockDataObj.recommendedBooks) && blockDataObj.recommendedBooks.length > 0) {
      const bookIds = blockDataObj.recommendedBooks.map((b: any) => b.id).filter(Boolean);
      if (bookIds.length > 0) {
        try {
          const resolvedBooks = await sql`
            SELECT b.id, b.title, b.cover, a.name as "authorName"
            FROM "Book" b
            LEFT JOIN "Author" a ON a.id = b."authorId"
            WHERE b.id = ANY(${bookIds})
          `;
          blockDataObj.recommendedBooks = blockDataObj.recommendedBooks.map((b: any) => {
            const matched = resolvedBooks.find((rb: any) => Number(rb.id) === Number(b.id));
            return {
              ...b,
              title: matched?.title || b.title,
              cover: matched?.cover || null,
              author: matched?.authorName || b.author
            };
          });
          r.blockData = blockDataObj;
        } catch (err) {
          console.error('[Quotes] Failed to resolve recommended books in fetchQuotes:', err);
        }
      }
    }
  }

  return rows;
}

async function performQuoteAnalysis(quoteId: number) {
  try {
    const rows = await sql`
      SELECT q.id, q.text, q."blockData", a.name as "authorName", b.title as "bookTitle"
      FROM "Quote" q
      LEFT JOIN "Author" a ON a.id = q."authorId"
      LEFT JOIN "Book" b ON b.id = q."bookId"
      WHERE q.id = ${quoteId}
      LIMIT 1
    `;
    if (!rows.length) return;
    const q = rows[0];

    console.log(`[Quotes] Triggering Groq analysis for quote ID ${quoteId}...`);
    const result = await analyzeQuoteWithGroq(q.text, q.authorName || 'Inconnu', q.bookTitle || 'Inconnu');

    let blockDataObj: Record<string, any> = {};
    if (q.blockData) {
      try {
        blockDataObj = typeof q.blockData === 'string' ? JSON.parse(q.blockData) : q.blockData;
      } catch (e) {
        console.error('[Quotes] Error parsing blockData in performQuoteAnalysis:', e);
      }
    }

    const recommendedBooks = result.recommendedBooks || [];
    console.log(`[Quotes Analysis] AI recommended books raw output:`, JSON.stringify(recommendedBooks, null, 2));
    const resolvedRecBooks = [];
    const enrichmentTasks: Array<{ type: 'book' | 'author'; id: number }> = [];

    for (const recBook of recommendedBooks) {
      if (!recBook.title) {
        console.log(`[Quotes Analysis] Skipping recommended book due to missing title:`, JSON.stringify(recBook));
        continue;
      }
      const recTitle = recBook.title.trim();
      const recAuthor = recBook.author ? recBook.author.trim() : 'Auteur inconnu';
      console.log(`[Quotes Analysis] Processing recommended book: "${recTitle}" by "${recAuthor}"`);

      try {
        // Step 1: Find or create author record
        let authorRecord = null;
        if (recAuthor && recAuthor !== 'Auteur inconnu') {
          let authorRows = await sql`SELECT * FROM "Author" WHERE name = ${recAuthor} LIMIT 1`;
          if (!authorRows.length) {
            authorRows = await sql`
              INSERT INTO "Author" (name, "isEnriching") VALUES (${recAuthor}, true) RETURNING *
            `;
          }
          authorRecord = authorRows[0];

          // Queue author enrichment in background if details are missing
          if (authorRecord && (!authorRecord.description || !authorRecord.inventaireUri)) {
            enrichmentTasks.push({ type: 'author', id: authorRecord.id });
          }
        }
        const authorIdVal = authorRecord ? authorRecord.id : null;

        // Step 2: Try to find a local book match using normalized title comparison
        let bookRecord = null;
        let localMatchFound = false;

        if (authorIdVal) {
          // Fetch all books for this author to perform local normalized matching
          const localBooks = await sql`
            SELECT * FROM "Book" WHERE "authorId" = ${authorIdVal}
          `;
          const normRecTitle = normalizeTitle(recTitle);
          const matchedBook = localBooks.find((b: any) => normalizeTitle(b.title) === normRecTitle);
          if (matchedBook) {
            bookRecord = matchedBook;
            localMatchFound = true;
            console.log(`[Quotes Analysis] Local normalized title match found for "${recTitle}" → "${bookRecord.title}" (ID: ${bookRecord.id})`);
          }
        }

        // Step 3: If not matched locally, lookup on Inventaire.io
        if (!localMatchFound) {
          console.log(`[Quotes Analysis] No local match found for "${recTitle}" in database. Querying Inventaire.io...`);
          const uri = await findWorkUriByTitleAndAuthor(recTitle, recAuthor);
          if (!uri) {
            console.log(`[Quotes Analysis] Book "${recTitle}" by "${recAuthor}" was NOT found on Inventaire.io (search returned null). Skipping recommendation.`);
            continue; // FILTER OUT: Do not add or display if not found on Inventaire
          }
          console.log(`[Quotes Analysis] Book "${recTitle}" by "${recAuthor}" successfully matched on Inventaire.io with URI: "${uri}"`);

          // We got the URI from Inventaire. Check if we already have it in DB by URI
          const conflictRows = await sql`
            SELECT * FROM "Book" WHERE "inventaireUri" = ${uri} LIMIT 1
          `;
          if (conflictRows.length > 0) {
            bookRecord = conflictRows[0];
            console.log(`[Quotes] Inventaire URI match found in DB for "${recTitle}" (URI: ${uri}) → "${bookRecord.title}" (ID: ${bookRecord.id})`);
          } else {
            // It's a new book, but verified via Inventaire!
            const bookRows = await sql`
              INSERT INTO "Book" (title, "authorId", "inventaireUri", "isEnriching")
              VALUES (${recTitle}, ${authorIdVal}, ${uri}, true) RETURNING *
            `;
            bookRecord = bookRows[0];
            console.log(`[Quotes] Created new verified book record for "${recTitle}" (URI: ${uri}) (ID: ${bookRecord.id})`);
          }
        }

        // Step 4: Queue enrichment for this book if details are missing
        if (bookRecord) {
          if (!bookRecord.cover || !bookRecord.description || !bookRecord.inventaireUri) {
            enrichmentTasks.push({ type: 'book', id: bookRecord.id });
          }

          resolvedRecBooks.push({
            id: bookRecord.id,
            title: bookRecord.title,
            author: recAuthor,
          });
        }

      } catch (err) {
        console.error(`[Quotes] Failed to process recommended book "${recTitle}":`, err);
      }
    }

    blockDataObj.recommendedBooks = resolvedRecBooks;

    await sql`
      UPDATE "Quote"
      SET 
        "aiInterpretation" = ${result.interpretation},
        "theme" = COALESCE("theme", ${result.theme}),
        "blockData" = ${JSON.stringify(blockDataObj)}
      WHERE id = ${quoteId}
    `;
    console.log(`[Quotes] Successfully analyzed quote ID ${quoteId}`);

    // Trigger sequential background enrichment for all gathered books and authors
    if (enrichmentTasks.length > 0 && typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil((async () => {
        console.log(`[Quotes] Starting sequential background enrichment for ${enrichmentTasks.length} entities...`);
        for (const task of enrichmentTasks) {
          try {
            // Wait 500ms between enrichments to prevent rate limiting / resource spikes
            await new Promise(resolve => setTimeout(resolve, 500));
            if (task.type === 'book') {
              console.log(`[Quotes] Background enriching recommended book ID: ${task.id}`);
              await discoverAndEnrichBook(task.id);
            } else if (task.type === 'author') {
              console.log(`[Quotes] Background enriching recommended author ID: ${task.id}`);
              await enrichAuthorWithInventaire(task.id);
            }
          } catch (err) {
            console.error(`[Quotes] Background enrichment failed for ${task.type} ID ${task.id}:`, err);
          }
        }
        console.log('[Quotes] Sequential background enrichment finished.');
      })());
    }

  } catch (e) {
    console.error(`[Quotes] Background analysis failed for quote ID ${quoteId}:`, e);
  }
}


// ─── serve ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  // Drop NOT NULL constraint on authorId to allow books without authors
  await sql`ALTER TABLE "Book" ALTER COLUMN "authorId" DROP NOT NULL`
    .catch((e) => console.error('[Migration] Failed to drop NOT NULL constraint on authorId:', e));

  // Ensure addedViaQuote column exists in UserBook
  await sql`ALTER TABLE "UserBook" ADD COLUMN IF NOT EXISTS "addedViaQuote" boolean DEFAULT false`
    .catch((e) => console.error('[Migration] Failed to add addedViaQuote column:', e));

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
            INSERT INTO "Author" (name, "isEnriching") VALUES (${authorName}, true) RETURNING *
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
            VALUES (${bookTitle}, ${authorIdVal}, true) RETURNING *
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
          INSERT INTO "UserBook" ("userId", "bookId", status, "addedViaQuote", "addedAt")
          VALUES (${authUser.id}, ${bookRecord.id}, 'READING', true, now())
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

      const responseText = await chatAboutQuoteWithGroq(
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
              aRows = await sql`INSERT INTO "Author" (name, "isEnriching") VALUES (${trimmedAuthor}, true) RETURNING id`;
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
            bRows = await sql`INSERT INTO "Book" (title, "authorId", "isEnriching") VALUES (${newBookTitle}, ${authorIdVal}, true) RETURNING id`;
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
            bRows = await sql`INSERT INTO "Book" (title, "authorId", "isEnriching") VALUES (${currentBookTitle}, ${authorId}, true) RETURNING id`;
            // @ts-ignore deno
            if (typeof EdgeRuntime !== 'undefined') {
              EdgeRuntime.waitUntil(discoverAndEnrichBook(bRows[0].id));
            }
          }
          bookId = bRows[0].id;
        }
      }
      // Handle UserBook cleanup for old book and insertion/upsert for new book
      const oldBookId = existing.bookId ?? existing.bookid;
      if (oldBookId && String(oldBookId) !== (bookId ? String(bookId) : '')) {
        const otherQuotes = await sql`
          SELECT 1 FROM "Quote"
          WHERE "userId" = ${authUser.id}
            AND "bookId" = ${oldBookId}
            AND "id" != ${idParam}
          LIMIT 1
        `;
        if (otherQuotes.length === 0) {
          await sql`
            DELETE FROM "UserBook"
            WHERE "userId" = ${authUser.id}
              AND "bookId" = ${oldBookId}
              AND "addedViaQuote" = true
          `;
        }
      }

      if (bookId) {
        await sql`
          INSERT INTO "UserBook" ("userId", "bookId", status, "addedViaQuote", "addedAt")
          VALUES (${authUser.id}, ${bookId}, 'READING', true, now())
          ON CONFLICT ("userId", "bookId") 
          DO UPDATE SET status = COALESCE("UserBook".status, EXCLUDED.status)
        `;
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

      // Get the quote details before deleting to check if we need to clean up the book
      const quoteRows = await sql`
        SELECT "bookId" FROM "Quote" WHERE id = ${idParam} AND "userId" = ${authUser.id} LIMIT 1
      `;
      if (quoteRows.length > 0) {
        const quoteBookId = quoteRows[0].bookId;

        await sql`DELETE FROM "Quote" WHERE id = ${idParam} AND "userId" = ${authUser.id}`;

        if (quoteBookId) {
          // Check if there are other quotes referencing this book
          const otherQuotes = await sql`
            SELECT 1 FROM "Quote"
            WHERE "userId" = ${authUser.id}
              AND "bookId" = ${quoteBookId}
            LIMIT 1
          `;
          if (otherQuotes.length === 0) {
            // Delete from UserBook if added via quote
            await sql`
              DELETE FROM "UserBook"
              WHERE "userId" = ${authUser.id}
                AND "bookId" = ${quoteBookId}
                AND "addedViaQuote" = true
            `;
          }
        }
      } else {
        await sql`DELETE FROM "Quote" WHERE id = ${idParam} AND "userId" = ${authUser.id}`;
      }

      return json({ success: true });
    }

    return error('Not found', 404);
  } catch (e: any) {
    console.error('[quotes]', e);
    return error(`Internal server error: ${e.message || 'Unknown error'}`, 500);
  }
});
