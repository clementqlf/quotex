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
import { searchHybrid } from '../_shared/hybridSearch.ts';

async function fetchBook(bookId: number, userId: string | number) {
  const rows = await sql`
    SELECT b.*,
      row_to_json(a) as author,
      COALESCE((SELECT json_agg(ub) FROM "UserBook" ub WHERE ub."bookId" = b.id AND ub."userId" = ${userId}), '[]'::json) as users
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
  const userId = user?.id ?? 0;

  try {
    // GET /books
    if (req.method === 'GET' && parts.length === 0) {
      const authorName = url.searchParams.get('authorName');
      const rows = authorName
        ? await sql`
            SELECT b.*, row_to_json(a) as author,
              COALESCE((SELECT json_agg(ub) FROM "UserBook" ub WHERE ub."bookId" = b.id AND ub."userId" = ${userId}), '[]'::json) as users
            FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId"
            WHERE a.name = ${authorName}
          `
        : await sql`
            SELECT b.*, row_to_json(a) as author,
              COALESCE((SELECT json_agg(ub) FROM "UserBook" ub WHERE ub."bookId" = b.id AND ub."userId" = ${userId}), '[]'::json) as users
            FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId"
          `;
      return json(rows.map((b: any) => formatBook(b, userId)));
    }

    // POST /books/import
    if (req.method === 'POST' && parts[0] === 'import') {
      const bookData = await req.json();
      if (!bookData.title && !bookData.googleId && !bookData.openLibraryId) {
        return error('Book data must have an ID or title', 400);
      }

      // Check existing by priority
      let existing = null;
      if (bookData.inventaireUri) {
        const r = await sql`SELECT b.*, row_to_json(a) as author FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId" WHERE b."inventaireUri" = ${bookData.inventaireUri} LIMIT 1`;
        if (r.length) existing = r[0];
      }
      if (!existing && bookData.openLibraryId) {
        const r = await sql`SELECT b.*, row_to_json(a) as author FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId" WHERE b."openLibraryId" = ${bookData.openLibraryId} LIMIT 1`;
        if (r.length) existing = r[0];
      }
      if (!existing && bookData.googleId) {
        const r = await sql`SELECT b.*, row_to_json(a) as author FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId" WHERE b."googleId" = ${bookData.googleId} LIMIT 1`;
        if (r.length) existing = r[0];
      }
      if (!existing && bookData.title) {
        const r = await sql`SELECT b.*, row_to_json(a) as author FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId" WHERE b.title = ${bookData.title} LIMIT 1`;
        if (r.length) existing = r[0];
      }

      if (existing) {
        const buyLinks = existing.buyLinks && existing.buyLinks !== '[]'
          ? existing.buyLinks
          : JSON.stringify(generateBuyLinks(bookData.isbn || existing.isbn, existing.title, (existing.author as any)?.name || '', bookData.buyLink));

        await sql`
          UPDATE "Book" SET
            "googleId" = COALESCE(${bookData.googleId ?? null}, "googleId"),
            "openLibraryId" = COALESCE(${bookData.openLibraryId ?? null}, "openLibraryId"),
            "inventaireUri" = COALESCE(${bookData.inventaireUri ?? null}, "inventaireUri"),
            isbn = COALESCE(${bookData.isbn ?? null}, isbn),
            description = COALESCE(description, ${bookData.description ?? null}),
            cover = COALESCE(cover, ${bookData.cover ?? null}),
            pages = COALESCE(pages, ${bookData.pages ?? null}),
            year = COALESCE(year, ${bookData.year ?? null}),
            genre = COALESCE(genre, ${bookData.genre ?? null}),
            "buyLinks" = ${buyLinks}
          WHERE id = ${existing.id}
        `;

        if (existing.author?.id) {
          const authorUri = bookData.authorUris?.[0];
          // @ts-ignore deno
          if (typeof EdgeRuntime !== 'undefined') {
            // @ts-ignore deno
            EdgeRuntime.waitUntil(enrichAuthorWithInventaire(existing.author.id, undefined, authorUri));
          }
        }

        const updated = await fetchBook(existing.id, userId);
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

      const newBookRows = await sql`
        INSERT INTO "Book" (title, "googleId", "openLibraryId", "inventaireUri", isbn, description, year, pages, cover, genre, "authorId", rating, "buyLinks")
        VALUES (
          ${bookData.title}, ${bookData.googleId ?? null}, ${bookData.openLibraryId ?? null},
          ${bookData.inventaireUri ?? null}, ${bookData.isbn ?? null},
          ${bookData.description || ''}, ${bookData.year || 0}, ${bookData.pages || 0},
          ${bookData.cover || ''}, ${bookData.genre || 'Unknown'}, ${author.id},
          ${bookData.rating || 0}, ${buyLinksJson}
        )
        RETURNING *
      `;
      const newBook = newBookRows[0];

      // Enrich
      if (newBook.inventaireUri) {
        await enrichBookWithInventaire(newBook.id);
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
      return json(formatBook(fullBook, userId));
    }

    // GET /books/:id
    if (req.method === 'GET' && idParam && !subAction) {
      const book = await fetchBook(idParam, userId);
      if (!book) return error('Book not found', 404);
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

    // PATCH /books/:id/status
    if (req.method === 'PATCH' && idParam && subAction === 'status') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const { readingStatus } = await req.json();
      if (!readingStatus) return error('Missing readingStatus', 400);

      await sql`
        INSERT INTO "UserBook" ("userId", "bookId", "status", "addedAt")
        VALUES (${authUser.id}, ${idParam}, ${readingStatus}, now())
        ON CONFLICT ("userId", "bookId") DO UPDATE SET "status" = EXCLUDED.status
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
