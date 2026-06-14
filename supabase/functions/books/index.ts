/**
 * Edge Function: /books
 * Handles: GET /books, GET /books/:id, POST /books/import,
 *          POST /books/:id/toggle-save, PATCH /books/:id/status, GET /books/:id/editions
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { getAuthUser, requireAuth } from '../_shared/auth.ts';
import { formatBook, generateBuyLinks } from '../_shared/formatters.ts';
import { enrichAuthorWithInventaire, getWorkEditions, InventaireEdition } from '../_shared/inventaire.ts';
import { enrichBookWithInventaire, discoverAndEnrichBook } from '../_shared/bookEnrichment.ts';

function normalizeInventaireUri(uri?: string | null): string | null {
  if (!uri) return null;
  const trimmed = String(uri).trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith('wd:')) {
    return `wd:${trimmed.slice(3).trim()}`;
  }
  if (/^q\d+$/i.test(trimmed)) {
    return `wd:${trimmed.toUpperCase()}`;
  }
  return trimmed;
}

async function fetchBook(bookId: number, userId: string | number | null) {
  // ✅ CORRECTION: Utiliser des CTEs pour éviter les sous-requêtes coûteuses
  const rows = await sql`
    WITH book_users AS (
      SELECT json_agg(json_build_object('userId', ub."userId", 'bookId', ub."bookId", 'status', ub.status, 'addedAt', ub."addedAt", 'addedViaQuote', ub."addedViaQuote")) as users
      FROM "UserBook" ub
      WHERE ub."bookId" = ${bookId} AND ub."userId" = ${userId}::uuid
    ),
    book_laureates AS (
      SELECT json_agg(json_build_object(
        'id', l.id,
        'year', l.year,
        'prizeId', l."prizeId",
        'authorId', l."authorId",
        'bookId', l."bookId",
        'prize', (SELECT row_to_json(lp) FROM "LiteraryPrize" lp WHERE lp.id = l."prizeId")
      )) as laureates
      FROM "Laureate" l
      WHERE l."bookId" = ${bookId}
    )
    SELECT b.*,
      (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn,
      row_to_json(a) as author,
      (SELECT users FROM book_users LIMIT 1) as users,
      (SELECT laureates FROM book_laureates LIMIT 1) as laureates,
      COALESCE((
        SELECT json_agg(sb) FROM (
          SELECT S.id, S.title, S.cover, S.genre, S.year, S.pages, S.rating, S."inventaireUri",
                 (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = S.id AND e.isbn IS NOT NULL LIMIT 1) as isbn,
                 row_to_json(sa) as author,
                 (
                   (CASE WHEN S."authorId" = b."authorId" THEN 12 ELSE 0 END) +
                   (CASE WHEN b.genre IS NOT NULL AND b.genre != '' AND b.genre != 'Unknown' AND S.genre = b.genre THEN 5 ELSE 0 END) +
                   COALESCE((
                     SELECT COUNT(*)*8 
                     FROM "Laureate" l1 
                     JOIN "Laureate" l2 ON l1."prizeId" = l2."prizeId" 
                     WHERE l1."bookId" = b.id AND l2."bookId" = S.id
                   ), 0) +
                   COALESCE((
                     SELECT COUNT(*)*3 
                     FROM "UserBook" ub1 
                     JOIN "UserBook" ub2 ON ub1."userId" = ub2."userId" 
                     WHERE ub1."bookId" = b.id AND ub2."bookId" = S.id
                   ), 0)
                 ) as score
          FROM "Book" S
          LEFT JOIN "Author" sa ON sa.id = S."authorId"
          WHERE S.id != b.id
          ORDER BY score DESC, S.rating DESC, S.year DESC
          LIMIT 10
        ) sb
      ), '[]'::json) as "similarBooks"
    FROM "Book" b
    LEFT JOIN "Author" a ON a.id = b."authorId"
    WHERE b.id = ${bookId} LIMIT 1
  `;
  return rows[0] ?? null;
}

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/books/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  const idParam = parts[0] && !isNaN(Number(parts[0])) ? parseInt(parts[0]) : null;
  const subAction = parts[1]; // 'toggle-save' | 'status' | 'editions' | 'import'

  const user = await getAuthUser(req);
  const userId = user?.id ?? null;

  try {
    // GET /books/by-inventaire/:uri
    if (req.method === 'GET' && parts[0] === 'by-inventaire' && parts[1]) {
      const rawUri = decodeURIComponent(parts.slice(1).join('/'));
      const normalizedUri = normalizeInventaireUri(rawUri);
      if (!normalizedUri) return error('Missing inventaireUri', 400);

      const rows = await sql`
        SELECT id
        FROM "Book"
        WHERE replace(lower(coalesce("inventaireUri", '')), 'wd:', '') = replace(lower(${normalizedUri}), 'wd:', '')
        ORDER BY id DESC
        LIMIT 1
      `;

      if (!rows.length) return error('Book not found', 404);

      const found = await fetchBook(rows[0].id, userId);
      if (!found) return error('Book not found', 404);
      return json(formatBook(found, userId));
    }

    // GET /books
    if (req.method === 'GET' && parts.length === 0) {
      const authorName = url.searchParams.get('authorName');
      const rows = authorName
        ? await sql`
            SELECT b.*, 
              (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn,
              row_to_json(a) as author,
              COALESCE((SELECT json_agg(json_build_object('userId', ub."userId", 'bookId', ub."bookId", 'status', ub.status, 'addedAt', ub."addedAt", 'addedViaQuote', ub."addedViaQuote")) FROM "UserBook" ub WHERE ub."bookId" = b.id AND ub."userId" = ${userId}), '[]'::json) as users,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', l.id,
                  'year', l.year,
                  'prizeId', l."prizeId",
                  'authorId', l."authorId",
                  'bookId', l."bookId",
                  'prize', (SELECT row_to_json(lp) FROM "LiteraryPrize" lp WHERE lp.id = l."prizeId")
                ))
                FROM "Laureate" l
                WHERE l."bookId" = b.id
              ), '[]'::json) as laureates
            FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId"
            WHERE a.name = ${authorName}
          `
        : await sql`
            SELECT b.*, 
              (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn,
              row_to_json(a) as author,
              COALESCE((SELECT json_agg(json_build_object('userId', ub."userId", 'bookId', ub."bookId", 'status', ub.status, 'addedAt', ub."addedAt", 'addedViaQuote', ub."addedViaQuote")) FROM "UserBook" ub WHERE ub."bookId" = b.id AND ub."userId" = ${userId}), '[]'::json) as users,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', l.id,
                  'year', l.year,
                  'prizeId', l."prizeId",
                  'authorId', l."authorId",
                  'bookId', l."bookId",
                  'prize', (SELECT row_to_json(lp) FROM "LiteraryPrize" lp WHERE lp.id = l."prizeId")
                ))
                FROM "Laureate" l
                WHERE l."bookId" = b.id
              ), '[]'::json) as laureates
            FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId"
          `;
      return json(rows.map((b: any) => formatBook(b, userId)));
    }

    // POST /books/import
    if (req.method === 'POST' && parts[0] === 'import') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const bookData = await req.json();
      const normalizedInventaireUri = normalizeInventaireUri(bookData.inventaireUri);
      console.warn('[books/import] start', {
        title: bookData.title,
        inventaireUri: normalizedInventaireUri,
        googleId: bookData.googleId,
        openLibraryId: bookData.openLibraryId,
        hasDescription: !!bookData.description,
        hasCover: !!bookData.cover,
      });
      if (!bookData.title && !bookData.googleId && !bookData.openLibraryId) {
        return error('Book data must have an ID or title', 400);
      }

      // Check existing by priority
      let existing = null;
      if (normalizedInventaireUri) {
        const r = await sql`SELECT b.*, (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn, row_to_json(a) as author FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId" WHERE replace(lower(coalesce(b."inventaireUri", '')), 'wd:', '') = replace(lower(${normalizedInventaireUri}), 'wd:', '') LIMIT 1`;
        if (r.length) existing = r[0];
      }
      if (!existing && bookData.openLibraryId) {
        const r = await sql`SELECT b.*, (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn, row_to_json(a) as author FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId" WHERE b."openLibraryId" = ${bookData.openLibraryId} LIMIT 1`;
        if (r.length) existing = r[0];
      }
      if (!existing && bookData.googleId) {
        const r = await sql`SELECT b.*, (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn, row_to_json(a) as author FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId" WHERE b."googleId" = ${bookData.googleId} LIMIT 1`;
        if (r.length) existing = r[0];
      }
      if (!existing && bookData.title) {
        const r = await sql`SELECT b.*, (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn, row_to_json(a) as author FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId" WHERE b.title = ${bookData.title} LIMIT 1`;
        if (r.length) existing = r[0];
      }

      if (existing) {
        console.warn('[books/import] existing book found', {
          id: existing.id,
          title: existing.title,
          inventaireUri: existing.inventaireUri,
        });
        const buyLinks = existing.buyLinks && existing.buyLinks !== '[]'
          ? existing.buyLinks
          : JSON.stringify(generateBuyLinks(bookData.isbn || existing.isbn, existing.title, (existing.author as any)?.name || '', bookData.buyLink));

        // Only update pages if we have a valid positive value
        const pagesUpdate = bookData.pages !== null && bookData.pages !== undefined && bookData.pages > 0
          ? bookData.pages
          : null;
        
        await sql`
          UPDATE "Book" SET
            "googleId" = COALESCE(${bookData.googleId ?? null}, "googleId"),
            "openLibraryId" = COALESCE(${bookData.openLibraryId ?? null}, "openLibraryId"),
            "inventaireUri" = COALESCE(${normalizedInventaireUri ?? null}, "inventaireUri"),
            description = COALESCE(description, ${bookData.description ?? null}),
            cover = COALESCE(cover, ${bookData.cover ?? null}),
            pages = COALESCE(pages, ${pagesUpdate}),
            year = COALESCE(year, ${bookData.year ?? null}),
            genre = COALESCE(genre, ${bookData.genre ?? null}),
            "buyLinks" = ${buyLinks}
          WHERE id = ${existing.id}
        `;

        if (bookData.isbn) {
          const invUri = normalizedInventaireUri || `isbn:${bookData.isbn}`;
          await sql`
            INSERT INTO "Edition" ("inventaireUri", isbn, title, "publishDate", "publisherUri", "languageUri", cover, "bookId")
            VALUES (${invUri}, ${bookData.isbn}, ${bookData.title}, ${bookData.year ? `${bookData.year}-01-01` : null}, null, null, ${bookData.cover || ''}, ${existing.id})
            ON CONFLICT ("inventaireUri") DO NOTHING
          `;
        }

        if (existing.author?.id) {
          const authorUri = bookData.authorUris?.[0];
          // @ts-ignore deno
          if (typeof EdgeRuntime !== 'undefined') {
            // @ts-ignore deno
            EdgeRuntime.waitUntil(enrichAuthorWithInventaire(existing.author.id, undefined, authorUri));
          }
        }

        // Trigger detailed book enrichment if we have an inventaireUri
        const uriToEnrich = bookData.inventaireUri || existing.inventaireUri;
        const normalizedUriToEnrich = normalizeInventaireUri(uriToEnrich);
        if (normalizedUriToEnrich) {
          // @ts-ignore deno
          if (typeof EdgeRuntime !== 'undefined') {
            // @ts-ignore deno
            EdgeRuntime.waitUntil(enrichBookWithInventaire(existing.id));
          } else {
            await enrichBookWithInventaire(existing.id);
          }
        }

        const updated = await fetchBook(existing.id, userId);
        console.warn('[books/import] existing book updated', {
          id: existing.id,
          title: updated?.title,
          inventaireUri: updated?.inventaireUri,
        });
        return json(formatBook(updated, userId));
      }

      // Create new book
      const authorName = bookData.authors?.[0] || 'Unknown';
      let authorRows = await sql`SELECT * FROM "Author" WHERE name = ${authorName} LIMIT 1`;
      if (!authorRows.length) {
        authorRows = await sql`INSERT INTO "Author" (name) VALUES (${authorName}) RETURNING *`;
      }
      const author = authorRows[0];

      const buyLinksJson = JSON.stringify(
        generateBuyLinks(bookData.isbn, bookData.title, authorName, bookData.buyLink)
      );

      // Use explicit null/undefined checks to avoid sending 0 when pages is not provided
      const pagesValue = bookData.pages !== null && bookData.pages !== undefined && bookData.pages > 0
        ? bookData.pages
        : null;
      
      const newBookRows = await sql`
        INSERT INTO "Book" (title, "googleId", "openLibraryId", "inventaireUri", description, year, pages, cover, genre, "authorId", rating, "buyLinks")
        VALUES (
          ${bookData.title}, ${bookData.googleId ?? null}, ${bookData.openLibraryId ?? null},
          ${normalizedInventaireUri ?? null},
          ${bookData.description || ''}, ${bookData.year || 0}, ${pagesValue},
          ${bookData.cover || ''}, ${bookData.genre || 'Unknown'}, ${author.id},
          ${bookData.rating || 0}, ${buyLinksJson}
        )
        RETURNING *
      `;
      const newBook = newBookRows[0];
      console.warn('[books/import] new book inserted', {
        id: newBook.id,
        title: newBook.title,
        inventaireUri: newBook.inventaireUri,
      });

      if (bookData.isbn) {
        const invUri = normalizedInventaireUri || `isbn:${bookData.isbn}`;
        await sql`
          INSERT INTO "Edition" ("inventaireUri", isbn, title, "publishDate", "publisherUri", "languageUri", cover, "bookId")
          VALUES (${invUri}, ${bookData.isbn}, ${bookData.title}, ${bookData.year ? `${bookData.year}-01-01` : null}, null, null, ${bookData.cover || ''}, ${newBook.id})
          ON CONFLICT ("inventaireUri") DO NOTHING
        `;
      }

      // Enrich
      if (newBook.inventaireUri) {
        console.warn('[books/import] scheduling inventaire enrichment', {
          id: newBook.id,
          inventaireUri: newBook.inventaireUri,
        });
        // @ts-ignore deno
        if (typeof EdgeRuntime !== 'undefined') {
          // @ts-ignore deno
          EdgeRuntime.waitUntil(
            enrichBookWithInventaire(newBook.id)
              .then(() => console.warn('[books/import] inventaire enrichment finished', { id: newBook.id }))
              .catch((err: any) => console.error('[books/import] inventaire enrichment failed', { id: newBook.id, err }))
          );
        } else {
          void enrichBookWithInventaire(newBook.id)
            .then(() => console.warn('[books/import] inventaire enrichment finished', { id: newBook.id }))
            .catch((err: any) => console.error('[books/import] inventaire enrichment failed', { id: newBook.id, err }));
        }
      } else {
        // @ts-ignore deno
        if (typeof EdgeRuntime !== 'undefined') {
          // @ts-ignore deno
          EdgeRuntime.waitUntil(discoverAndEnrichBook(newBook.id));
        }
      }

      if (author.id) {
        const authorUri = bookData.authorUris?.[0];
        // @ts-ignore deno
        if (typeof EdgeRuntime !== 'undefined') {
          // @ts-ignore deno
          EdgeRuntime.waitUntil(enrichAuthorWithInventaire(author.id, undefined, authorUri));
        }
      }

      const fullBook = await fetchBook(newBook.id, userId);
      console.warn('[books/import] returning response', {
        id: fullBook?.id,
        title: fullBook?.title,
        inventaireUri: fullBook?.inventaireUri,
      });
      return json(formatBook(fullBook, userId));
    }

    // GET /books/:id
    if (req.method === 'GET' && idParam && !subAction) {
      const book = await fetchBook(idParam, userId);
      if (!book) return error('Book not found', 404);

      // Trigger background enrichment if data is sparse
      if (book.inventaireUri && (!book.description || book.description.length < 50 || !book.cover || !book.genre || book.genre === 'Unknown' || book.genre === '')) {
        // @ts-ignore deno
        if (typeof EdgeRuntime !== 'undefined') {
          console.log(`[books] Triggering background enrichment for book ${idParam}`);
          // @ts-ignore deno
          EdgeRuntime.waitUntil(enrichBookWithInventaire(idParam));
          
          if (book.authorId) {
            // @ts-ignore deno
            EdgeRuntime.waitUntil(enrichAuthorWithInventaire(book.authorId));
          }
        }
      }

      return json(formatBook(book, userId));
    }

    // GET /books/:id/editions
    if (req.method === 'GET' && idParam && subAction === 'editions') {
      const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

      const bookRows = await sql`
        SELECT b.*, COALESCE((SELECT json_agg(e ORDER BY e."publishDate") FROM "Edition" e WHERE e."bookId" = b.id), '[]'::json) as editions
        FROM "Book" b WHERE b.id = ${idParam} LIMIT 1
      `;
      if (!bookRows.length) return error('Book not found', 404);
      const book = bookRows[0];

      const editions = book.editions as any[];
      if (editions?.length > 0) {
        const oldest = editions.reduce((min: any, e: any) => new Date(e.createdAt) < new Date(min.createdAt) ? e : min, editions[0]);
        if (Date.now() - new Date(oldest.createdAt).getTime() < CACHE_TTL) {
          return json(editions);
        }
      }

      if (!book.inventaireUri) return json(editions || []);

      const fetched: InventaireEdition[] = await getWorkEditions(book.inventaireUri);
      if (fetched.length > 0) {
        await sql`DELETE FROM "Edition" WHERE "bookId" = ${idParam}`;
        for (const ed of fetched) {
          await sql`
            INSERT INTO "Edition" ("inventaireUri", isbn, title, "publishDate", "publisherUri", "languageUri", cover, "bookId")
            VALUES (${ed.inventaireUri}, ${ed.isbn}, ${ed.title}, ${ed.publishDate}, ${ed.publisherUri}, ${ed.languageUri}, ${ed.cover}, ${idParam})
            ON CONFLICT ("inventaireUri") DO NOTHING
          `;
        }
      }
      const fresh = await sql`SELECT * FROM "Edition" WHERE "bookId" = ${idParam} ORDER BY "publishDate"`;
      return json(fresh);
    }

    // POST /books/:id/toggle-save
    if (req.method === 'POST' && idParam && subAction === 'toggle-save') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const existing = await sql`
        SELECT 1 FROM "UserBook" WHERE "userId" = ${authUser.id} AND "bookId" = ${idParam} LIMIT 1
      `;
      if (existing.length) {
        await sql`DELETE FROM "UserBook" WHERE "userId" = ${authUser.id} AND "bookId" = ${idParam}`;
        return json({ isSaved: false });
      } else {
        await sql`INSERT INTO "UserBook" ("userId", "bookId", "addedAt") VALUES (${authUser.id}, ${idParam}, now())`;
        return json({ isSaved: true });
      }
    }

    // POST /books/:id/enrich
    if (req.method === 'POST' && idParam && subAction === 'enrich') {
      // Ensure the lastEnrichedAt column exists in the database
      await sql`ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "lastEnrichedAt" timestamp with time zone`
        .catch((e: any) => console.error('[Migration] Failed to add lastEnrichedAt column:', e));

      const bookRows = await sql`SELECT "inventaireUri" FROM "Book" WHERE id = ${idParam} LIMIT 1`;
      if (bookRows.length && !bookRows[0].inventaireUri) {
        await discoverAndEnrichBook(idParam);
      } else {
        await enrichBookWithInventaire(idParam);
      }
      const updated = await fetchBook(idParam, userId);
      return json(formatBook(updated, userId));
    }

    // PATCH /books/:id/status
    if (req.method === 'PATCH' && idParam && subAction === 'status') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const { readingStatus } = await req.json();
      if (!readingStatus) return error('Missing readingStatus', 400);

      await sql`
        INSERT INTO "UserBook" ("userId", "bookId", "status", "addedViaQuote", "addedAt")
        VALUES (${authUser.id}, ${idParam}, ${readingStatus}, false, now())
        ON CONFLICT ("userId", "bookId") DO UPDATE SET 
          "status" = EXCLUDED.status,
          "addedViaQuote" = false
      `;

      const book = await fetchBook(idParam, authUser.id);
      return json(formatBook(book, authUser.id));
    }

    return error('Not found', 404);
  } catch (e) {
    console.error('[books]', e);
    return error('Internal server error');
  }
});
